#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# 训练启动脚本占位 · start-training.sh
# ═══════════════════════════════════════════════════════════
# 签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
#
# 在 GPU 训练机上执行。本脚本是真实训练器的最小骨架占位，
# 它只做三件事:
#   1. 切阶段为 training，往仓库 README 上报「训练已启动」
#   2. 调用 train.py（如果存在）— 真实的 SFT 由 train.py 实现
#   3. 训练每 N 步在训练侧 print "ZY_PROGRESS step=… loss=…"
#      由 watcher.py 解析后转发给 progress-reporter.sh
#
# 真实 train.py + watcher.py 由后续 PR 落地（Qwen2.5-7B + Accelerate + DeepSpeed）。
# 本脚本提供:
#   - 标准的 tmux session 起停约定（zy-train）
#   - .env 加载
#   - bootstrap → training → done 状态切换
#
# 用法:
#   bash start-training.sh           # 前台跑（调试）
#   bash start-training.sh --tmux    # 后台 tmux 跑（生产）
#   bash start-training.sh --stop    # 停止训练
# ═══════════════════════════════════════════════════════════

set -uo pipefail

ROOT="${ZY_TRAIN_ROOT:-/opt/guanghu/training}"
ENV_FILE="$ROOT/.env"
SESSION="zy-train"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ 找不到 $ENV_FILE，请先跑 setup.sh" >&2
  exit 2
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

REPORTER="$ROOT/progress-reporter.sh"

# ── --stop ──
if [[ "${1:-}" == "--stop" ]]; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux kill-session -t "$SESSION"
    echo "preprocessing" > "$ROOT/.phase"
    "$REPORTER" "preprocessing" "训练已停止" "" "Training stopped by operator on $(hostname)"
    echo "✅ 训练已停止"
  else
    echo "⚠️ 没有运行中的 tmux session $SESSION"
  fi
  exit 0
fi

# ── --tmux ──
if [[ "${1:-}" == "--tmux" ]]; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "⚠️ tmux session $SESSION 已存在 · 先 --stop 再启动"
    exit 1
  fi
  tmux new-session -d -s "$SESSION" "bash $ROOT/start-training.sh 2>&1 | tee -a $ROOT/training.log"
  echo "✅ tmux session $SESSION 已启动 · 日志: $ROOT/training.log"
  echo "  附加: tmux attach -t $SESSION"
  exit 0
fi

# ── 前台执行 ──
echo "training" > "$ROOT/.phase"
"$REPORTER" "training" "训练启动 · 进入主循环" "" "start-training.sh launched on $(hostname)"

# 真实训练入口
TRAIN_PY="$ROOT/train.py"
DATA_DIR="${ZY_TRAIN_DATA:-/data/guanghu}"
SFT_PATH="${ZY_DATA_PATH:-$DATA_DIR/processed/sft.jsonl}"
MODEL_PATH="${ZY_MODEL_DIR:-$DATA_DIR/models/Qwen2.5-7B}"

# 前置校验 — 缺哪样就立刻上报错误并退出
if [[ ! -f "$TRAIN_PY" ]]; then
  "$REPORTER" "error" "train.py 缺失" "" "$TRAIN_PY not found — bootstrap 未跑或脚本未同步"
  echo "❌ $TRAIN_PY 不存在" >&2
  exit 2
fi
if [[ ! -d "$MODEL_PATH" ]]; then
  "$REPORTER" "error" "模型缺失" "" "Qwen2.5-7B 未在 $MODEL_PATH — 重跑 bootstrap"
  echo "❌ 模型目录不存在: $MODEL_PATH" >&2
  exit 3
fi
if [[ ! -f "$SFT_PATH" ]]; then
  "$REPORTER" "error" "训练数据缺失" "" "$SFT_PATH not found — preprocess 未跑"
  echo "❌ 训练数据不存在: $SFT_PATH" >&2
  exit 4
fi

# 自动探测 GPU 数 (fallback 4)
NUM_GPUS=$(nvidia-smi --list-gpus 2>/dev/null | wc -l)
NUM_GPUS=${NUM_GPUS:-4}
[[ "$NUM_GPUS" -lt 1 ]] && NUM_GPUS=1
echo "[start-training] 使用 ${NUM_GPUS} 卡 启动 deepspeed"
"$REPORTER" "training" "DeepSpeed 启动 (${NUM_GPUS}×GPU)" "" "deepspeed --num_gpus=${NUM_GPUS} train.py"

# shellcheck disable=SC1091
source "$ROOT/venv/bin/activate"
cd "$ROOT"
# stdbuf 让 python 输出立即可见,管道到 watcher 解析后转发给 progress-reporter
exec stdbuf -oL -eL deepspeed --num_gpus="${NUM_GPUS}" "$TRAIN_PY" 2>&1 \
  | "$ROOT/watch-training-output.sh"
