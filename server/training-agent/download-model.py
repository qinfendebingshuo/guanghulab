#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════
开源模型下载器 · download-model.py
═══════════════════════════════════════════════════════════
签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559

从 ModelScope 拉 Qwen2.5-7B 到本地（国内服务器免梯子免限速，不依赖 HF Token）。
失败时自动回退到 HuggingFace。

输出:
  $ZY_TRAIN_DATA/models/Qwen2.5-7B/  (config.json, *.safetensors, tokenizer.* …)

环境:
  ZY_TRAIN_DATA   数据根目录 (默认 /data/guanghu)
  ZY_MODEL_ID     模型 ID (默认 qwen/Qwen2.5-7B)
  ZY_HF_FALLBACK  HF 回退仓库 (默认 Qwen/Qwen2.5-7B)
"""
from __future__ import annotations
import os
import sys
import shutil
import time
from pathlib import Path

DATA_DIR = Path(os.environ.get("ZY_TRAIN_DATA", "/data/guanghu"))
MODEL_ID = os.environ.get("ZY_MODEL_ID", "qwen/Qwen2.5-7B")
HF_FALLBACK = os.environ.get("ZY_HF_FALLBACK", "Qwen/Qwen2.5-7B")
TARGET_DIR = DATA_DIR / "models" / "Qwen2.5-7B"

REQUIRED_FILES = ["config.json", "tokenizer.json", "tokenizer_config.json"]


def already_present(target: Path) -> bool:
    if not target.is_dir():
        return False
    if not all((target / f).is_file() for f in REQUIRED_FILES):
        return False
    # 至少有一个权重 shard
    shards = list(target.glob("*.safetensors")) + list(target.glob("*.bin"))
    if not shards:
        return False
    total_gb = sum(p.stat().st_size for p in shards) / (1024**3)
    print(f"[download-model] 已存在: {target} · {len(shards)} shards · {total_gb:.2f} GiB", flush=True)
    return total_gb > 1.0  # Qwen2.5-7B safetensors 约 14-15GB


def download_modelscope(target: Path) -> bool:
    try:
        from modelscope import snapshot_download
    except Exception as e:
        print(f"[download-model] modelscope 不可用: {e}", flush=True)
        return False
    try:
        print(f"[download-model] ModelScope 拉取 {MODEL_ID} → {target}", flush=True)
        target.parent.mkdir(parents=True, exist_ok=True)
        local_dir = snapshot_download(
            model_id=MODEL_ID,
            cache_dir=str(DATA_DIR / "models" / ".modelscope-cache"),
            revision="master",
        )
        # snapshot_download 返回的实际路径，软链/复制到 target
        local_path = Path(local_dir)
        if target.exists():
            shutil.rmtree(target)
        # 优先用软链节省空间，回退到复制
        try:
            target.symlink_to(local_path, target_is_directory=True)
        except OSError:
            shutil.copytree(local_path, target)
        return True
    except Exception as e:
        print(f"[download-model] ModelScope 失败: {e}", flush=True)
        return False


def download_huggingface(target: Path) -> bool:
    try:
        from huggingface_hub import snapshot_download
    except Exception as e:
        print(f"[download-model] huggingface_hub 不可用: {e}", flush=True)
        return False
    try:
        print(f"[download-model] HuggingFace 拉取 {HF_FALLBACK} → {target}", flush=True)
        target.parent.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            repo_id=HF_FALLBACK,
            local_dir=str(target),
            local_dir_use_symlinks=False,
            allow_patterns=[
                "*.json", "*.txt", "*.model",
                "*.safetensors", "tokenizer*",
            ],
            max_workers=4,
        )
        return True
    except Exception as e:
        print(f"[download-model] HuggingFace 失败: {e}", flush=True)
        return False


def main() -> int:
    if already_present(TARGET_DIR):
        print(f"[download-model] ✅ 跳过下载 · 模型已就绪 · {TARGET_DIR}", flush=True)
        return 0

    started = time.time()

    if download_modelscope(TARGET_DIR) and already_present(TARGET_DIR):
        print(f"[download-model] ✅ ModelScope 下载完成 · {time.time()-started:.0f}s", flush=True)
        return 0

    print("[download-model] ⚠️ 改用 HuggingFace 回退路径", flush=True)
    if download_huggingface(TARGET_DIR) and already_present(TARGET_DIR):
        print(f"[download-model] ✅ HuggingFace 下载完成 · {time.time()-started:.0f}s", flush=True)
        return 0

    print("[download-model] ❌ 下载失败 · 请检查网络或手动放置模型到 " + str(TARGET_DIR), file=sys.stderr, flush=True)
    return 2


if __name__ == "__main__":
    sys.exit(main())
