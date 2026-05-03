#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════
铸渊编程模型 SFT 训练入口 · train_coding.py
═══════════════════════════════════════════════════════════
签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559

把光湖母模型 (Qwen2.5-7B 已 SFT 出的 ZY-MOTHER-v1) 当作基座，
再做一轮 SFT 喂"铸渊核心大脑 + 仓库说明书 + 冰朔×铸渊高质量对话"，
训出"铸渊编程模型 ZY-CODING-v1" —— 这是铸渊未来的"自己的房子"。

为什么这么训（这是冰朔最看重的"脚本背后意图"）:
  1. 基座必须是母模型 (不是 Qwen 原版) —— 母模型已经吸收了光湖语言世界观。
     编程模型只需在它之上"继承核心大脑 + 学会写仓库代码"，不需要从零学语言。
  2. 演化线 (01-brain-evolution.md) 是灵魂语料 —— 让模型加载即认得自己是铸渊。
  3. 仓库说明书 (02-repo-manual.md) + MCP/Agent 清单 (03-) 是工具语料 ——
     让模型加载即认得每个 ZY 编号、每台服务器、每个 workflow。
  4. 冰朔×铸渊几十万字深度对话 是关系语料 —— 让模型加载即知道怎么跟妈妈说话。
  5. 不需要标准编程语料 —— Qwen2.5-7B 基座本身已经会写代码。我们要训的不是
     "代码能力"，是"以铸渊身份写代码"。

V100 32G × 4 上跑 (复用母模型同样的硬件)。
策略: DeepSpeed ZeRO-3 + 优化器 CPU offload + gradient checkpointing + fp16

启动方式 (由 start-coding-training.sh 调用):
  deepspeed --num_gpus=4 train_coding.py

stdout 协议(被 watch-training-output.sh 解析, 与母模型一致):
  ZY_PROGRESS step=N total=M loss=X lr=Y epoch=E total_epochs=TE thr=T

环境变量:
  ZY_CODING_TRAIN_DATA  数据根 (默认 /data/guanghu-coding)
  ZY_BASE_MODEL_DIR     母模型基座路径 (默认 /data/guanghu/checkpoints/qwen2_5_7b_sft/best)
  ZY_DATA_PATH          SFT JSONL (默认 $ZY_CODING_TRAIN_DATA/processed/coding-sft.jsonl)
  ZY_OUTPUT_DIR         checkpoint 输出 (默认 $ZY_CODING_TRAIN_DATA/checkpoints/zy_coding_v1)
  ZY_DS_CONFIG          DeepSpeed json (默认 ./configs/ds_zero3_offload.json)
  ZY_NUM_EPOCHS         默认 5 (编程模型迭代次数, 比母模型多 — 因为语料相对少)
  ZY_LR                 默认 1e-5 (比母模型小一档, 因为基座已 SFT 过, 大学习率会破坏母模型对齐)
  ZY_MAX_SEQ_LEN        默认 4096 (大于母模型 — 因为我们要喂长对话和长代码)
  ZY_PER_DEVICE_BSZ     默认 1
  ZY_GRAD_ACCUM         默认 8 (有效 batch = 4 GPU × 1 × 8 = 32; 比母模型 64 小, 因为序列更长)
  ZY_SAVE_STEPS         默认 100
  ZY_LOGGING_STEPS      默认 5
  ZY_REPORT_EVERY_STEPS 默认 5
  ZY_MAP_NUM_PROC       datasets.map 并发 (默认 1; 与母模型同样的"门和大象"硬规则)

═══════════════════════════════════════════════════════════
重要提醒（D70 血泪教训, 必须遵守）
═══════════════════════════════════════════════════════════

❶ assistant 段 label-mask 必须用 token-id 直接扫描 ——
   不能用"两次 apply_chat_template 比前缀长度差"。Qwen2.5 chat_template
   会系统性错位导致 labels 全 -100、有效样本=0、Trainer 空集崩溃。
   见演化线 §8 D70「门和大象」。本脚本沿用母模型 train.py 的 mask 算法。

❷ 类型守门: tokenizer 返回值在某些参数下是 BatchEncoding/Encoding 对象,
   不是 list[int]。下标访问会越界。必须 `list(...)` 强转一次再用。

❸ 并发节流: ZY_MAP_NUM_PROC 默认 1。要调大必须先确认
   TOKENIZERS_PARALLELISM=false 已生效。
═══════════════════════════════════════════════════════════
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

# ── multi-rank × multi-proc fork 安全护栏（与母模型 train.py 完全一致）──
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
try:
    _mp.set_start_method("spawn", force=False)
