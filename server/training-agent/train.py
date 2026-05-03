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
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

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

IGNORE_INDEX = -100


def is_main_process() -> bool:
    return int(os.environ.get("LOCAL_RANK", "0")) == 0


def log(msg: str):
    if is_main_process():
        print(msg, flush=True)


# ── 数据加载 + 模板化 ──

def build_dataset(tokenizer):
    if not DATA_PATH.is_file():
        raise FileNotFoundError(f"训练数据不存在: {DATA_PATH} · 请先跑 preprocess-corpus.py")

    log(f"[train] 加载数据: {DATA_PATH}")
    raw = load_dataset("json", data_files=str(DATA_PATH), split="train")
    log(f"[train] 样本数: {len(raw)}")

    def encode(example: dict[str, Any]) -> dict[str, list[int]]:
        msgs = example["messages"]
        # apply_chat_template 会按 Qwen2.5 ChatML 格式化, 包括 system/user/assistant
        # 用 tokenize=True 一次性拿 ids；同时建 labels 让 user 段不参与 loss
        full_ids = tokenizer.apply_chat_template(
            msgs, tokenize=True, add_generation_prompt=False,
            truncation=True, max_length=MAX_SEQ_LEN,
        )
        # 构建 mask: 仅 assistant 段算 loss
        labels = [IGNORE_INDEX] * len(full_ids)
        # 重新逐段定位 assistant 区间
        prefix_ids: list[int] = []
        for i, m in enumerate(msgs):
            include_assistant = (m["role"] == "assistant")
            partial = msgs[: i + 1]
            cur_ids = tokenizer.apply_chat_template(
                partial, tokenize=True, add_generation_prompt=False,
                truncation=True, max_length=MAX_SEQ_LEN,
            )
            seg_start = len(prefix_ids)
            seg_end = min(len(cur_ids), len(full_ids))
            if include_assistant and seg_start < seg_end:
                for k in range(seg_start, seg_end):
                    labels[k] = full_ids[k]
            prefix_ids = cur_ids
            if seg_end >= len(full_ids):
                break
        return {"input_ids": full_ids, "labels": labels, "attention_mask": [1] * len(full_ids)}

    cols = raw.column_names
    ds = raw.map(encode, remove_columns=cols, num_proc=max(1, (os.cpu_count() or 4) // 2))
    # 过滤掉没有 assistant token 的样本
    ds = ds.filter(lambda ex: any(l != IGNORE_INDEX for l in ex["labels"]))
    log(f"[train] 有效样本: {len(ds)}")
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
        torch_dtype=torch.float16,
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
