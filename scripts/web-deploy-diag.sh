#!/bin/bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
#
# 🔍 Phase A · 服务器部署诊断脚本
# 工单: ZY-WEBDEPLOY-DIAG-2026-0324-001
#
# 用法: ssh user@server 'bash -s' < scripts/web-deploy-diag.sh
# 或在服务器上直接运行: bash /path/to/web-deploy-diag.sh
#
# 输出保存到: data/web-deploy-diag-YYYYMMDD.log

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/var/www/guanghulab}"
DATE=$(date '+%Y-%m-%d %H:%M:%S %Z')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 guanghulab.com 部署诊断 · Phase A"
echo "   时间: $DATE"
echo "   目标: $DEPLOY_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ━━━ A1 · 服务器文件系统探查 ━━━
echo ""
echo "===== 🔍 A1 · 服务器文件系统探查 ====="

echo ""
echo "📂 /var/www/ 顶层目录（一级）："
ls -la /var/www/ 2>/dev/null || echo "⚠️ /var/www/ 不存在"

echo ""
echo "📂 /var/www/ 二级目录树："
find /var/www/ -maxdepth 2 -type d 2>/dev/null | head -80

echo ""
echo "📂 查找所有 index.html（定位已部署的前端模块）："
find /var/www/ -name 'index.html' -type f 2>/dev/null

echo ""
echo "📂 查找所有 server.js / app.js（定位后端服务）："
find /var/www/ /opt/ -name 'server.js' -o -name 'app.js' 2>/dev/null | head -20

echo ""
echo "📂 磁盘占用（哪个目录最大 = 可能是主要部署目标）："
du -sh /var/www/*/ 2>/dev/null | sort -rh | head -20

# ━━━ A2 · Nginx 配置完整导出 ━━━
echo ""
echo "===== 🔍 A2 · Nginx 配置 ====="

echo ""
echo "📋 Nginx 主配置："
cat /etc/nginx/nginx.conf 2>/dev/null || echo "⚠️ nginx.conf 不存在"

echo ""
echo "📋 conf.d/ 下所有配置文件："
ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "⚠️ conf.d/ 不存在"

echo ""
echo "📋 各配置文件完整内容："
for f in /etc/nginx/conf.d/*.conf; do
  if [ -f "$f" ]; then
    echo ""
    echo "━━━ $f ━━━"
    cat "$f"
  fi
done

echo ""
echo "📋 sites-enabled/（如果存在）："
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "⚠️ sites-enabled/ 不存在"
for f in /etc/nginx/sites-enabled/*; do
  if [ -f "$f" ]; then
    echo ""
    echo "━━━ $f ━━━"
    cat "$f"
  fi
done

echo ""
echo "📋 snippets/（如果存在）："
ls -la /etc/nginx/snippets/ 2>/dev/null || echo "⚠️ snippets/ 不存在"
for f in /etc/nginx/snippets/*.conf; do
  if [ -f "$f" ]; then
    echo ""
    echo "━━━ $f ━━━"
    cat "$f"
  fi
done

echo ""
echo "📋 Nginx 配置语法测试："
nginx -t 2>&1 || sudo nginx -t 2>&1 || echo "⚠️ 无法执行 nginx -t"

echo ""
echo "📋 Nginx 当前监听端口："
ss -tlnp 2>/dev/null | grep nginx || echo "⚠️ 未找到 nginx 监听端口"

# ━━━ A3 · PM2 / Node 进程状态 ━━━
echo ""
echo "===== 🔍 A3 · PM2 / Node 进程 ====="

pm2 list 2>/dev/null || echo "⚠️ PM2 未安装或无进程"
pm2 describe 0 2>/dev/null | head -30 || true

echo ""
echo "📋 所有 Node 进程："
ps aux | grep node | grep -v grep || echo "⚠️ 未找到 Node 进程"

echo ""
echo "📋 监听端口："
ss -tlnp 2>/dev/null | grep -E '(node|pm2|3000|3001|3002|3721|8000|8080)' || echo "⚠️ 未找到相关端口"

# ━━━ A4 · 实际 HTTP 访问测试 ━━━
echo ""
echo "===== 🔍 A4 · HTTP 访问测试 ====="

declare -a URLS=(
  "https://guanghulab.com/|主站首页"
  "http://localhost/|Nginx本地"
  "https://guanghulab.com/status-board/|系统状态看板"
  "https://guanghulab.com/cost-control/|成本控制"
  "https://guanghulab.com/devboard/|开发者看板"
  "https://guanghulab.com/app/|集成壳"
  "https://guanghulab.com/persona-studio/|Persona Studio"
  "https://guanghulab.com/api/health|后端API健康检查"
  "http://localhost:3000/|后端本地"
  "http://localhost:3721/api/health|API代理本地"
)

for entry in "${URLS[@]}"; do
  IFS='|' read -r url name <<< "$entry"
  STATUS=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  REDIRECT=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "$url" 2>/dev/null || echo "")
  echo "$name → $STATUS ${REDIRECT:+(→ $REDIRECT)}"
done

# ━━━ A5 · 部署历史 ━━━
echo ""
echo "===== 🔍 A5 · 部署历史 ====="

echo "📋 deploy-status.json："
cat "$DEPLOY_PATH/data/deploy-status.json" 2>/dev/null || echo "⚠️ deploy-status.json 不存在或为空"

for dir in "$DEPLOY_PATH" /var/www/hololake-frontend /var/www/hololake; do
  if [ -d "$dir" ]; then
    echo ""
    echo "📂 $dir 最后修改时间："
    stat -c '%y' "$dir" 2>/dev/null || stat -f '%Sm' "$dir" 2>/dev/null || echo "⚠️ 无法获取"
    echo "最新文件："
    find "$dir" -type f -exec stat -c '%Y %n' {} \; 2>/dev/null | sort -rn | head -5 || \
      ls -lt "$dir" 2>/dev/null | head -6
  fi
done

# ━━━ A6 · SSL 证书状态 ━━━
echo ""
echo "===== 🔍 A6 · SSL 证书 ====="
certbot certificates 2>/dev/null || echo "⚠️ certbot 未安装或无证书"

# ━━━ A7 · 模块文件完整性检查 ━━━
echo ""
echo "===== 🔍 A7 · 模块文件完整性 ====="

declare -a MODULES=(
  "docs|主站首页|index.html"
  "status-board|系统状态看板|index.html"
  "cost-control|成本控制|index.html"
  "devboard|开发者看板|index.html"
  "app|光湖集成壳|page.tsx"
  "persona-studio|Persona Studio|index.html"
  "backend|后端API|server.js"
)

for entry in "${MODULES[@]}"; do
  IFS='|' read -r dir name file <<< "$entry"
  if [ -f "$DEPLOY_PATH/$dir/$file" ]; then
    echo "✅ $name → $dir/$file"
  elif [ -d "$DEPLOY_PATH/$dir" ]; then
    echo "⚠️ $name → 目录存在，$file 缺失"
    ls "$DEPLOY_PATH/$dir/" 2>/dev/null | head -5
  else
    echo "❌ $name → $dir/ 不存在"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 诊断完成 · $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