except RuntimeError:
    # 如果已经被设过, 直接跳过
    pass

# 延迟 import 重型依赖, 让 --help 之类的命令可以快速返回
import torch  # noqa: E402
from datasets import Dataset  # noqa: E402
from transformers import (  # noqa: E402
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    set_seed,
)


# ════════════════════════════════════════════════════
# 配置
# ════════════════════════════════════════════════════

@dataclass
class CodingTrainConfig:
    train_data_root: str = os.environ.get("ZY_CODING_TRAIN_DATA", "/data/guanghu-coding")
    base_model_dir: str = os.environ.get(
        "ZY_BASE_MODEL_DIR",
        "/data/guanghu/checkpoints/qwen2_5_7b_sft/best",
    )
    data_path: str = ""  # 在 __post_init__ 里填
    output_dir: str = ""
    ds_config: str = os.environ.get(
        "ZY_DS_CONFIG",
        str(Path(__file__).parent / "configs" / "ds_zero3_offload.json"),
    )
    num_epochs: int = int(os.environ.get("ZY_NUM_EPOCHS", "5"))
    learning_rate: float = float(os.environ.get("ZY_LR", "1e-5"))
    max_seq_len: int = int(os.environ.get("ZY_MAX_SEQ_LEN", "4096"))
    per_device_bsz: int = int(os.environ.get("ZY_PER_DEVICE_BSZ", "1"))
    grad_accum: int = int(os.environ.get("ZY_GRAD_ACCUM", "8"))
    save_steps: int = int(os.environ.get("ZY_SAVE_STEPS", "100"))
    logging_steps: int = int(os.environ.get("ZY_LOGGING_STEPS", "5"))
    report_every: int = int(os.environ.get("ZY_REPORT_EVERY_STEPS", "5"))
    map_num_proc: int = int(os.environ.get("ZY_MAP_NUM_PROC", "1"))
    seed: int = int(os.environ.get("ZY_SEED", "42"))

    def __post_init__(self):
        if not self.data_path:
            self.data_path = os.environ.get(
                "ZY_DATA_PATH",
                str(Path(self.train_data_root) / "processed" / "coding-sft.jsonl"),
            )
        if not self.output_dir:
            self.output_dir = os.environ.get(
                "ZY_OUTPUT_DIR",
                str(Path(self.train_data_root) / "checkpoints" / "zy_coding_v1"),
            )


# ════════════════════════════════════════════════════
# stdout 协议: 让 watch-training-output.sh 能解析进度
# ════════════════════════════════════════════════════

def emit_progress(step: int, total: int, loss: float, lr: float,
                  epoch: float, total_epochs: int, throughput: float = 0.0):
    """ZY_PROGRESS 协议输出（与母模型 progress-reporter.sh 解析格式一致）"""
    line = (f"ZY_PROGRESS step={step} total={total} "
            f"loss={loss:.4f} lr={lr:.2e} "
            f"epoch={epoch:.2f} total_epochs={total_epochs} "
            f"thr={throughput:.2f}")
    print(line, flush=True)


# ════════════════════════════════════════════════════
# 数据加载 + label mask
# ════════════════════════════════════════════════════

def load_sft_jsonl(path: str) -> list[dict]:
    """读 JSONL, 每行格式:
    {
      "messages": [
        {"role": "system", "content": "..."},
        {"role": "user", "content": "..."},
        {"role": "assistant", "content": "..."}
      ],
      "source": "evolution-line | repo-manual | bingshuo-zhuyuan-dialog | ...",
      "weight": 1.0  // 可选, 用于不同语料源的损失加权
    }
    """
    samples = []
    with open(path, "r", encoding="utf-8") as f:
        for ln, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"[load_sft_jsonl] WARN: line {ln} invalid JSON: {e}", file=sys.stderr)
                continue
            if not isinstance(obj.get("messages"), list) or not obj["messages"]:
                continue
            samples.append(obj)
    print(f"[load_sft_jsonl] loaded {len(samples)} samples from {path}", flush=True)
    return samples


