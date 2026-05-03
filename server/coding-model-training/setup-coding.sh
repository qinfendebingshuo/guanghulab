#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# 铸渊编程模型训练机 · setup-coding.sh
# ═══════════════════════════════════════════════════════════
# 签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
#
# 在已经跑过母模型 (server/training-agent/setup.sh) 的同一台 GPU 机
# (zy-gpu-train · 119.45.160.137 · V100×4) 上准备编程模型训练环境。
#
# 复用母模型的:
#   - Python venv (/opt/guanghu/training/.venv)
#   - DeepSpeed / transformers / datasets
#   - coscmd
#
# 编程模型独立的:
#   - 数据根: /data/guanghu-coding (与母模型 /data/guanghu 隔离)
#   - 模型基座: 从母模型 SFT 产出复制, 不重新下载
#   - 输出: /data/guanghu-coding/checkpoints/zy_coding_v1
#
# 用法 (由 coding-model-train.yml 通过 SSH 调用):
#   sudo bash setup-coding.sh
#
# 必需环境变量 (写在 /opt/guanghu/coding-training/.env):
#   ZY_BASE_MODEL_DIR        母模型 SFT 产出路径 (默认 /data/guanghu/checkpoints/qwen2_5_7b_sft/best)
#   ZY_BINGSHUO_DIALOG_ZIP   冰朔×铸渊对话 ZIP 路径 (会解压到 raw/bingshuo-dialog/)
#                            可不提供, 但产物质量会下降
#   GH_REPO_OWNER            qinfendebingshuo
#   GH_REPO_NAME             guanghulab
#   GH_REPO_BRANCH           main
# ═══════════════════════════════════════════════════════════

set -euo pipefail

ROOT="${ZY_CODING_TRAIN_ROOT:-/opt/guanghu/coding-training}"
DATA_DIR="${ZY_CODING_TRAIN_DATA:-/data/guanghu-coding}"
ENV_FILE="$ROOT/.env"
MOTHER_VENV="${ZY_MOTHER_VENV:-/opt/guanghu/training/.venv}"
MOTHER_BASE_MODEL="${ZY_BASE_MODEL_DIR:-/data/guanghu/checkpoints/qwen2_5_7b_sft/best}"

echo "═════════════════════════════════════════"
echo " 铸渊编程模型训练机 · setup-coding.sh"
echo "═════════════════════════════════════════"
echo " ROOT      = $ROOT"
echo " DATA_DIR  = $DATA_DIR"
echo " VENV      = $MOTHER_VENV (复用母模型)"
echo " 基座模型  = $MOTHER_BASE_MODEL"
echo "═════════════════════════════════════════"

# ── Step 1: 检查母模型环境 ──
echo "[1/6] 检查母模型 venv..."
if [[ ! -d "$MOTHER_VENV" ]]; then
    echo "❌ 母模型 venv 不存在: $MOTHER_VENV"
    echo "   请先在本机跑 server/training-agent/setup.sh 准备母模型环境。"
    exit 1
fi
echo "  ✅ venv 存在"

echo "[2/6] 检查母模型 SFT 产出..."
if [[ ! -d "$MOTHER_BASE_MODEL" ]]; then
    echo "❌ 母模型 SFT 产出不存在: $MOTHER_BASE_MODEL"
    echo "   编程模型训练必须以母模型为基座. 请先完成母模型训练."
    exit 1
fi
# 验证有 config.json + model.safetensors / pytorch_model.bin
if [[ ! -f "$MOTHER_BASE_MODEL/config.json" ]]; then
    echo "❌ $MOTHER_BASE_MODEL/config.json 缺失, 不像是有效的 transformers 模型目录"
    exit 1
fi
echo "  ✅ 母模型基座可用"

# ── Step 3: 创建目录 ──
echo "[3/6] 创建目录树..."
sudo mkdir -p "$ROOT" "$DATA_DIR/raw/bingshuo-dialog" "$DATA_DIR/processed" "$DATA_DIR/checkpoints" "$DATA_DIR/logs"
sudo chown -R "$(id -u):$(id -g)" "$ROOT" "$DATA_DIR"
echo "  ✅ 目录就绪"

# ── Step 4: 拉仓库脚本 ──
echo "[4/6] 同步训练脚本到 $ROOT ..."
# 假定 SCP 已经把 server/coding-model-training/ 的文件拷贝到 $ROOT
# (由 GitHub workflow 在外部 SCP, 本脚本只校验)
for f in train_coding.py build_coding_corpus.py start-coding-training.sh configs/ds_zero3_offload.json; do
    if [[ ! -f "$ROOT/$f" ]]; then
        echo "❌ 必需文件 $ROOT/$f 缺失. 应由 workflow SCP 提供."
        exit 1
    fi
done
chmod +x "$ROOT/start-coding-training.sh"
echo "  ✅ 脚本就绪"

# ── Step 5: 解压冰朔×铸渊对话 ZIP (如果有) ──
echo "[5/6] 处理对话 ZIP..."
if [[ -n "${ZY_BINGSHUO_DIALOG_ZIP:-}" ]] && [[ -f "$ZY_BINGSHUO_DIALOG_ZIP" ]]; then
    echo "  解压 $ZY_BINGSHUO_DIALOG_ZIP → $DATA_DIR/raw/bingshuo-dialog/"
    unzip -oq "$ZY_BINGSHUO_DIALOG_ZIP" -d "$DATA_DIR/raw/bingshuo-dialog/"
    md_count=$(find "$DATA_DIR/raw/bingshuo-dialog/" -name "*.md" | wc -l)
    echo "  ✅ 解压完成, $md_count 个 .md 文件"
else
    echo "  ⚠️ 未提供 ZY_BINGSHUO_DIALOG_ZIP, 跳过 (训练仍可进行, 但只有灵魂语料 + corpus)"
fi

# ── Step 6: 跑语料构建器 ──
echo "[6/6] 构建训练语料..."
cd "$ROOT"
ZY_CODING_TRAIN_DATA="$DATA_DIR" \
ZY_REPO_ROOT="${ZY_REPO_ROOT:-$ROOT/repo}" \
ZY_BINGSHUO_DIALOG_DIR="$DATA_DIR/raw/bingshuo-dialog" \
"$MOTHER_VENV/bin/python" "$ROOT/build_coding_corpus.py" 2>&1 | tee "$DATA_DIR/logs/build-corpus.log"

samples_count=$(wc -l < "$DATA_DIR/processed/coding-sft.jsonl" || echo 0)
echo ""
echo "═════════════════════════════════════════"
echo " ✅ 编程模型训练机就绪"
echo "═════════════════════════════════════════"
echo " 数据根    : $DATA_DIR"
echo " 训练语料  : $DATA_DIR/processed/coding-sft.jsonl"
echo " 样本数    : $samples_count"
echo " 输出目录  : $DATA_DIR/checkpoints/zy_coding_v1"
echo ""
echo " 下一步: 运行 start-coding-training.sh 启动训练"
echo "═════════════════════════════════════════"
