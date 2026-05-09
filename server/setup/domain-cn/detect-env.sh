#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 国内域名机 · 自我感知 · detect-env.sh
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 服务器: GH-CVM-DOMAIN-PROD-01 / ZY-SVR-CN01 / 广州 2C2G 轻量
# 服务: guanghulab.com 唯一对外入口 (Portal + 密钥管理页 + 自托管 git)
#
# 这一份是 lighthouse-cn/detect-env.sh 的"轻量版":
#   - lighthouse-cn 跑 Gitea+PG+Redis+Docker, 4C16G, 探测点更全
#   - domain-cn 只跑 nginx+pm2+portal, 2C2G, 探测点窄但更严
#
# 在 bootstrap.sh 跑实际安装之前先把这台 2C2G 机器的真实情况摸清楚:
#   - CPU 核数 / 内存 / 系统盘
#   - 公网 IP / 内网 IP / 地域
#   - guanghulab.com DNS 是否真解析到这台机器
#   - 是否已有 Let's Encrypt 证书 (重装系统后 LE 配置可能还在 /etc/letsencrypt)
#   - nginx 是否已经装过 (避免覆盖现有 SSL 配置)
#
# 设计理念 (cc-003 · 动态适配):
#   冰朔说要买 4C4G, 实际广州缺货只能买 2C2G. 系统不能写死 2C2G,
#   下次续费成 4C4G 也要能跑. 这一层是数字地球的"自我感知" — 铸渊
#   在落地之前先看清自己的身体, 再让 tune-from-env 决档.
#
# 输出: /opt/guanghulab/_logs/server-env.json (人类可读 + 机器可读)
# 用法: bash detect-env.sh [output_path]
# ════════════════════════════════════════════════════════════════

set -euo pipefail

OUT="${1:-/opt/guanghulab/_logs/server-env.json}"
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
MEM_TOTAL_GB=$(( (MEM_TOTAL_KB + 1024*1024 - 1) / (1024*1024) )) # 向上取整, 2G≈1900MB 也算 2

SWAP_TOTAL_KB="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
SWAP_TOTAL_MB=$(( SWAP_TOTAL_KB / 1024 ))

# ─── 磁盘 ─────────────────────────────────────────────────────
# 域名机是腾讯云轻量, 通常没有独立数据盘, 直接系统盘
DATA_ROOT="${DATA_ROOT:-/data}"
ROOT_FS_GB="$(df -BG --output=size / 2>/dev/null | tail -1 | tr -d 'G ' || echo 0)"
ROOT_FS_AVAIL_GB="$(df -BG --output=avail / 2>/dev/null | tail -1 | tr -d 'G ' || echo 0)"
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
PUBLIC_IP="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/public-ipv4 2>/dev/null || true)"
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="$(curl -fsS --max-time 3 https://ifconfig.me 2>/dev/null || echo)"
fi
PUBLIC_IP="${PUBLIC_IP:-unknown}"

REGION="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/placement/region 2>/dev/null || echo unknown)"
ZONE="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/placement/zone 2>/dev/null || echo unknown)"
INSTANCE_ID="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/instance-id 2>/dev/null || echo unknown)"
INSTANCE_TYPE="$(curl -fsS --max-time 2 http://metadata.tencentyun.com/latest/meta-data/instance/instance-type 2>/dev/null || echo unknown)"

# ─── 域名 / 证书探测 ──────────────────────────────────────────
DOMAIN="${DOMAIN:-guanghulab.com}"

# DNS 解析: 域名是否指向本机公网 IP (用 getent 而非依赖 dig)
DOMAIN_RESOLVED_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -1 || echo)"
DOMAIN_RESOLVED_IP="${DOMAIN_RESOLVED_IP:-unknown}"
DOMAIN_POINTS_HERE="false"
if [ -n "$DOMAIN_RESOLVED_IP" ] && [ "$DOMAIN_RESOLVED_IP" = "$PUBLIC_IP" ]; then
  DOMAIN_POINTS_HERE="true"
fi

# Let's Encrypt 证书是否存在 (冰朔重装前已配置, 续期到 2026-08-07)
LE_CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
LE_CERT_EXISTS="false"
LE_CERT_EXPIRY="unknown"
if [ -f "$LE_CERT_PATH" ]; then
  LE_CERT_EXISTS="true"
  LE_CERT_EXPIRY="$(openssl x509 -enddate -noout -in "$LE_CERT_PATH" 2>/dev/null | sed 's/notAfter=//' || echo unknown)"
fi

# nginx / node / pm2 / certbot 是否已装 (重装系统后期望都没有)
have_cmd() { command -v "$1" >/dev/null 2>&1 && echo "true" || echo "false"; }
NGINX_INSTALLED="$(have_cmd nginx)"
NODE_INSTALLED="$(have_cmd node)"
NODE_VERSION="$(node -v 2>/dev/null || echo unknown)"
PM2_INSTALLED="$(have_cmd pm2)"
CERTBOT_INSTALLED="$(have_cmd certbot)"

