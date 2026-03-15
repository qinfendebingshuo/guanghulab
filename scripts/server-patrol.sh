#!/bin/bash
# server-patrol.sh · 铸渊每日服务器巡检
# 部署位置：服务器 /var/www/_shared/server-patrol.sh
# 执行方式：铸渊SSH到服务器后 bash /var/www/_shared/server-patrol.sh
# 输出：JSON格式巡检报告到 /tmp/patrol-report.json

set -uo pipefail

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REPORT="/tmp/patrol-report.json"
ALERTS=()
FIXED=()

echo "===== 🔍 铸渊服务器巡检 · ${TIMESTAMP} ====="

# ━━━ 检查项1：Nginx 运行状态 ━━━
echo "[1/7] Nginx 状态..."
if systemctl is-active --quiet nginx; then
  NGINX_STATUS="running"
  echo "  ✅ Nginx 运行中"
else
  NGINX_STATUS="down"
  ALERTS+=("Nginx 未运行")
  echo "  ❌ Nginx 未运行！尝试重启..."
  systemctl restart nginx
  if systemctl is-active --quiet nginx; then
    FIXED+=("Nginx 已自动重启恢复")
    NGINX_STATUS="recovered"
    echo "  ✅ Nginx 已恢复"
  else
    echo "  ❌ Nginx 重启失败！需要人工介入"
  fi
fi

# ━━━ 检查项2：各沙盒模块冒烟检查 ━━━
echo "[2/7] 模块冒烟检查..."

# 已知已部署的模块URL（后续铸渊从 deploy-status.json 动态读取）
URLS=(
  "https://guanghulab.com/|主站首页"
  "https://guanghulab.com/status-board/|DEV-005·看板"
  "https://guanghulab.com/cost-control/|DEV-005·成本控制"
)

for entry in "${URLS[@]}"; do
  IFS='|' read -r url name <<< "$entry"
  STATUS=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 "$url")
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ ${name} → ${STATUS}"
  else
    echo "  ❌ ${name} → ${STATUS}"
    ALERTS+=("${name} 返回 ${STATUS}")
  fi
done

