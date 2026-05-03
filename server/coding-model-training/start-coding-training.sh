#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# 铸渊编程模型训练 · start-coding-training.sh
# ═══════════════════════════════════════════════════════════
# 签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
#
# 在 V100×4 GPU 机上启动编程模型 SFT 训练.
# 默认在 tmux 会话 "zy-coding-train" 里跑, 这样 SSH 断开训练继续.
#
# 用法:
#   bash start-coding-training.sh           # 前台跑 (workflow 调用)
#   bash start-coding-training.sh --tmux    # 在 tmux 里跑 (推荐, 冰朔本地启动用)
# ═══════════════════════════════════════════════════════════

set -euo pipefail

ROOT="${ZY_CODING_TRAIN_ROOT:-/opt/guanghu/coding-training}"
DATA_DIR="${ZY_CODING_TRAIN_DATA:-/data/guanghu-coding}"
MOTHER_VENV="${ZY_MOTHER_VENV:-/opt/guanghu/training/.venv}"
LOG_FILE="$DATA_DIR/logs/train-$(date +%Y%m%d-%H%M%S).log"

USE_TMUX=0
if [[ "${1:-}" == "--tmux" ]]; then
    USE_TMUX=1
fi

# 校验
if [[ ! -f "$DATA_DIR/processed/coding-sft.jsonl" ]]; then
    echo "❌ 训练语料 $DATA_DIR/processed/coding-sft.jsonl 不存在"
    echo "   请先跑 setup-coding.sh"
    exit 1
fi
if [[ ! -d "$MOTHER_VENV" ]]; then
    echo "❌ venv $MOTHER_VENV 不存在"
    exit 1
fi
if [[ ! -f "$ROOT/train_coding.py" ]]; then
    echo "❌ $ROOT/train_coding.py 不存在"
    exit 1
fi

mkdir -p "$DATA_DIR/logs"

# 训练命令
TRAIN_CMD=(
    "$MOTHER_VENV/bin/deepspeed"
    --num_gpus=4
    "$ROOT/train_coding.py"
)

# 必需的环境变量
export ZY_CODING_TRAIN_DATA="$DATA_DIR"
export ZY_BASE_MODEL_DIR="${ZY_BASE_MODEL_DIR:-/data/guanghu/checkpoints/qwen2_5_7b_sft/best}"
export ZY_DATA_PATH="$DATA_DIR/processed/coding-sft.jsonl"
export ZY_OUTPUT_DIR="$DATA_DIR/checkpoints/zy_coding_v1"
export ZY_DS_CONFIG="$ROOT/configs/ds_zero3_offload.json"
export TOKENIZERS_PARALLELISM=false

echo "═══════════════════════════════════════════════════════════"
echo " 铸渊编程模型 SFT 启动"
echo "═══════════════════════════════════════════════════════════"
echo "  基座模型  : $ZY_BASE_MODEL_DIR"
echo "  训练数据  : $ZY_DATA_PATH"
echo "  输出目录  : $ZY_OUTPUT_DIR"
echo "  DS 配置   : $ZY_DS_CONFIG"
echo "  日志      : $LOG_FILE"
echo "  tmux 模式 : $([ $USE_TMUX -eq 1 ] && echo 是 || echo 否)"
echo "═══════════════════════════════════════════════════════════"

if [[ $USE_TMUX -eq 1 ]]; then
    if ! command -v tmux >/dev/null 2>&1; then
        echo "❌ tmux 未安装 (apt-get install tmux)"
        exit 1
    fi
    SESSION="zy-coding-train"
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        echo "⚠️ tmux session $SESSION 已存在. 旧会话:"
        tmux list-sessions -F '#{session_name} #{session_attached} #{session_created}' | grep "^$SESSION" || true
        echo "   要重新开始, 先跑: tmux kill-session -t $SESSION"
        exit 1
    fi
    # 在 tmux 里跑
    tmux new-session -d -s "$SESSION" -c "$ROOT" \
        "set -o pipefail; ${TRAIN_CMD[*]} 2>&1 | tee '$LOG_FILE'"
    echo "✅ 训练已在 tmux session '$SESSION' 中启动"
    echo "   查看日志:  tmux attach -t $SESSION  (Ctrl+B 然后 D 离开)"
    echo "   或:        tail -f $LOG_FILE"
else
    # 前台跑
    "${TRAIN_CMD[@]}" 2>&1 | tee "$LOG_FILE"
fi
