#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# GPU 训练机一键 Bootstrap · setup.sh
# ═══════════════════════════════════════════════════════════
# 签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
#
# 在 zy-gpu-train (119.45.160.137 · Ubuntu 22.04 · V100×4) 上跑。
# 安装系统依赖 / Python / 训练栈 / coscmd → 准备好即可启动训练。
#
# 用法:
#   sudo bash setup.sh
#
# 必需环境变量（由 training-bootstrap.yml 通过 SSH 写入到
#   /opt/guanghu/training/.env，或冰朔本地 export）:
#
#   ZY_COS_SECRET_ID         腾讯云 SecretId
#   ZY_COS_SECRET_KEY        腾讯云 SecretKey
#   ZY_COS_BUCKET            sy-finetune-corpus-1317346199
#   ZY_COS_REGION            ap-guangzhou
#   GH_REPO_OWNER            qinfendebingshuo
#   GH_REPO_NAME             guanghulab
#   GH_DISPATCH_TOKEN        ZY_DISPATCH_TOKEN（用于 progress-reporter 回报）
#
# 不会启动训练 — 只做环境准备。启动训练用 start-training.sh。
# ═══════════════════════════════════════════════════════════

set -euo pipefail

ROOT="${ZY_TRAIN_ROOT:-/opt/guanghu/training}"
DATA_DIR="${ZY_TRAIN_DATA:-/data/guanghu}"
ENV_FILE="$ROOT/.env"

REPORTER="$ROOT/progress-reporter.sh"
report() {
  if [[ -x "$REPORTER" ]] && [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
    "$REPORTER" "$@" || true
  fi
}

echo "═══════════════════════════════════════════"
echo "🛠️ 铸渊 · GPU 训练机 Bootstrap 开始"
echo "时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════"

# ── 加载 .env ──
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# ── 校验关键环境变量 ──
REQUIRED=(ZY_COS_SECRET_ID ZY_COS_SECRET_KEY ZY_COS_BUCKET ZY_COS_REGION GH_REPO_OWNER GH_REPO_NAME GH_DISPATCH_TOKEN)
for v in "${REQUIRED[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "❌ 必需环境变量 $v 未设置（检查 $ENV_FILE）" >&2
    exit 2
  fi
done

mkdir -p "$ROOT" "$DATA_DIR/raw" "$DATA_DIR/processed" "$DATA_DIR/checkpoints" "$DATA_DIR/eval"

report "bootstrapping" "环境配置开始" "" "Bootstrap started on $(hostname)"

# ── 1. 系统依赖 ──
echo "═══ 1/5 · 系统依赖 ═══"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  python3 python3-pip python3-venv \
  git curl wget unzip jq tmux htop \
  build-essential ca-certificates

report "bootstrapping" "系统依赖完成" "" "apt 包安装完成"

# ── 2. Python venv + 训练栈 ──
echo "═══ 2/5 · Python 训练栈 ═══"
if [[ ! -d "$ROOT/venv" ]]; then
  python3 -m venv "$ROOT/venv"
fi
# shellcheck disable=SC1091
source "$ROOT/venv/bin/activate"
pip install --upgrade pip wheel setuptools

# torch 走 CUDA 12.1 wheel（最接近 12.8 的 stable）
pip install --index-url https://download.pytorch.org/whl/cu121 \
  torch==2.4.1 torchvision torchaudio || \
  pip install torch==2.4.1 torchvision torchaudio

pip install \
  "transformers>=4.45.0" \
  "accelerate>=0.34.0" \
  "datasets>=2.21.0" \
  "peft>=0.13.0" \
  "deepspeed>=0.15.0" \
  "sentencepiece" \
  "protobuf" \
  "tqdm" \
  "tensorboard" \
  "coscmd"

deactivate
report "bootstrapping" "Python 训练栈完成" "" "torch + transformers + accelerate + deepspeed 安装完成"

# ── 3. coscmd 配置 ──
echo "═══ 3/5 · coscmd 配置 ═══"
"$ROOT/venv/bin/coscmd" config \
  -a "$ZY_COS_SECRET_ID" \
  -s "$ZY_COS_SECRET_KEY" \
  -b "$ZY_COS_BUCKET" \
  -r "$ZY_COS_REGION"

# 用内网域名（南京 GPU → 广州 COS 走内网，免费且快）
sed -i 's/myqcloud.com/myqcloud.com/' "$HOME/.cos.conf" 2>/dev/null || true
report "bootstrapping" "COS 客户端配置完成" "" "coscmd configured for $ZY_COS_BUCKET ($ZY_COS_REGION)"

# ── 4. 拉取语料 ──
echo "═══ 4/5 · 下载语料 ═══"
report "downloading-corpus" "拉取 raw/ 目录" "" "coscmd download raw/ → $DATA_DIR/raw"
"$ROOT/venv/bin/coscmd" download -rs "raw/" "$DATA_DIR/raw/"

# 统计
RAW_COUNT=$(find "$DATA_DIR/raw" -type f | wc -l)
echo "raw 文件数: $RAW_COUNT"
report "downloading-corpus" "语料下载完成" \
  "$(printf '{"step":0,"total_steps":0}')" \
  "raw=${RAW_COUNT} files downloaded to $DATA_DIR/raw"

# ── 5. 写入辅助脚本 ──
echo "═══ 5/5 · 安装训练辅助脚本 ═══"
chmod +x "$ROOT/progress-reporter.sh" "$ROOT/start-training.sh" 2>/dev/null || true

cat > /etc/cron.d/zy-training-heartbeat <<'CRON'
# 铸渊副将 · 训练心跳兜底（每 5 分钟即使训练脚本崩了也能上报 GPU 状态）
*/5 * * * * root [ -f /opt/guanghu/training/.env ] && /opt/guanghu/training/progress-reporter.sh "$(cat /opt/guanghu/training/.phase 2>/dev/null || echo idle)" "" "" "heartbeat" >/dev/null 2>&1
CRON

echo "═══════════════════════════════════════════"
echo "✅ Bootstrap 完成"
echo "  训练根目录: $ROOT"
echo "  数据目录: $DATA_DIR"
echo "  下一步: bash $ROOT/start-training.sh"
echo "═══════════════════════════════════════════"
report "preprocessing" "Bootstrap 完成 · 等待启动训练" \
  "$(printf '{"step":0,"total_steps":0}')" \
  "Bootstrap done on $(hostname). raw=${RAW_COUNT} files. Ready to start training."

# 记录当前阶段（给 cron heartbeat 用）
echo "preprocessing" > "$ROOT/.phase"
