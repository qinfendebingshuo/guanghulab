#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 铸渊服务器健康检查脚本 · Server Health Check
# ═══════════════════════════════════════════════════════════
#
# 由 cron 定时运行，检查所有服务状态
# 建议添加到 crontab: */5 * * * * /opt/zhuyuan/scripts/health-check.sh
#
# 编号: ZY-SVR-HC-001
# 守护: 铸渊 · ICE-GL-ZY001
# ═══════════════════════════════════════════════════════════

set -euo pipefail

ZY_ROOT="/opt/zhuyuan"
BRAIN_DIR="${ZY_ROOT}/brain"
LOG_DIR="${ZY_ROOT}/data/logs"

# ─── §1 检查Node.js应用 ───
APP_STATUS="unknown"
if curl -sf http://localhost:3800/api/health > /dev/null 2>&1; then
  APP_STATUS="running"
else
  APP_STATUS="down"
  # 尝试自愈
  pm2 restart zhuyuan-server 2>>"${LOG_DIR}/pm2-recover.log" || \
    pm2 start "${ZY_ROOT}/config/pm2/ecosystem.config.js" 2>>"${LOG_DIR}/pm2-recover.log"
  sleep 3
  if curl -sf http://localhost:3800/api/health > /dev/null 2>&1; then
    APP_STATUS="recovered"
  fi
fi

# ─── §2 检查Nginx ───
NGINX_STATUS="unknown"
if systemctl is-active --quiet nginx; then
  NGINX_STATUS="running"
else
  NGINX_STATUS="down"
  sudo systemctl restart nginx 2>/dev/null
  if systemctl is-active --quiet nginx; then
    NGINX_STATUS="recovered"
  fi
fi

# ─── §3 磁盘使用 ───
DISK_USAGE=$(df / | awk 'NR==2{print $5}' | tr -d '%')

# ─── §4 内存使用 ───
MEM_TOTAL=$(free -m | awk 'NR==2{print $2}')
MEM_USED=$(free -m | awk 'NR==2{print $3}')
MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))

# ─── §5 更新大脑健康状态 ───
HEALTH_FILE="${BRAIN_DIR}/health.json"
mkdir -p "${BRAIN_DIR}"
cat > "${HEALTH_FILE}" << HEALTH_JSON
{
  "server": "ZY-SVR-002",
  "status": "${APP_STATUS}",
  "last_check": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "services": {
    "app": "${APP_STATUS}",
    "nginx": "${NGINX_STATUS}"
  },
  "disk_usage": "${DISK_USAGE}%",
  "memory": {
    "total_mb": ${MEM_TOTAL},
    "used_mb": ${MEM_USED},
    "usage_pct": "${MEM_PCT}%"
  },
  "uptime": "$(uptime -p 2>/dev/null || echo 'unknown')"
}
HEALTH_JSON