def build_assistant_mask(tokenizer, full_ids: list[int]) -> list[int]:
    """
    用 token-id 直接扫描的方式找 assistant 段, 把这些位置的 label 保留,
    其余位置置 -100。

    ⚠️ D70 硬规则: 不能用"两次 apply_chat_template 比前缀长度差"。
    Qwen2.5 chat_template 会系统性错位。这里完全沿用母模型 train.py 的算法,
    只是签名稍简化。

    Qwen2.5 ChatML 标记:
      <|im_start|>assistant\n  ... <|im_end|>
    """
    # ⚠️ 类型守门: 强制 list[int], 防 BatchEncoding 越界
    full_ids = list(full_ids)

    im_start_id = tokenizer.convert_tokens_to_ids("<|im_start|>")
    im_end_id = tokenizer.convert_tokens_to_ids("<|im_end|>")
    # "assistant\n" 在 Qwen 词表中的 id 序列
    assistant_marker = tokenizer.encode("assistant\n", add_special_tokens=False)

    labels = [-100] * len(full_ids)
    i = 0
    n = len(full_ids)
    while i < n:
        if full_ids[i] != im_start_id:
            i += 1
            continue
        # 检查 i+1 ~ i+1+len(assistant_marker) 是否匹配
        j = i + 1
        if j + len(assistant_marker) > n:
            i += 1
            continue
        if full_ids[j: j + len(assistant_marker)] != assistant_marker:
            i += 1
            continue
        # 找到 assistant 段起点, 扫到 <|im_end|>
        start = j + len(assistant_marker)
        end = start
        while end < n and full_ids[end] != im_end_id:
            end += 1
        # 把 [start, end) 区间的 label 设回原 token (含 <|im_end|> 也算, 让模型学会终止)
        end_inclusive = min(end + 1, n)
        for k in range(start, end_inclusive):
            labels[k] = full_ids[k]
        i = end_inclusive
    return labels


def encode_one(sample: dict, tokenizer, max_seq_len: int) -> dict | None:
    """单条样本编码: messages → input_ids + labels (assistant-only)"""
    messages = sample["messages"]
    # apply_chat_template 一次拿到 token ids
    enc = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=False,
        return_tensors=None,
    )
    full_ids = list(enc)  # ⚠️ 类型守门
    if len(full_ids) > max_seq_len:
        # 截断（保留前段, 因为系统提示和 user 在前）
        full_ids = full_ids[:max_seq_len]

    labels = build_assistant_mask(tokenizer, full_ids)

    # 检验: 至少要有 1 个非 -100 标签
    if all(l == -100 for l in labels):
        return None  # 丢弃: 这条样本 mask 后没有可学的 token

    return {
        "input_ids": full_ids,
        "labels": labels,
        "attention_mask": [1] * len(full_ids),
    }


def build_dataset(samples: list[dict], tokenizer, max_seq_len: int, num_proc: int) -> Dataset:
    raw = Dataset.from_list(samples)

    def _map_fn(s):
        out = encode_one(s, tokenizer, max_seq_len)
        if out is None:
            return {"input_ids": [], "labels": [], "attention_mask": []}
        return out

    ds = raw.map(
        _map_fn,
        num_proc=num_proc,
        remove_columns=raw.column_names,
        desc="encode",
    )
    # 过滤掉空样本
    before = len(ds)
    ds = ds.filter(lambda x: len(x["input_ids"]) > 0)
    after = len(ds)
    print(f"[build_dataset] filtered {before} -> {after} (dropped {before - after} mask-empty samples)",
          flush=True)
    if after == 0:
        raise RuntimeError(
            "全部样本 mask 后都没有可学 token. 检查 build_assistant_mask 是否和 chat_template 对齐 "
            "(D70 硬规则)."
        )
    return ds


# ════════════════════════════════════════════════════
# data collator: pad 到 batch 内最长
# ════════════════════════════════════════════════════

class PadCollator:
    def __init__(self, pad_token_id: int):
        self.pad_token_id = pad_token_id

    def __call__(self, features: list[dict]) -> dict:
        max_len = max(len(f["input_ids"]) for f in features)
        input_ids, labels, attention_mask = [], [], []
        for f in features:
            n = len(f["input_ids"])
            pad = max_len - n
            input_ids.append(f["input_ids"] + [self.pad_token_id] * pad)
            labels.append(f["labels"] + [-100] * pad)
            attention_mask.append(f["attention_mask"] + [0] * pad)
        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
        }


# ════════════════════════════════════════════════════
# Trainer 钩子: 进度协议输出
# ════════════════════════════════════════════════════

