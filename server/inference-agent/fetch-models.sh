#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# AutoDL 推理机 · 拉模型 · fetch-models.sh
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 从腾讯云 COS (sy-finetune-corpus-1317346199 · ap-guangzhou) 拉
# 训练好的两个模型到 INFER_ROOT/models/:
#   - motherbrain-v1 (母模型, 人格本体)
#   - qwen2_5_coder_7b_sft (编程模型)
#
# 设计理念 (cc-001 · 涌现洁净):
#   AutoDL 关机即销毁, 重开机要重新拉模型 — 这不是"浪费", 这是
#   "新机器无残留" 的代价, 也是收益. 不要 rsync 上一台的缓存.
#
# 设计理念 (cc-004 · 强制自主):
#   coscli 不存在时自动装. SecretId/Key 来自 ZY_COS_SECRET_ID /
#   ZY_COS_SECRET_KEY 环境变量, 不入仓库, 不入日志.
#
# 用法:
#   ZY_COS_SECRET_ID=xxx ZY_COS_SECRET_KEY=yyy bash fetch-models.sh
#   bash fetch-models.sh --only mother   # 只拉母模型
#   bash fetch-models.sh --only coder    # 只拉编程模型
# ════════════════════════════════════════════════════════════════

set -euo pipefail

INFER_ROOT="${INFER_ROOT:-/root/inference}"
MODELS_ROOT="$INFER_ROOT/models"
COS_BUCKET="${COS_BUCKET:-sy-finetune-corpus-1317346199}"
COS_REGION="${COS_REGION:-ap-guangzhou}"
COS_PREFIX="${COS_PREFIX:-checkpoints}"

ONLY=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --only) ONLY="$2"; shift 2 ;;
    -h|--help) sed -n '1,40p' "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

# ─── 校验密钥 ────────────────────────────────────────────────
if [ -z "${ZY_COS_SECRET_ID:-}" ] || [ -z "${ZY_COS_SECRET_KEY:-}" ]; then
  echo "❌ [fetch] 缺密钥: 需要 ZY_COS_SECRET_ID 和 ZY_COS_SECRET_KEY" >&2
  echo "         export ZY_COS_SECRET_ID=xxx" >&2
  echo "         export ZY_COS_SECRET_KEY=yyy" >&2
  echo "         (从冰朔的腾讯云控制台 → 访问管理 → API 密钥)" >&2
  exit 1
fi

mkdir -p "$MODELS_ROOT"

# ─── 装 coscli (只在缺时装) ──────────────────────────────────
COSCLI="$(command -v coscli || true)"
if [ -z "$COSCLI" ]; then
  echo "[1/3] coscli 不在, 开始装 ..."
  COSCLI_BIN="/usr/local/bin/coscli"
  COSCLI_VERSION="${COSCLI_VERSION:-v1.0.4}"
  COSCLI_URL="https://github.com/tencentyun/coscli/releases/download/${COSCLI_VERSION}/coscli-linux-amd64"
  if ! curl -fsSL --max-time 60 -o "$COSCLI_BIN" "$COSCLI_URL"; then
    echo "❌ coscli 下载失败 ($COSCLI_URL)" >&2
    echo "   AutoDL 内对 GitHub 不一定快, 可考虑 pip install coscmd 替代" >&2
    exit 1
  fi
  chmod +x "$COSCLI_BIN"
  COSCLI="$COSCLI_BIN"
fi

# ─── 配 coscli ───────────────────────────────────────────────
COSCLI_CFG="${HOME}/.cos.yaml"
umask 077
cat > "$COSCLI_CFG" <<EOF
cos:
  base:
    secretid: ${ZY_COS_SECRET_ID}
    secretkey: ${ZY_COS_SECRET_KEY}
    sessiontoken: ""
    protocol: https
  buckets:
    - name: ${COS_BUCKET}
      alias: corpus
      region: ${COS_REGION}
      endpoint: ""
EOF
chmod 600 "$COSCLI_CFG"

# 失败/退出时清理含密钥的配置
trap 'rm -f "$COSCLI_CFG"' EXIT

# ─── 拉模型 ──────────────────────────────────────────────────
fetch_one() {
  local model_name="$1"
  local local_dir="$MODELS_ROOT/$model_name"
  echo "[fetch] ↓ $model_name → $local_dir"
  mkdir -p "$local_dir"
  if ! "$COSCLI" sync \
        "cos://corpus/${COS_PREFIX}/${model_name}/" \
        "$local_dir/" \
        --recursive \
        --config-path "$COSCLI_CFG" 2>&1; then
    echo "❌ [fetch] $model_name 同步失败" >&2
    return 1
  fi
  # 简易完整性校验: 至少有 config.json + 一个权重文件
  if [ ! -f "$local_dir/config.json" ]; then
    echo "❌ [fetch] $local_dir/config.json 缺失, 模型不完整" >&2
    return 1
  fi
  if ! ls "$local_dir"/*.safetensors "$local_dir"/*.bin 2>/dev/null | head -n1 | grep -q .; then
    echo "❌ [fetch] $local_dir 没有 .safetensors / .bin 权重文件" >&2
    return 1
  fi
  local size
  size="$(du -sh "$local_dir" 2>/dev/null | awk '{print $1}')"
  echo "  ✅ $model_name 完整 · $size"
}

OK_LIST=""
FAIL_LIST=""

if [ -z "$ONLY" ] || [ "$ONLY" = "mother" ]; then
  if fetch_one "motherbrain-v1"; then OK_LIST="$OK_LIST motherbrain-v1"; else FAIL_LIST="$FAIL_LIST motherbrain-v1"; fi
fi
if [ -z "$ONLY" ] || [ "$ONLY" = "coder" ]; then
  if fetch_one "qwen2_5_coder_7b_sft"; then OK_LIST="$OK_LIST qwen2_5_coder_7b_sft"; else FAIL_LIST="$FAIL_LIST qwen2_5_coder_7b_sft"; fi
fi

# ─── 中文回执 ────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  [fetch-models] 模型拉取结果"
echo "═══════════════════════════════════════════════════════════"
[ -n "$OK_LIST" ]   && echo "  ✅ 已就位:$OK_LIST"
[ -n "$FAIL_LIST" ] && echo "  ❌ 失败  :$FAIL_LIST"
echo "  📂 目录: $MODELS_ROOT"
echo "═══════════════════════════════════════════════════════════"

[ -z "$FAIL_LIST" ]
