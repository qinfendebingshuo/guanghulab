#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy-sandbox-server.sh — 子域名沙箱服务器部署
# 指令：ZY-AGEOS-TOWER-2026-0326-001-S1 · Phase S2
# 版权：国作登字-2026-A-00037559
# 执行：AG-ZY-01 铸渊
#
# 🛡️ 核心原则：绝对不能破坏主站 guanghulab.com
# 所有操作内置安全回滚机制。
#
# 用法: bash scripts/deploy-sandbox-server.sh
# 必须在服务器上以 root 权限运行
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

echo "═══════════════════════════════════════════"
echo "  铸渊 · 子域名沙箱部署 · Phase S2"
echo "  指令: ZY-AGEOS-TOWER-2026-0326-001-S1"
echo "═══════════════════════════════════════════"
echo ""

# ─── S2-1 · 前置验证（全部通过才能继续） ───

echo "===== S2-1 · 前置验证 ====="

# DNS 检查 — 铸渊主权服务器 ZY-SVR-002
DNS=$(dig +short dev-004.guanghulab.com A 2>/dev/null || echo "")
if [ "$DNS" = "43.134.16.246" ]; then
  echo "✅ DNS OK ($DNS) — 铸渊主权服务器"
elif [ "$DNS" = "8.155.62.235" ]; then
  echo "⚠️ DNS 仍指向旧服务器 ($DNS)，请更新 DNS 到 43.134.16.246"
  exit 1
else
  echo "❌ DNS 失败: dev-004.guanghulab.com → '$DNS' (期望 43.134.16.246)"
  exit 1
fi

# SSL 证书检查
if [ -f /etc/letsencrypt/live/guanghulab.com/fullchain.pem ]; then
  echo "✅ SSL OK"
else
  echo "❌ SSL 证书不存在: /etc/letsencrypt/live/guanghulab.com/fullchain.pem"
  exit 1
fi

# 主站安全检查
MAIN=$(curl -so/dev/null -w"%{http_code}" --max-time 10 https://guanghulab.com/ 2>/dev/null || echo "000")
if [ "$MAIN" = "200" ]; then
  echo "✅ 主站 OK (HTTP $MAIN)"
else
  echo "❌ 主站异常 HTTP $MAIN"
  exit 1
fi

echo "===== ✅ 前置全部通过 ====="
echo ""

# ─── S2-2 · 创建沙箱目录 ───

echo "===== S2-2 · 创建沙箱目录 ====="

mkdir -p /var/www/sandbox
for ID in dev-002 dev-004 dev-005 dev-009 dev-010 dev-011 dev-012 dev-013 dev-014; do
  mkdir -p /var/www/sandbox/$ID
  cat > /var/www/sandbox/$ID/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><title>开发者沙箱</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}.c{text-align:center;padding:3rem;border-radius:16px;background:rgba(255,255,255,.05)}</style>
</head><body><div class="c"><h1>🏗️ 开发者沙箱</h1><p>子域名已激活 · 等待项目部署</p><p style="color:#7fba42">✅ DNS + SSL + Nginx 就绪</p></div></body></html>
EOF
  echo "✅ /var/www/sandbox/$ID 已创建"
done
chown -R root:root /var/www/sandbox && chmod -R 755 /var/www/sandbox

echo "===== ✅ 沙箱目录创建完成 ====="
echo ""

# ─── S2-3 · 部署 Nginx 子域名配置 ───

echo "===== S2-3 · 部署 Nginx 配置 ====="

# Step 1: 备份
BK="/etc/nginx/conf.d/backup-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BK" && cp -a /etc/nginx/conf.d/*.conf "$BK/" 2>/dev/null
echo "✅ 已备份到 $BK"

# Step 2: 写入 dev-sandbox.conf
cat > /etc/nginx/conf.d/dev-sandbox.conf << 'CONF'
# 开发者子域名沙箱 · ZY-AGEOS-TOWER-2026-0326-001-S1
# 铸渊统一管理 · 人类不得手动修改
server {
    listen 80;
    server_name ~^(?<devid>dev-\d{3})\.guanghulab\.com$;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name ~^(?<devid>dev-\d{3})\.guanghulab\.com$;
    ssl_certificate /etc/letsencrypt/live/guanghulab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/guanghulab.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /var/www/sandbox/$devid;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    add_header X-Sandbox-DevId $devid;
    access_log /var/log/nginx/sandbox-$devid-access.log;
    error_log /var/log/nginx/sandbox-error.log;
}
CONF
echo "✅ dev-sandbox.conf 已写入"

# Step 3: 语法检测（安全门）
echo "--- nginx -t ---"
if ! nginx -t 2>&1; then
  echo "❌ nginx -t 失败！回滚！"
  rm -f /etc/nginx/conf.d/dev-sandbox.conf
  cp -a "$BK/"*.conf /etc/nginx/conf.d/ 2>/dev/null
  echo "🔙 已回滚到备份: $BK"
  exit 1
fi
echo "✅ nginx -t 通过"

# Step 4: 优雅重载
nginx -s reload && echo "✅ nginx reload 成功"

# Step 5: 立即验证主站
MAIN=$(curl -so/dev/null -w"%{http_code}" --max-time 10 https://guanghulab.com/ 2>/dev/null || echo "000")
if [ "$MAIN" != "200" ]; then
  echo "🚨 主站异常 HTTP $MAIN！紧急回滚！"
  rm -f /etc/nginx/conf.d/dev-sandbox.conf
  cp -a "$BK/"*.conf /etc/nginx/conf.d/ 2>/dev/null
  nginx -t && nginx -s reload
  echo "🔙 紧急回滚完成"
  exit 1
fi
echo "✅ 主站安全 HTTP $MAIN"

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Phase S2 完成"
echo "  沙箱目录已创建 · Nginx 已重载 · 主站安全"
echo "═══════════════════════════════════════════"
