#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# AutoDL 推理机 · 一键启动 · setup-inference.sh
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 服务器: GH-AUTODL-INFER-01 / ZY-SVR-GPU01 / AutoDL 共享 GPU
#
# 这一份是 AutoDL 实例开机后冰朔/Awen 复制粘贴一行就能跑起来的
# 一键脚本. 步骤:
#   1. detect-gpu.sh  → 探 GPU
#   2. tune-inference.sh → 决档 (fp16/int8/int4)
#   3. apt 装 jq + python venv 工具
#   4. 建 venv, pip 装 torch/transformers/uvicorn/fastapi/bitsandbytes (国内 mirror)
#   5. fetch-models.sh → 从 COS 拉模型 (ZY_COS_SECRET_ID/KEY 必须 export)
#   6. nohup 启动 server.py 后台跑
#   7. curl /v1/health 等就绪
#
# 用法 (在 AutoDL 实例上):
#   export ZY_COS_SECRET_ID=xxx
#   export ZY_COS_SECRET_KEY=yyy
#   bash setup-inference.sh
#
# 不重新执行已经完成的步骤 — 幂等. 重开机时再跑一次即可.
# ════════════════════════════════════════════════════════════════

set -euo pipefail

INFER_ROOT="${INFER_ROOT:-/root/inference}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${LOG_FILE:-$INFER_ROOT/server.log}"
PID_FILE="${PID_FILE:-$INFER_ROOT/server.pid}"
VENV_DIR="${VENV_DIR:-$INFER_ROOT/.venv}"

echo "═══════════════════════════════════════════════════════════"
echo "  [setup-inference] AutoDL 推理机一键启动"
echo "  守护: 铸渊 · ICE-GL-ZY001 · TCS-0002∞"
echo "═══════════════════════════════════════════════════════════"

mkdir -p "$INFER_ROOT"

# ─── 0. 复制脚本到 INFER_ROOT (AutoDL 重开机后实例代码丢失) ───
# 如果 setup 是从远程 curl|bash 下来的, SCRIPT_DIR 可能是 /tmp;
# 把全套脚本复制到 INFER_ROOT, 后续 systemd / cron 用 INFER_ROOT 路径稳定.
for f in detect-gpu.sh tune-inference.sh fetch-models.sh server.py requirements.txt; do
  if [ -f "$SCRIPT_DIR/$f" ] && [ "$SCRIPT_DIR/$f" != "$INFER_ROOT/$f" ]; then
    cp "$SCRIPT_DIR/$f" "$INFER_ROOT/$f"
  fi
done
chmod +x "$INFER_ROOT"/*.sh 2>/dev/null || true

# ─── 1. 装 apt 基础 (jq + python venv) ────────────────────────
echo "[1/7] 装基础工具 jq + python3-venv ..."
if ! command -v jq >/dev/null 2>&1 || ! python3 -c 'import venv' 2>/dev/null; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq || true
  apt-get install -y -qq jq python3-venv python3-pip || {
    echo "❌ apt 装基础失败 (AutoDL 应该有 root)" >&2
    exit 1
  }
fi

# ─── 2. detect-gpu ────────────────────────────────────────────
echo "[2/7] 探测 GPU ..."
bash "$INFER_ROOT/detect-gpu.sh" /tmp/gpu-env.json

# ─── 3. tune-inference ───────────────────────────────────────
echo "[3/7] 决策档位 ..."
INFER_ROOT="$INFER_ROOT" bash "$INFER_ROOT/tune-inference.sh"

# 读决档结果
# shellcheck disable=SC1091
. "$INFER_ROOT/.env.tune"

# ─── 4. venv + pip ────────────────────────────────────────────
echo "[4/7] 建 venv 并装 Python 依赖 (国内 mirror) ..."
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
. "$VENV_DIR/bin/activate"

# 国内 mirror, 不卡 pypi.org
PIP_INDEX="${PIP_INDEX:-https://mirrors.aliyun.com/pypi/simple/}"
PIP_HOST="${PIP_HOST:-mirrors.aliyun.com}"

pip install --quiet --upgrade pip wheel \
  -i "$PIP_INDEX" --trusted-host "$PIP_HOST"

if [ -f "$INFER_ROOT/requirements.txt" ]; then
  pip install --quiet -r "$INFER_ROOT/requirements.txt" \
    -i "$PIP_INDEX" --trusted-host "$PIP_HOST"
fi

# bitsandbytes 仅在量化档位需要
case "${QUANT:-fp16}" in
  int4|int8)
    pip install --quiet "bitsandbytes>=0.43.0" \
      -i "$PIP_INDEX" --trusted-host "$PIP_HOST" || {
        echo "⚠️  bitsandbytes 装不上, int4/int8 量化将不可用" >&2
      }
    ;;
esac

# vllm 仅在 USE_VLLM=true 时装
if [ "${USE_VLLM:-false}" = "true" ]; then
  pip install --quiet "vllm>=0.6.0" \
    -i "$PIP_INDEX" --trusted-host "$PIP_HOST" || {
      echo "⚠️  vllm 装不上, 回退 transformers 引擎" >&2
      sed -i 's/^USE_VLLM=.*/USE_VLLM="false"/'        "$INFER_ROOT/.env.tune"
      sed -i 's/^INFER_ENGINE=.*/INFER_ENGINE="transformers"/' "$INFER_ROOT/.env.tune"
    }
