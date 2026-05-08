#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 服务器现状自动探测 · detect-env.sh
# Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 在 bootstrap.sh 跑实际安装之前先把这一台机器的真实情况摸清楚:
#   - CPU 核数 / 内存 / 系统盘 / 数据盘 / 是否真挂载
#   - 公网 IP / 内网 IP / 大致地域 (按 hostname / cloud meta)
#   - 系统版本 / 内核 / 时区
#
# 把结果写到 $DEPLOY_ROOT/_logs/server-env.json , 后续 tune-from-env.sh
# 会读这一份, 动态生成 compose 资源限制 / postgres tuning / runner labels.
#
# 设计理念 (因果链):
#   现实里"我说要买 4C16G 但是没货只能买 2C8G"是常态. 系统不能写死
#   规格, 必须每次启动都先拉一遍真实配置, 再决定怎么部署. 这是数字
#   地球的"自我感知"层 — 铸渊在落地之前先看清自己的身体.
#
# 输出: server-env.json (人类可读 + 机器可读)
# 用法: bash detect-env.sh [output_path]
# ════════════════════════════════════════════════════════════════

set -euo pipefail

OUT="${1:-/opt/guanghu/_logs/server-env.json}"
mkdir -p "$(dirname "$OUT")"

# ─── 基础信息 ─────────────────────────────────────────────────
HOSTNAME_VAL="$(hostname 2>/dev/null || echo unknown)"
KERNEL="$(uname -r 2>/dev/null || echo unknown)"
OS_PRETTY="$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"
TZ_NAME="$(timedatectl show -p Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo unknown)"

# ─── CPU / 内存 ───────────────────────────────────────────────
CPU_COUNT="$(nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo 0)"
MEM_TOTAL_KB="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
MEM_TOTAL_MB=$(( MEM_TOTAL_KB / 1024 ))
MEM_TOTAL_GB=$(( (MEM_TOTAL_KB + 1024*1024 - 1) / (1024*1024) )) # 向上取整, 8G≈7800MB 也算 8

# ─── 磁盘 / 数据盘 ────────────────────────────────────────────
DATA_ROOT="${DATA_ROOT:-/data}"
ROOT_FS_GB="$(df -BG --output=size / 2>/dev/null | tail -1 | tr -d 'G ' || echo 0)"
DATA_FS_GB="0"
DATA_MOUNTED="false"
DATA_FSTYPE="none"
if mountpoint -q "$DATA_ROOT" 2>/dev/null; then
  DATA_MOUNTED="true"
  DATA_FS_GB="$(df -BG --output=size "$DATA_ROOT" 2>/dev/null | tail -1 | tr -d 'G ' || echo 0)"
  DATA_FSTYPE="$(df --output=fstype "$DATA_ROOT" 2>/dev/null | tail -1 | tr -d ' ' || echo unknown)"
fi

# ─── 网络 / IP ────────────────────────────────────────────────
INTERNAL_IP="$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | head -1 | cut -d/ -f1 || echo)"
# 公网 IP: 优先腾讯云 metadata, 失败再 fallback
PUBLIC_IP="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/public-ipv4 2>/dev/null || true)"
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="$(curl -fsS --max-time 3 https://ifconfig.me 2>/dev/null || echo)"
fi
PUBLIC_IP="${PUBLIC_IP:-unknown}"

# 地域: 腾讯云 metadata 里有
REGION="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/placement/region 2>/dev/null || echo unknown)"
ZONE="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/placement/zone 2>/dev/null || echo unknown)"
INSTANCE_ID="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/instance-id 2>/dev/null || echo unknown)"
INSTANCE_TYPE="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/instance/instance-type 2>/dev/null || echo unknown)"

# ─── 决策档位 (给 tune-from-env.sh 读) ────────────────────────
# 内存档位: tiny < 4G, small 4-6G, medium 6-12G, large 12-24G, xlarge >=24G
if   [ "$MEM_TOTAL_MB" -lt 4096 ];  then SIZE_TIER="tiny"
elif [ "$MEM_TOTAL_MB" -lt 6144 ];  then SIZE_TIER="small"
elif [ "$MEM_TOTAL_MB" -lt 12288 ]; then SIZE_TIER="medium"
elif [ "$MEM_TOTAL_MB" -lt 24576 ]; then SIZE_TIER="large"
else SIZE_TIER="xlarge"
fi