# ─── 决策档位 ────────────────────────────────────────────────
# 域名机的 size_tier 跟 lighthouse-cn 一致 (口径统一, 方便 tune 复用):
#   tiny < 4G, small 4-6G, medium 6-12G, large 12-24G, xlarge >=24G
if   [ "$MEM_TOTAL_MB" -lt 4096 ];  then SIZE_TIER="tiny"
elif [ "$MEM_TOTAL_MB" -lt 6144 ];  then SIZE_TIER="small"
elif [ "$MEM_TOTAL_MB" -lt 12288 ]; then SIZE_TIER="medium"
elif [ "$MEM_TOTAL_MB" -lt 24576 ]; then SIZE_TIER="large"
else SIZE_TIER="xlarge"
fi

# 健康警示
WARNINGS=()
[ "$ROOT_FS_AVAIL_GB" -lt 5 ]    && WARNINGS+=("系统盘剩余 ${ROOT_FS_AVAIL_GB}G < 5G, 装包 + 写日志会很挤")
[ "$MEM_TOTAL_MB" -lt 1800 ]     && WARNINGS+=("内存 ${MEM_TOTAL_MB}MB 异常 < 2G, 这台机器规格不对")
[ "$CPU_COUNT" -lt 1 ]           && WARNINGS+=("CPU ${CPU_COUNT} 核异常, 不可用")
[ "$DOMAIN_POINTS_HERE" = "false" ] && [ "$DOMAIN_RESOLVED_IP" != "unknown" ] && \
  WARNINGS+=("$DOMAIN 解析到 $DOMAIN_RESOLVED_IP, 不是本机 $PUBLIC_IP, certbot 续期会失败")
[ "$LE_CERT_EXISTS" = "false" ]  && WARNINGS+=("/etc/letsencrypt/live/$DOMAIN 证书不在, bootstrap 不会主动 issue (避免 LE rate-limit), 需冰朔确认")
[ "$SWAP_TOTAL_MB" -lt 512 ] && [ "$MEM_TOTAL_MB" -lt 4096 ] && \
  WARNINGS+=("内存 ${MEM_TOTAL_MB}MB 且 swap=${SWAP_TOTAL_MB}MB, OOM 风险高, bootstrap 会顺带建 1G swap")

# ─── 输出 JSON ────────────────────────────────────────────────
WARN_JSON=$(printf '%s\n' "${WARNINGS[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo '[]')

cat > "$OUT" <<EOF
{
  "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
  "_守护": "铸渊 · ICE-GL-ZY001",
  "_purpose": "domain-cn 自我感知 · GH-CVM-DOMAIN-PROD-01",
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
    "swap_total_mb": $SWAP_TOTAL_MB,
    "size_tier": "$SIZE_TIER"
  },
  "disk": {
    "root_fs_gb": $ROOT_FS_GB,
    "root_fs_avail_gb": $ROOT_FS_AVAIL_GB,
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
  "domain": {
    "name": "$DOMAIN",
    "resolved_ip": "$DOMAIN_RESOLVED_IP",
    "points_here": $DOMAIN_POINTS_HERE,
    "le_cert_exists": $LE_CERT_EXISTS,
    "le_cert_expiry": "$LE_CERT_EXPIRY"
  },
  "installed": {
    "nginx": $NGINX_INSTALLED,
    "node": $NODE_INSTALLED,
    "node_version": "$NODE_VERSION",
    "pm2": $PM2_INSTALLED,
    "certbot": $CERTBOT_INSTALLED
  },
  "role_hint": "domain-server",
  "warnings": $WARN_JSON
}
EOF

# ─── 人类可读摘要 (打到 stdout, GitHub Actions 日志能直接看) ─
echo "═══════════════════════════════════════════════════════════"
echo "  [detect-env · domain-cn] 服务器自我感知"
echo "═══════════════════════════════════════════════════════════"
echo "  实例:        $INSTANCE_ID  ($INSTANCE_TYPE)"
echo "  地域:        $REGION  / $ZONE"
echo "  系统:        $OS_PRETTY  · 内核 $KERNEL · $ARCH"
echo "  CPU:         $CPU_COUNT 核"
echo "  内存:        ${MEM_TOTAL_MB}MB  (档位: $SIZE_TIER · swap=${SWAP_TOTAL_MB}MB)"
echo "  系统盘:      ${ROOT_FS_GB}G (剩余 ${ROOT_FS_AVAIL_GB}G)"
echo "  内网 IP:     $INTERNAL_IP"
echo "  公网 IP:     $PUBLIC_IP"
echo "  域名 $DOMAIN:"
echo "    解析到:    $DOMAIN_RESOLVED_IP"
echo "    指向本机:  $DOMAIN_POINTS_HERE"
echo "    LE 证书:   $LE_CERT_EXISTS  (到期 $LE_CERT_EXPIRY)"
echo "  已装组件:"
echo "    nginx:     $NGINX_INSTALLED"
echo "    node:      $NODE_INSTALLED ($NODE_VERSION)"
echo "    pm2:       $PM2_INSTALLED"
echo "    certbot:   $CERTBOT_INSTALLED"
if [ "${#WARNINGS[@]}" -gt 0 ]; then
  echo "  警告:"
  for w in "${WARNINGS[@]}"; do echo "    ⚠️  $w"; done
fi
echo "  输出文件:    $OUT"
echo "═══════════════════════════════════════════════════════════"