fi

# ─── 5. fetch-models ──────────────────────────────────────────
echo "[5/7] 拉模型 (motherbrain-v1 + qwen2_5_coder_7b_sft) ..."
if [ -d "${MOTHER_MODEL_PATH:-/root/inference/models/motherbrain-v1}" ] \
   && [ -f "${MOTHER_MODEL_PATH}/config.json" ] \
   && [ -d "${CODER_MODEL_PATH:-/root/inference/models/qwen2_5_coder_7b_sft}" ] \
   && [ -f "${CODER_MODEL_PATH}/config.json" ]; then
  echo "  ✅ 两个模型都已就位, 跳过拉取 (AutoDL 实例数据盘还在)"
else
  INFER_ROOT="$INFER_ROOT" bash "$INFER_ROOT/fetch-models.sh"
fi

# ─── 6. 启动 server.py ────────────────────────────────────────
echo "[6/7] 启动 server.py ..."

# 先停掉旧进程 (如果在)
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || echo '')"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "  停掉旧进程 PID=$OLD_PID ..."
    kill "$OLD_PID" || true
    sleep 2
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

cd "$INFER_ROOT"
nohup "$VENV_DIR/bin/python" "$INFER_ROOT/server.py" \
  >> "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
echo "  PID=$NEW_PID · 日志: $LOG_FILE"

# ─── 7. 等就绪 ───────────────────────────────────────────────
echo "[7/7] 等 /v1/health 就绪 (最多 180s, 大模型加载慢) ..."
READY="false"
for i in $(seq 1 90); do
  if curl -fsS -m 2 "http://127.0.0.1:${INFER_PORT:-8000}/v1/health" >/dev/null 2>&1; then
    READY="true"
    break
  fi
  sleep 2
done

if [ "$READY" = "true" ]; then
  HEALTH_JSON="$(curl -fsS "http://127.0.0.1:${INFER_PORT:-8000}/v1/health" 2>/dev/null || echo '{}')"
  echo "═══════════════════════════════════════════════════════════"
  echo "  ✅ 推理服务就绪"
  echo "═══════════════════════════════════════════════════════════"
  echo "  GPU:   ${GPU_NAME:-?} (${GPU_MEM_GB:-?} GB)"
  echo "  档位:  ${SIZE_TIER:-?} · ${QUANT:-?}"
  echo "  端口:  ${INFER_PORT:-8000}"
  echo "  健康:  $HEALTH_JSON"
  echo ""
  echo "  下一步: 在 GitHub Actions 跑 🔄 刷新推理端点 工作流,"
  echo "          填 AutoDL 实例的 host:port + 「刷新推理端点」口令."
  echo "═══════════════════════════════════════════════════════════"
  exit 0
else
  echo "═══════════════════════════════════════════════════════════"
  echo "  ❌ 推理服务 180s 内没就绪"
  echo "═══════════════════════════════════════════════════════════"
  echo "  查日志: tail -200 $LOG_FILE"
  echo "  常见原因: 模型加载慢 (7B fp16 ≈ 60-120s), 显存不够, bnb 库装失败"
  exit 1
fi