# ━━━ 检查项3：PM2 进程状态 ━━━
echo "[3/7] PM2 进程..."
if command -v pm2 &> /dev/null; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null)
  PM2_STOPPED=$(echo "$PM2_STATUS" | python3 -c "
import sys, json
try:
  procs = json.load(sys.stdin)
  stopped = [p['name'] for p in procs if p.get('pm2_env',{}).get('status') != 'online']
  print(','.join(stopped) if stopped else 'none')
except:
  print('parse_error')" 2>/dev/null)

  if [ "$PM2_STOPPED" = "none" ]; then
    echo "  ✅ 所有PM2进程正常"
  elif [ "$PM2_STOPPED" = "parse_error" ]; then
    echo "  ⚠️ PM2状态解析失败"
    ALERTS+=("PM2状态解析失败")
  else
    echo "  ❌ 以下进程异常: ${PM2_STOPPED}"
    ALERTS+=("PM2进程异常: ${PM2_STOPPED}")
    # 尝试重启
    IFS=',' read -ra PROCS <<< "$PM2_STOPPED"
    for proc in "${PROCS[@]}"; do
      pm2 restart "$proc" 2>/dev/null
      if pm2 show "$proc" 2>/dev/null | grep -q "online"; then
        FIXED+=("PM2进程 ${proc} 已自动重启")
        echo "  ✅ ${proc} 已重启恢复"
      else
        echo "  ❌ ${proc} 重启失败"
      fi
    done
  fi
else
  echo "  ⚠️ PM2 未安装"
fi

# ━━━ 检查项4：磁盘空间 ━━━
echo "[4/7] 磁盘空间..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
  echo "  ❌ 磁盘使用率 ${DISK_USAGE}%（超过90%警戒线）"
  ALERTS+=("磁盘使用率 ${DISK_USAGE}%")
elif [ "$DISK_USAGE" -gt 80 ]; then
  echo "  ⚠️ 磁盘使用率 ${DISK_USAGE}%（接近警戒线）"
else
  echo "  ✅ 磁盘使用率 ${DISK_USAGE}%"
fi

# ━━━ 检查项5：沙盒目录权限 ━━━
echo "[5/7] 沙盒目录权限..."
for DEV_ID in DEV-001 DEV-002 DEV-003 DEV-004 DEV-005 DEV-009 DEV-010 DEV-011 DEV-012 DEV-013 DEV-014; do
  SANDBOX="/var/www/${DEV_ID}"
  if [ -d "$SANDBOX" ]; then
    OWNER=$(stat -c '%U:%G' "$SANDBOX")
    PERM=$(stat -c '%a' "$SANDBOX")
    if [ "$OWNER" != "nginx:nginx" ] || [ "$PERM" != "755" ]; then
      echo "  ❌ ${DEV_ID}: owner=${OWNER} perm=${PERM}（应为 nginx:nginx 755）"
      ALERTS+=("${DEV_ID} 权限异常: ${OWNER} ${PERM}")
      # 自动修复
      chown nginx:nginx "$SANDBOX"
      chmod 755 "$SANDBOX"
      FIXED+=("${DEV_ID} 权限已自动修复")
      echo "  ✅ ${DEV_ID} 权限已修复"
    fi
  fi
done
echo "  ✅ 沙盒权限检查完成"

# ━━━ 检查项6：SSL证书有效期 ━━━
echo "[6/7] SSL证书..."
SSL_EXPIRY=$(echo | openssl s_client -servername guanghulab.com -connect guanghulab.com:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$SSL_EXPIRY" ]; then
  EXPIRY_EPOCH=$(date -d "$SSL_EXPIRY" +%s 2>/dev/null)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
  if [ "$DAYS_LEFT" -lt 7 ]; then
    echo "  ❌ SSL证书将在 ${DAYS_LEFT} 天后过期！"
    ALERTS+=("SSL证书 ${DAYS_LEFT} 天后过期")
  elif [ "$DAYS_LEFT" -lt 30 ]; then
    echo "  ⚠️ SSL证书还有 ${DAYS_LEFT} 天过期"
  else
    echo "  ✅ SSL证书还有 ${DAYS_LEFT} 天"
  fi
else
  echo "  ⚠️ 无法获取SSL证书信息"
fi

# ━━━ 检查项7：Nginx配置语法 ━━━
echo "[7/7] Nginx配置语法..."
NGINX_TEST=$(nginx -t 2>&1)
if echo "$NGINX_TEST" | grep -q "successful"; then
  echo "  ✅ Nginx配置语法正确"
else
  echo "  ❌ Nginx配置有语法错误"
  ALERTS+=("Nginx配置语法错误")
fi

# ━━━ 生成JSON报告 ━━━
ALERT_COUNT=${#ALERTS[@]}
FIXED_COUNT=${#FIXED[@]}

ALERT_JSON="[]"
if [ $ALERT_COUNT -gt 0 ]; then
  ALERT_JSON=$(printf '%s\n' "${ALERTS[@]}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))")
fi

FIXED_JSON="[]"
if [ $FIXED_COUNT -gt 0 ]; then
  FIXED_JSON=$(printf '%s\n' "${FIXED[@]}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))")
fi

cat > "$REPORT" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "nginx_status": "${NGINX_STATUS}",
  "disk_usage_percent": ${DISK_USAGE},
  "alert_count": ${ALERT_COUNT},
  "fixed_count": ${FIXED_COUNT},
  "alerts": ${ALERT_JSON},
  "auto_fixed": ${FIXED_JSON},
  "overall": "$([ $ALERT_COUNT -eq 0 ] && echo 'healthy' || echo 'has_issues')"
}
EOF

echo ""
echo "===== 📊 巡检结果 ====="
if [ $ALERT_COUNT -eq 0 ]; then
  echo "✅ 全部正常 · 无异常"
else
  echo "⚠️ 发现 ${ALERT_COUNT} 个异常 · 自动修复 ${FIXED_COUNT} 个"
fi
echo "报告已保存到 ${REPORT}"
cat "$REPORT"
