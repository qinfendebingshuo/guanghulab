#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════
Qwen2.5-7B 全参数 SFT 训练入口 · train.py
═══════════════════════════════════════════════════════════
签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559

V100 32G × 4 上的 Qwen2.5-7B 全参 SFT.
策略: DeepSpeed ZeRO-3 + 优化器 CPU offload + gradient checkpointing + fp16

启动方式 (由 start-training.sh 调用):
  deepspeed --num_gpus=4 train.py

stdout 协议(被 watch-training-output.sh 解析):
  ZY_PROGRESS step=N total=M loss=X lr=Y epoch=E total_epochs=TE thr=T

环境变量:
  ZY_TRAIN_DATA      数据根 (默认 /data/guanghu)
  ZY_MODEL_DIR       模型路径 (默认 $ZY_TRAIN_DATA/models/Qwen2.5-7B)
  ZY_DATA_PATH       SFT JSONL (默认 $ZY_TRAIN_DATA/processed/sft.jsonl)
  ZY_OUTPUT_DIR      checkpoint 输出 (默认 $ZY_TRAIN_DATA/checkpoints/qwen2_5_7b_sft)
  ZY_DS_CONFIG       DeepSpeed json (默认 server/training-agent/configs/ds_zero3_offload.json)
  ZY_NUM_EPOCHS      默认 3
  ZY_LR              默认 2e-5
  ZY_MAX_SEQ_LEN     默认 2048
  ZY_PER_DEVICE_BSZ  默认 1
  ZY_GRAD_ACCUM      默认 16
  ZY_SAVE_STEPS      默认 200
  ZY_LOGGING_STEPS   默认 5
  ZY_REPORT_EVERY_STEPS 默认 5 (ZY_PROGRESS 协议输出节流)