# 角色推断:
#   - 真生产 (mountpoint 数据盘 + 内网 172. 段) → "main"
#   - 备用 (有数据盘但容量小) → "backup"
#   - 其他 → "unknown"
ROLE_HINT="unknown"
if [ "$DATA_MOUNTED" = "true" ]; then
  if [ "$DATA_FS_GB" -ge 80 ]; then ROLE_HINT="main"; else ROLE_HINT="backup"; fi
fi

# 健康警示
WARNINGS=()
[ "$DATA_MOUNTED" = "false" ] && WARNINGS+=("数据盘 $DATA_ROOT 未挂载, Gitea 数据会落到系统盘")
[ "$ROOT_FS_GB" -lt 30 ]     && WARNINGS+=("系统盘容量 ${ROOT_FS_GB}G < 30G, 装 docker 镜像会很挤")
[ "$MEM_TOTAL_MB" -lt 4096 ] && WARNINGS+=("内存 ${MEM_TOTAL_MB}MB < 4G, gitea+postgres+runner 无法同时全跑, runner 必须延后")
[ "$CPU_COUNT" -lt 2 ]       && WARNINGS+=("CPU ${CPU_COUNT} 核 < 2, 编译类任务会非常慢")

# ─── 输出 JSON ────────────────────────────────────────────────
WARN_JSON=$(printf '%s\n' "${WARNINGS[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo '[]')

cat > "$OUT" <<EOF
{
  "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
  "_守护": "铸渊 · ICE-GL-ZY001",
  "detected_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "host": {
    "hostname": "$HOSTNAME_VAL",
    "os": "$OS_PRETTY",
    "kernel": "$KERNEL",
    "arch": "$ARCH",
    "timezone": "$TZ_NAME"
  },
  "compute": {
    "cpu_count": $CPU_COUNT,
    "memory_total_mb": $MEM_TOTAL_MB,
    "memory_total_gb": $MEM_TOTAL_GB,
    "size_tier": "$SIZE_TIER"
  },
  "disk": {
    "root_fs_gb": $ROOT_FS_GB,
    "data_root": "$DATA_ROOT",
    "data_mounted": $DATA_MOUNTED,
    "data_fs_gb": $DATA_FS_GB,
    "data_fstype": "$DATA_FSTYPE"
  },
  "network": {
    "internal_ip": "$INTERNAL_IP",
    "public_ip": "$PUBLIC_IP"
  },
  "cloud": {
    "vendor": "tencentcloud-or-unknown",
    "instance_id": "$INSTANCE_ID",
    "instance_type": "$INSTANCE_TYPE",
    "region": "$REGION",
    "zone": "$ZONE"
  },
  "role_hint": "$ROLE_HINT",
  "warnings": $WARN_JSON
}
EOF

# ─── 人类可读摘要 (打到 stdout, GitHub Actions 日志能直接看) ─
echo "═══════════════════════════════════════════════════════════"
echo "  [detect-env] 服务器自我感知"
echo "═══════════════════════════════════════════════════════════"
echo "  实例:      $INSTANCE_ID  ($INSTANCE_TYPE)"
echo "  地域:      $REGION  / $ZONE"
echo "  系统:      $OS_PRETTY  · 内核 $KERNEL · $ARCH"
echo "  CPU:       $CPU_COUNT 核"
echo "  内存:      ${MEM_TOTAL_MB}MB  (档位: $SIZE_TIER)"
echo "  系统盘:    ${ROOT_FS_GB}G"
echo "  数据盘:    $DATA_ROOT  · 挂载=$DATA_MOUNTED  · ${DATA_FS_GB}G  ($DATA_FSTYPE)"
echo "  内网 IP:   $INTERNAL_IP"
echo "  公网 IP:   $PUBLIC_IP"
echo "  推断角色:  $ROLE_HINT"
if [ "${#WARNINGS[@]}" -gt 0 ]; then
  echo "  警告:"
  for w in "${WARNINGS[@]}"; do echo "    ⚠️  $w"; done
fi
echo "  输出文件:  $OUT"
echo "═══════════════════════════════════════════════════════════"
