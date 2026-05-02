#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# 训练心跳上报器 · progress-reporter.sh
# ═══════════════════════════════════════════════════════════
# 签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
#
# 在 GPU 训练机 (zy-gpu-train · 119.45.160.137) 上跑。
# 每个训练 step / 阶段切换时被训练脚本调用，
# 通过 GitHub API repository_dispatch 把心跳推到仓库,
# 触发 .github/workflows/training-dashboard.yml 自动更新 README。
#
# 用法:
#   progress-reporter.sh <phase> [phase_label] [progress_json] [message]
#
# 例:
#   progress-reporter.sh bootstrapping "环境配置中" '' "apt 安装 python3-pip"
#   progress-reporter.sh training "训练第 100/1000 步" \
#     '{"step":100,"total_steps":1000,"epoch":1,"total_epochs":3,"loss":2.31,"learning_rate":0.00002,"throughput_samples_per_sec":1.8,"eta_seconds":4500,"elapsed_seconds":540}' \
#     "step=100 loss=2.31"
#   progress-reporter.sh error "" '' "OOM at step 234"
#
# 必需环境变量:
#   GH_REPO_OWNER       仓库 owner (例: qinfendebingshuo)
#   GH_REPO_NAME        仓库名 (例: guanghulab)
#   GH_DISPATCH_TOKEN   有 repo dispatch 权限的 GitHub PAT
#                       (在仓库 Settings > Secrets 配置 ZY_DISPATCH_TOKEN,
#                        bootstrap 时通过 SSH 写到服务器 /opt/guanghu/training/.env)
#
# 可选环境变量:
#   TRAIN_HEALTH_STATUS  ok | warning | error | idle (默认: 训练阶段=ok 错误阶段=error)
#   TRAIN_HEALTH_MESSAGE 健康消息（默认空）
# ═══════════════════════════════════════════════════════════

set -uo pipefail

PHASE="${1:-}"
PHASE_LABEL="${2:-}"
PROGRESS_JSON="${3:-}"
MESSAGE="${4:-}"

if [[ -z "$PHASE" ]]; then
  echo "[progress-reporter] usage: $0 <phase> [phase_label] [progress_json] [message]" >&2
  exit 1
fi

: "${GH_REPO_OWNER:?GH_REPO_OWNER is required}"
: "${GH_REPO_NAME:?GH_REPO_NAME is required}"
: "${GH_DISPATCH_TOKEN:?GH_DISPATCH_TOKEN is required}"

# ── 健康状态默认值 ──
HEALTH_STATUS="${TRAIN_HEALTH_STATUS:-}"
if [[ -z "$HEALTH_STATUS" ]]; then
  case "$PHASE" in
    error) HEALTH_STATUS="error" ;;
    idle)  HEALTH_STATUS="idle" ;;
    done)  HEALTH_STATUS="ok" ;;
    *)     HEALTH_STATUS="ok" ;;
  esac
fi
HEALTH_MESSAGE="${TRAIN_HEALTH_MESSAGE:-}"

# ── 采集 GPU 指标 (nvidia-smi --query-gpu) ──
GPU_JSON='[]'
SNAPSHOT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if command -v nvidia-smi >/dev/null 2>&1; then
  RAW=$(nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits 2>/dev/null || true)
  if [[ -n "$RAW" ]]; then
    GPU_JSON=$(echo "$RAW" | awk -F', *' 'BEGIN{print "["} NR>1{printf ","} {printf "{\"index\":%s,\"name\":\"%s\",\"util_percent\":%s,\"memory_used_mib\":%s,\"memory_total_mib\":%s,\"temperature_c\":%s,\"power_w\":%s}",$1,$2,$3,$4,$5,$6,$7} END{print "]"}')
  fi
fi

# ── 拼装 client_payload (JSON) ──
# 用 python3 拼装最稳，避免 shell 转义噩梦
PAYLOAD=$(PHASE="$PHASE" PHASE_LABEL="$PHASE_LABEL" PROGRESS_JSON="$PROGRESS_JSON" \
  MESSAGE="$MESSAGE" HEALTH_STATUS="$HEALTH_STATUS" HEALTH_MESSAGE="$HEALTH_MESSAGE" \
  GPU_JSON="$GPU_JSON" SNAPSHOT_AT="$SNAPSHOT_AT" python3 <<'PY'
import json, os
payload = {
    "phase": os.environ.get("PHASE") or "idle",
}
if os.environ.get("PHASE_LABEL"):
    payload["phase_label"] = os.environ["PHASE_LABEL"]
if os.environ.get("MESSAGE"):
    payload["message"] = os.environ["MESSAGE"]
prog = os.environ.get("PROGRESS_JSON", "").strip()
if prog:
    try:
        payload["progress"] = json.loads(prog)
    except Exception as e:
        payload.setdefault("message", "")
        payload["message"] = (payload["message"] + f" (progress_json parse error: {e})").strip()
gpu = os.environ.get("GPU_JSON", "[]")
try:
    devices = json.loads(gpu)
except Exception:
    devices = []
payload["gpu_metrics"] = {"snapshot_at": os.environ["SNAPSHOT_AT"], "devices": devices}
payload["health"] = {"status": os.environ.get("HEALTH_STATUS") or "ok"}
if os.environ.get("HEALTH_MESSAGE"):
    payload["health"]["message"] = os.environ["HEALTH_MESSAGE"]
print(json.dumps({"event_type": "training-progress", "client_payload": payload}))
PY
)

if [[ -z "$PAYLOAD" ]]; then
  echo "[progress-reporter] failed to build payload" >&2
  exit 2
fi

# ── 发到 GitHub API ──
URL="https://api.github.com/repos/${GH_REPO_OWNER}/${GH_REPO_NAME}/dispatches"
HTTP_CODE=$(curl -sS -o /tmp/zy-dispatch-resp.txt -w '%{http_code}' \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GH_DISPATCH_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$URL" || echo "000")

if [[ "$HTTP_CODE" == "204" ]]; then
  echo "[progress-reporter] ✅ phase=$PHASE step-info='${MESSAGE:-$PHASE_LABEL}'"
  exit 0
fi
echo "[progress-reporter] ❌ HTTP $HTTP_CODE phase=$PHASE" >&2
cat /tmp/zy-dispatch-resp.txt >&2 || true
echo "" >&2
exit 3
