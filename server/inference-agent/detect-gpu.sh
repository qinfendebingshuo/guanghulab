#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# AutoDL 推理机 · GPU 自我感知 · detect-gpu.sh
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 服务器: GH-AUTODL-INFER-01 / ZY-SVR-GPU01 / AutoDL 共享 GPU
#
# 设计理念 (cc-003 · 动态适配):
#   AutoDL 抢什么算什么 — A100 / 4090 / 3090 / A10 / V100 都可能.
#   每次开机 IP/端口/GPU 型号都漂移, 不能写死. 这一份是落地之前先
#   摸清楚 GPU 真实情况, 让 tune-inference.sh 决档 (fp16/int8/int4).
#
# 设计理念 (cc-001 · 涌现洁净):
#   AutoDL 关机即销毁实例, 重开机就是全新机器, 没有上次任务的残留.
#   这是天然的"涌现洁净" — 不需要我们做缓存清理.
#
# 输出: /tmp/gpu-env.json (人类可读 + 机器可读)
# 用法: bash detect-gpu.sh [output_path]
# ════════════════════════════════════════════════════════════════

set -euo pipefail

OUT="${1:-/tmp/gpu-env.json}"
mkdir -p "$(dirname "$OUT")"

# ─── 基础信息 ─────────────────────────────────────────────────
HOSTNAME_VAL="$(hostname 2>/dev/null || echo unknown)"
KERNEL="$(uname -r 2>/dev/null || echo unknown)"
OS_PRETTY="$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"
DETECT_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ─── nvidia-smi 探测 ──────────────────────────────────────────
NVIDIA_OK="false"
GPU_NAME="unknown"
GPU_MEM_MB="0"
GPU_MEM_GB="0"
DRIVER_VER="unknown"
CUDA_VER="unknown"
GPU_COUNT="0"

if command -v nvidia-smi >/dev/null 2>&1; then
  # nvidia-smi --query-gpu 输出: name, memory.total[MiB], driver_version
  if NVS_OUT="$(nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits 2>/dev/null)"; then
    NVIDIA_OK="true"
    # 取第一张卡 (AutoDL 单卡为主, 多卡场景留给后续棒处理)
    FIRST_LINE="$(echo "$NVS_OUT" | head -n1)"
    GPU_NAME="$(echo "$FIRST_LINE" | awk -F',' '{gsub(/^ +| +$/, "", $1); print $1}')"
    GPU_MEM_MB="$(echo "$FIRST_LINE" | awk -F',' '{gsub(/^ +| +$/, "", $2); print $2}')"
    DRIVER_VER="$(echo "$FIRST_LINE" | awk -F',' '{gsub(/^ +| +$/, "", $3); print $3}')"
    GPU_COUNT="$(echo "$NVS_OUT" | wc -l | tr -d ' ')"
    # MB → GB (整数除法, 28710 MiB ≈ 28 GB → 显示 28)
    if [ "$GPU_MEM_MB" -gt 0 ] 2>/dev/null; then
      GPU_MEM_GB="$(( GPU_MEM_MB / 1024 ))"
    fi
    CUDA_VER="$(nvidia-smi 2>/dev/null | grep -o 'CUDA Version: [0-9.]*' | head -n1 | awk '{print $3}' || echo unknown)"
  fi
fi

# ─── 显存档位决策 (与 tune-inference.sh 一致, 这里只算 hint) ──
SIZE_TIER="unknown"
SUGGESTED_QUANT="unknown"
if [ "$NVIDIA_OK" = "true" ] && [ "$GPU_MEM_GB" -gt 0 ] 2>/dev/null; then
  if [ "$GPU_MEM_GB" -ge 40 ]; then
    SIZE_TIER="xlarge"; SUGGESTED_QUANT="fp16"
  elif [ "$GPU_MEM_GB" -ge 24 ]; then
    SIZE_TIER="large"; SUGGESTED_QUANT="int8"
  elif [ "$GPU_MEM_GB" -ge 16 ]; then
    SIZE_TIER="medium"; SUGGESTED_QUANT="int4"
  else
    SIZE_TIER="small"; SUGGESTED_QUANT="int4"
  fi
fi

# ─── CPU / 内存 ──────────────────────────────────────────────
CPU_COUNT="$(nproc 2>/dev/null || echo unknown)"
MEM_TOTAL_KB="$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)"
MEM_TOTAL_GB="$(( MEM_TOTAL_KB / 1024 / 1024 ))"

# ─── 写出 JSON ───────────────────────────────────────────────
cat > "$OUT" <<EOF
{
  "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
  "_守护": "铸渊 · ICE-GL-ZY001",
  "_说明": "AutoDL 推理机 GPU 自我感知 · 由 detect-gpu.sh 生成 · tune-inference.sh 读这一份决档",
  "server_id": "GH-AUTODL-INFER-01",
  "detected_at": "$DETECT_TS",
  "host": {
    "hostname": "$HOSTNAME_VAL",
    "kernel": "$KERNEL",
    "os": "$OS_PRETTY",
    "arch": "$ARCH",
    "cpu_count": "$CPU_COUNT",
    "mem_total_gb": $MEM_TOTAL_GB
  },
  "gpu": {
    "nvidia_smi_ok": $NVIDIA_OK,
    "count": $GPU_COUNT,
    "name": "$GPU_NAME",
    "memory_total_mb": $GPU_MEM_MB,
    "memory_total_gb": $GPU_MEM_GB,
    "driver_version": "$DRIVER_VER",
    "cuda_version": "$CUDA_VER"
  },
  "tier_hint": {
    "size_tier": "$SIZE_TIER",
    "suggested_quant": "$SUGGESTED_QUANT",
    "_注意": "这只是 detect-gpu 的早期提示, tune-inference.sh 是真正决档的地方"
  }
}
EOF

# ─── 中文回执到 stdout ───────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  [detect-gpu] AutoDL 推理机 GPU 探测完成"
echo "═══════════════════════════════════════════════════════════"
if [ "$NVIDIA_OK" = "true" ]; then
  echo "  ✅ GPU: $GPU_NAME ($GPU_MEM_GB GB) · 驱动 $DRIVER_VER · CUDA $CUDA_VER"
  echo "  📊 档位提示: $SIZE_TIER (建议量化: $SUGGESTED_QUANT)"
else
  echo "  ❌ nvidia-smi 不可达 — 这台机器没有 GPU 或驱动没装"
  echo "     AutoDL 实例需要选 GPU 镜像, 不是 CPU only"
fi
echo "  💾 主机: $CPU_COUNT 核 / $MEM_TOTAL_GB G · $OS_PRETTY"
echo "  📄 输出: $OUT"
echo "═══════════════════════════════════════════════════════════"

# 退出码: nvidia-smi 不通 = 1 (上层脚本可决定是否继续)
[ "$NVIDIA_OK" = "true" ]