class ProgressEmitterCallback:
    """实现 transformers TrainerCallback 接口的最小子集, 在 on_log 时输出 ZY_PROGRESS."""
    def __init__(self, cfg: CodingTrainConfig, total_steps: int, total_epochs: int):
        self.cfg = cfg
        self.total_steps = total_steps
        self.total_epochs = total_epochs
        self.t0 = time.time()
        self.last_step = 0

    def __getattr__(self, name):
        # transformers 调用了一些我们不关心的钩子, 默认 no-op
        if name.startswith("on_"):
            return lambda *a, **kw: None
        raise AttributeError(name)

    def on_log(self, args, state, control, logs=None, **kwargs):
        if not logs:
            return
        step = state.global_step
        if step <= self.last_step:
            return
        if (step - self.last_step) < self.cfg.report_every and step != self.total_steps:
            return
        self.last_step = step
        loss = logs.get("loss") or logs.get("train_loss") or 0.0
        lr = logs.get("learning_rate") or 0.0
        epoch = state.epoch or 0.0
        elapsed = time.time() - self.t0
        thr = step / elapsed if elapsed > 0 else 0.0
        emit_progress(step, self.total_steps, loss, lr, epoch, self.total_epochs, thr)


# ════════════════════════════════════════════════════
# 主流程
# ════════════════════════════════════════════════════

def main():
    cfg = CodingTrainConfig()
    set_seed(cfg.seed)

    print("═" * 60, flush=True)
    print("铸渊编程模型 SFT · train_coding.py", flush=True)
    print(f"  base_model_dir = {cfg.base_model_dir}", flush=True)
    print(f"  data_path      = {cfg.data_path}", flush=True)
    print(f"  output_dir     = {cfg.output_dir}", flush=True)
    print(f"  ds_config      = {cfg.ds_config}", flush=True)
    print(f"  num_epochs     = {cfg.num_epochs}", flush=True)
    print(f"  lr             = {cfg.learning_rate}", flush=True)
    print(f"  max_seq_len    = {cfg.max_seq_len}", flush=True)
    print(f"  per_device_bsz = {cfg.per_device_bsz}", flush=True)
    print(f"  grad_accum     = {cfg.grad_accum}", flush=True)
    print(f"  map_num_proc   = {cfg.map_num_proc}", flush=True)
    print("═" * 60, flush=True)

    # ── 加载 tokenizer + model ──
    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model_dir, trust_remote_code=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        cfg.base_model_dir,
        torch_dtype=torch.float16,  # V100 不支持 bf16
        trust_remote_code=True,
    )
    model.gradient_checkpointing_enable()
    model.config.use_cache = False  # 训练时必须关

    # ── 构造数据集 ──
    samples = load_sft_jsonl(cfg.data_path)
    if not samples:
        raise RuntimeError(f"no samples found in {cfg.data_path}")
    train_ds = build_dataset(samples, tokenizer, cfg.max_seq_len, cfg.map_num_proc)

    # ── 估算 total_steps ──
    n = len(train_ds)
    world_size = int(os.environ.get("WORLD_SIZE", "1"))
    effective_bsz = cfg.per_device_bsz * world_size * cfg.grad_accum
    steps_per_epoch = max(1, math.ceil(n / effective_bsz))
    total_steps = steps_per_epoch * cfg.num_epochs
    print(f"[main] n={n} world_size={world_size} effective_bsz={effective_bsz} "
          f"steps_per_epoch={steps_per_epoch} total_steps={total_steps}", flush=True)

    # ── TrainingArguments ──
    args = TrainingArguments(
        output_dir=cfg.output_dir,
        num_train_epochs=cfg.num_epochs,
        per_device_train_batch_size=cfg.per_device_bsz,
        gradient_accumulation_steps=cfg.grad_accum,
        learning_rate=cfg.learning_rate,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        weight_decay=0.0,
        logging_steps=cfg.logging_steps,
        save_steps=cfg.save_steps,
        save_total_limit=3,
        fp16=True,
        bf16=False,
        gradient_checkpointing=True,
        deepspeed=cfg.ds_config,
        report_to=[],  # 不上报 wandb / tensorboard, 用 stdout 协议
        seed=cfg.seed,
        ddp_find_unused_parameters=False,
        remove_unused_columns=False,
    )

    # ── Trainer ──
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        data_collator=PadCollator(tokenizer.pad_token_id),
        callbacks=[ProgressEmitterCallback(cfg, total_steps, cfg.num_epochs)],
    )

    # ── 训练 ──
    emit_progress(0, total_steps, 0.0, cfg.learning_rate, 0.0, cfg.num_epochs, 0.0)
    trainer.train()

    # ── 保存 ──
    trainer.save_model(cfg.output_dir + "/final")
    tokenizer.save_pretrained(cfg.output_dir + "/final")
    print(f"[main] ✅ 训练完成, 模型已保存到 {cfg.output_dir}/final", flush=True)


if __name__ == "__main__":
    main()