"""
from __future__ import annotations
import json
import math
import multiprocessing as _mp
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# ── multi-rank × multi-proc fork 安全护栏 ──
# 必须在 import torch / transformers / datasets 之前生效:
#   1. 关掉 fast tokenizer 的 Rust 线程池, 避免 fork 后子进程死锁/abort
#      (这是 deepspeed 多 rank 同时在 datasets.map 里 fork worker 时
#       iflatmap_unordered 静默崩溃的最常见根因).
#   2. 把 multiprocessing 默认启动方式从 fork 切到 spawn, 即使后续有人
#      把 ZY_MAP_NUM_PROC 调高也安全.
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
try:
    _mp.set_start_method("spawn", force=True)
except RuntimeError:
    # 已经被设置过 — 由调用方负责, 不强制覆盖
    pass

import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    TrainerCallback,
    set_seed,
)

# ── 配置 ──
DATA_ROOT = Path(os.environ.get("ZY_TRAIN_DATA", "/data/guanghu"))
MODEL_DIR = Path(os.environ.get("ZY_MODEL_DIR", str(DATA_ROOT / "models" / "Qwen2.5-7B")))
DATA_PATH = Path(os.environ.get("ZY_DATA_PATH", str(DATA_ROOT / "processed" / "sft.jsonl")))
OUTPUT_DIR = Path(os.environ.get("ZY_OUTPUT_DIR", str(DATA_ROOT / "checkpoints" / "qwen2_5_7b_sft")))
DS_CONFIG = Path(os.environ.get("ZY_DS_CONFIG", str(Path(__file__).parent / "configs" / "ds_zero3_offload.json")))

NUM_EPOCHS = float(os.environ.get("ZY_NUM_EPOCHS", "3"))
LR = float(os.environ.get("ZY_LR", "2e-5"))
MAX_SEQ_LEN = int(os.environ.get("ZY_MAX_SEQ_LEN", "2048"))
PER_DEVICE_BSZ = int(os.environ.get("ZY_PER_DEVICE_BSZ", "1"))
GRAD_ACCUM = int(os.environ.get("ZY_GRAD_ACCUM", "16"))
SAVE_STEPS = int(os.environ.get("ZY_SAVE_STEPS", "200"))
LOGGING_STEPS = int(os.environ.get("ZY_LOGGING_STEPS", "5"))
REPORT_EVERY = int(os.environ.get("ZY_REPORT_EVERY_STEPS", "5"))
SEED = int(os.environ.get("ZY_SEED", "42"))

# datasets.map 的 worker 数. 默认 1 — 这是有意的:
#   - deepspeed --num_gpus=N 起 N 个 rank, 每个 rank 都会调一次 build_dataset.
#     如果这里再 fork 出 cpu//2 个 map worker, 就是 N × (cpu//2) 个 fork 子进程
#     同时加载 fast tokenizer + 同时写 datasets cache, 极易触发
#     `iflatmap_unordered` 静默崩溃.
#   - 几万行 SFT 用 fast tokenizer 串行 tokenize 通常 < 1 分钟, 远小于一次训练代价.
#   - 真有大数据集需要并行, 用 ZY_MAP_NUM_PROC=N 显式开 (此时务必只让 rank 0 跑 map,
#     由调用方保证, 这里不再做 multi-rank 同时并行 map 的兼容).
MAP_NUM_PROC = max(1, int(os.environ.get("ZY_MAP_NUM_PROC", "1")))

IGNORE_INDEX = -100


def is_main_process() -> bool:
    return int(os.environ.get("LOCAL_RANK", "0")) == 0


def log(msg: str):
    if is_main_process():
        print(msg, flush=True)


# ── 数据加载 + 模板化 ──

def _resolve_role_anchors(tokenizer) -> dict[str, list[int]]:
    """解析 ChatML 的 assistant 段定位锚点.

    返回:
      im_start_id   — <|im_start|> 的 token id
      im_end_id     — <|im_end|> 的 token id
      asst_role_ids — "assistant\n" 编码后的 token id 序列 (作为内容前的角色头)

    思路:
      Qwen2.5 的 chat_template 把每段对话包成 <|im_start|>{role}\n{content}<|im_end|>\n.
      <|im_start|> / <|im_end|> 是 special token, BPE 不会跨它们合并,
      因此可以在 full_ids 上直接用 token-id 做线性扫描定位 assistant 段,
      不依赖任何 "前缀对齐" 假设. 这是修复 "有效样本: 0" 故障的关键.
    """
    im_start_id = tokenizer.convert_tokens_to_ids("<|im_start|>")
    im_end_id = tokenizer.convert_tokens_to_ids("<|im_end|>")
    if im_start_id is None or im_end_id is None or im_start_id == tokenizer.unk_token_id:
        raise RuntimeError(
            "[train] tokenizer 缺少 <|im_start|>/<|im_end|> special token, "
            "确认这是 Qwen2.5 系列模型 (而不是兼容包装)."
        )
    # "assistant\n" 编码为 content token (不带任何 special token)
    asst_role_ids = tokenizer.encode("assistant\n", add_special_tokens=False)
    if not asst_role_ids:
        raise RuntimeError("[train] 无法编码 'assistant\\n' 角色头, tokenizer 异常.")
    return {
        "im_start_id": im_start_id,
        "im_end_id": im_end_id,
        "asst_role_ids": asst_role_ids,
    }


def _mask_assistant_segments(
    full_ids: list[int],
    im_start_id: int,
    im_end_id: int,
    asst_role_ids: list[int],
) -> tuple[list[int], int]:
    """在 full_ids 上线性扫描, 找出所有 assistant 段并返回 labels + 标记到的 token 数.

    被标记的范围 = assistant 内容 + 闭合的 <|im_end|> (让模型学会自然停止).
    若 max_seq_len 截断导致最后一段没有闭合的 im_end_id, 则标到序列末尾.
    """
    n = len(full_ids)
    labels = [IGNORE_INDEX] * n
    role_len = len(asst_role_ids)
    marked = 0
    k = 0
    while k < n:
        if full_ids[k] != im_start_id:
            k += 1
            continue
        # 检查 <|im_start|> 后是否是 "assistant\n"
        if k + role_len < n and full_ids[k + 1 : k + 1 + role_len] == asst_role_ids:
            content_start = k + 1 + role_len
            # 找到内容结尾的 <|im_end|>
            j = content_start
            while j < n and full_ids[j] != im_end_id:
                j += 1
            content_end = min(j, n - 1)  # 含 im_end (若存在), 否则到序列末尾
            for p in range(content_start, content_end + 1):
                labels[p] = full_ids[p]
            marked += content_end + 1 - content_start
            k = content_end + 1
        else:
            k += 1
    return labels, marked


def build_dataset(tokenizer):
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"训练数据不存在: {DATA_PATH} · 请先跑 preprocess-corpus.py")

    log(f"[train] 加载数据: {DATA_PATH}")
    raw = load_dataset("json", data_files=str(DATA_PATH), split="train")
    log(f"[train] 样本数: {len(raw)}")

    anchors = _resolve_role_anchors(tokenizer)
    im_start_id = anchors["im_start_id"]
    im_end_id = anchors["im_end_id"]
    asst_role_ids = anchors["asst_role_ids"]

    def encode(example: dict[str, Any], idx: int | None = None) -> dict[str, list[int]]:
        try:
            msgs = example["messages"]
            # apply_chat_template 一次性按 Qwen2.5 ChatML 格式化整段对话
            full_ids = tokenizer.apply_chat_template(
                msgs, tokenize=True, add_generation_prompt=False,
                truncation=True, max_length=MAX_SEQ_LEN,
            )
            labels, _marked = _mask_assistant_segments(
                full_ids, im_start_id, im_end_id, asst_role_ids
            )
            return {"input_ids": full_ids, "labels": labels, "attention_mask": [1] * len(full_ids)}
        except Exception as e:
            # 让 worker 子进程在崩之前留下"那一条样本是谁"的痕迹.
            # iflatmap_unordered 在主进程只能看到 worker 的最终 traceback,
            # 这里把样本指纹打到 stderr, 便于事后定位脏数据.
            try:
                msgs = example.get("messages")
                preview = json.dumps(msgs, ensure_ascii=False)[:300] if msgs is not None else "<no messages>"
            except Exception:
                preview = "<unprintable>"
            sys.stderr.write(
                f"[train.encode] 样本编码失败 idx={idx} err={type(e).__name__}: {e}\n"
                f"[train.encode] messages 预览: {preview}\n"
            )
            sys.stderr.flush()
            raise

    cols = raw.column_names
    log(f"[train] tokenize map: num_proc={MAP_NUM_PROC} (默认 1, 用 ZY_MAP_NUM_PROC 覆盖)")
    ds = raw.map(encode, with_indices=True, remove_columns=cols, num_proc=MAP_NUM_PROC)
    # 过滤掉没有 assistant token 的样本 (理论上极少, 留作防御)
    ds = ds.filter(lambda ex: any(l != IGNORE_INDEX for l in ex["labels"]))
    log(f"[train] 有效样本: {len(ds)}")

    # ── "自动门" 防呆守护 ──
    # 若一条都没标到, 立即停, 不让 Trainer 在空数据集上裸奔.
    # 同时打首条样本的诊断信息, 让下一次定位时 < 30 秒.
    if len(ds) == 0:
        sample = raw[0] if len(raw) > 0 else None
        diag = ["[train] ❌ 有效样本为 0 — 标记环节失效, 终止训练."]
        if sample is not None:
            try:
                fid = tokenizer.apply_chat_template(
                    sample["messages"], tokenize=True, add_generation_prompt=False,
                    truncation=True, max_length=MAX_SEQ_LEN,
                )
                preview = tokenizer.decode(fid[:200], skip_special_tokens=False)
                diag.append(f"[train] 诊断: im_start_id={im_start_id} im_end_id={im_end_id} "
                            f"asst_role_ids={asst_role_ids}")
                diag.append(f"[train] 诊断: 首条样本 token 数={len(fid)}")
                diag.append(f"[train] 诊断: 首条样本前 200 token 解码=\n{preview}")
            except Exception as e:
                diag.append(f"[train] 诊断失败: {e}")
        for line in diag:
            log(line)
        raise RuntimeError("有效样本为 0 — 见上方诊断.")

    # 标注质量统计 — "门会回报它做了什么"
    if is_main_process():
        try:
            sample_n = min(64, len(ds))
            asst_tokens = 0
            total_tokens = 0
            for i in range(sample_n):
                row = ds[i]
                total_tokens += len(row["labels"])
                asst_tokens += sum(1 for l in row["labels"] if l != IGNORE_INDEX)
            ratio = asst_tokens / total_tokens if total_tokens else 0.0
            log(f"[train] 标注统计 (前 {sample_n} 条采样): "
                f"平均 assistant token 占比={ratio:.2%} "
                f"(平均 {asst_tokens // sample_n} tok/样本)")
        except Exception as e:
            log(f"[train] 标注统计失败(非致命): {e}")
    return ds


@dataclass
class PadCollator:
    tokenizer: Any
    pad_to_multiple_of: int = 8

    def __call__(self, features: list[dict]) -> dict[str, torch.Tensor]:
        max_len = max(len(f["input_ids"]) for f in features)
        if self.pad_to_multiple_of > 1:
            max_len = math.ceil(max_len / self.pad_to_multiple_of) * self.pad_to_multiple_of
        pad_id = self.tokenizer.pad_token_id
        if pad_id is None:
            pad_id = self.tokenizer.eos_token_id

        def _pad(seq: list[int], val: int) -> list[int]:
            return seq + [val] * (max_len - len(seq))

        input_ids = torch.tensor([_pad(f["input_ids"], pad_id) for f in features], dtype=torch.long)
        labels = torch.tensor([_pad(f["labels"], IGNORE_INDEX) for f in features], dtype=torch.long)
        attn = torch.tensor([_pad(f["attention_mask"], 0) for f in features], dtype=torch.long)
        return {"input_ids": input_ids, "labels": labels, "attention_mask": attn}


# ── 心跳协议: Trainer Callback ──

class ZYProgressCallback(TrainerCallback):
    """每 REPORT_EVERY 步输出 stdout 协议行,被 watch-training-output.sh 解析."""

    def __init__(self):
        self.t0 = time.time()
        self.last_step = -1

    def on_log(self, args, state, control, logs=None, **kwargs):  # noqa: D401
        if not is_main_process() or not logs:
            return
        step = state.global_step or 0
        if step == self.last_step:
            return
        if step > 0 and (step - self.last_step) < REPORT_EVERY and step != state.max_steps:
            return
        self.last_step = step
        loss = logs.get("loss") if "loss" in logs else logs.get("train_loss")
        lr = logs.get("learning_rate")
        elapsed = max(time.time() - self.t0, 1e-6)
        thr = step / elapsed if step > 0 else 0.0
        epoch = math.floor(state.epoch or 0)
        line = (
            f"ZY_PROGRESS step={step} total={state.max_steps} "
            f"epoch={epoch} total_epochs={int(args.num_train_epochs)} "
            f"loss={loss if loss is not None else 'nan'} "
            f"lr={lr if lr is not None else 'nan'} "
            f"thr={thr:.4f}"
        )
        print(line, flush=True)


def main() -> int:
    set_seed(SEED)

    if not MODEL_DIR.is_dir():
        log(f"❌ 模型目录不存在: {MODEL_DIR} · 请先跑 download-model.py")
        return 2
    if not DS_CONFIG.is_file():
        log(f"❌ DeepSpeed 配置不存在: {DS_CONFIG}")
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    log(f"[train] 模型: {MODEL_DIR}")
    log(f"[train] 数据: {DATA_PATH}")
    log(f"[train] 输出: {OUTPUT_DIR}")
    log(f"[train] DS:   {DS_CONFIG}")

    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR), trust_remote_code=True, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    train_ds = build_dataset(tokenizer)

    log("[train] 加载模型 (fp16)...")
    model = AutoModelForCausalLM.from_pretrained(
        str(MODEL_DIR),
        dtype=torch.float16,
        trust_remote_code=True,
        use_cache=False,  # 与 gradient_checkpointing 冲突
    )
    model.gradient_checkpointing_enable()
    if hasattr(model, "enable_input_require_grads"):
        model.enable_input_require_grads()

    args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=PER_DEVICE_BSZ,
        gradient_accumulation_steps=GRAD_ACCUM,
        learning_rate=LR,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        weight_decay=0.0,
        max_grad_norm=1.0,
        fp16=True,
        bf16=False,
        gradient_checkpointing=True,
        logging_steps=LOGGING_STEPS,
        save_steps=SAVE_STEPS,
        save_total_limit=3,
        save_strategy="steps",
        report_to=["tensorboard"],
        deepspeed=str(DS_CONFIG),
        ddp_find_unused_parameters=False,
        dataloader_num_workers=2,
        dataloader_pin_memory=True,
        remove_unused_columns=False,
        seed=SEED,
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        data_collator=PadCollator(tokenizer=tokenizer),
        callbacks=[ZYProgressCallback()],
    )

    if is_main_process():
        # 写一个供副将查询的训练 meta
        try:
            (OUTPUT_DIR / "training-meta.json").write_text(
                json.dumps({
                    "model": str(MODEL_DIR),
                    "data": str(DATA_PATH),
                    "max_seq_len": MAX_SEQ_LEN,
                    "num_train_epochs": NUM_EPOCHS,
                    "per_device_batch": PER_DEVICE_BSZ,
                    "grad_accum": GRAD_ACCUM,
                    "effective_batch": PER_DEVICE_BSZ * GRAD_ACCUM * max(1, torch.cuda.device_count()),
                    "lr": LR,
                    "fp16": True,
                    "deepspeed_config": str(DS_CONFIG),
                }, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as e:
            log(f"[train] meta 写入失败(非致命): {e}")

    log("[train] 🔥 开始训练")
    train_result = trainer.train()

    log("[train] 训练结束 · 保存最终模型...")
    trainer.save_model(str(OUTPUT_DIR / "final"))
    trainer.save_state()
    if is_main_process():
        try:
            tokenizer.save_pretrained(str(OUTPUT_DIR / "final"))
        except Exception as e:
            log(f"[train] tokenizer 保存失败(非致命): {e}")

    log(f"[train] ✅ 完成 · global_step={trainer.state.global_step} · loss={train_result.training_loss:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
