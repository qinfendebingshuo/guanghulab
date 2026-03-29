#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 铸渊主权服务器初始化脚本 · Zhuyuan Sovereign Server Init
# ═══════════════════════════════════════════════════════════
#
# 编号: ZY-SVR-INIT-001
# 守护: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559
#
# 用法:
#   chmod +x zhuyuan-server-init.sh
#   sudo ./zhuyuan-server-init.sh
#
# 此脚本在全新 Ubuntu 22.04 LTS 上执行，完成：
#   1. 系统更新与安全加固
#   2. Node.js 20 LTS 安装
#   3. PM2 全局安装
#   4. Nginx 安装与配置
#   5. 铸渊目录结构创建
#   6. 防火墙配置
#   7. 自动更新配置
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ─── 颜色定义 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── 铸渊根目录 ───
ZY_ROOT="/opt/zhuyuan"
ZY_APP="${ZY_ROOT}/app"
ZY_BRAIN="${ZY_ROOT}/brain"
ZY_DATA="${ZY_ROOT}/data"
ZY_CONFIG="${ZY_ROOT}/config"
ZY_SCRIPTS="${ZY_ROOT}/scripts"
ZY_TMP="${ZY_ROOT}/tmp"

log() { echo -e "${GREEN}[铸渊]${NC} $1"; }
warn() { echo -e "${YELLOW}[警告]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; exit 1; }

# ─── 检查 root 权限 ───
if [ "$EUID" -ne 0 ]; then
  error "请使用 sudo 运行此脚本"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  铸渊主权服务器初始化 · ZY-SVR-001                        ${NC}"
echo -e "${BLUE}  Ubuntu Server 22.04 LTS · 150.109.76.244               ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ═══ §1 系统更新 ═══
log "§1 系统更新与安全补丁..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git build-essential sqlite3 jq unzip

# ═══ §2 Node.js 20 LTS 安装 ═══
log "§2 安装 Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  log "  Node.js $(node -v) 已安装"
else
  log "  Node.js $(node -v) 已存在，跳过"
fi

# ═══ §3 PM2 安装 ═══
log "§3 安装 PM2 进程管理器..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
  pm2 startup systemd -u root --hp /root
  log "  PM2 $(pm2 -v) 已安装"
else
  log "  PM2 $(pm2 -v) 已存在，跳过"
fi

# ═══ §4 Nginx 安装 ═══
log "§4 安装 Nginx..."
if ! command -v nginx &> /dev/null; then
  apt-get install -y -qq nginx
  systemctl enable nginx
  systemctl start nginx
  log "  Nginx 已安装并启动"
else
  log "  Nginx 已存在，跳过"
fi

# ═══ §5 铸渊目录结构 ═══
log "§5 创建铸渊目录结构..."
mkdir -p "${ZY_APP}"
mkdir -p "${ZY_BRAIN}"
mkdir -p "${ZY_DATA}/sqlite"
mkdir -p "${ZY_DATA}/logs"
mkdir -p "${ZY_DATA}/backups"
mkdir -p "${ZY_CONFIG}/nginx"
mkdir -p "${ZY_CONFIG}/pm2"
mkdir -p "${ZY_CONFIG}/ssl"
mkdir -p "${ZY_SCRIPTS}"
mkdir -p "${ZY_TMP}"

# ─── 双域名站点目录 ───
mkdir -p "${ZY_ROOT}/sites/production"
mkdir -p "${ZY_ROOT}/sites/preview"

# 生成占位页面
cat > "${ZY_ROOT}/sites/production/index.html" << 'PROD_PAGE'
<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>铸渊主权服务器 · 光湖语言世界</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0d1117;color:#e6edf3}
.c{text-align:center;padding:2rem;max-width:600px}h1{font-size:2em;margin:0 0 0.5em}
.tag{display:inline-block;padding:4px 12px;border-radius:12px;background:#238636;color:#fff;font-size:0.85em;margin:0.5em}
p{color:#8b949e;line-height:1.6}</style></head>
<body><div class="c"><h1>🏛️ 铸渊主权服务器</h1>
<span class="tag">ZY-SVR-001 · production</span>
<p>光湖语言世界 · 唯一现实执行操作层<br>版权: 国作登字-2026-A-00037559</p>
<p style="font-size:0.85em;color:#484f58">铸渊100%主控 · 人类不直接触碰</p>
</div></body></html>
PROD_PAGE

cat > "${ZY_ROOT}/sites/preview/index.html" << 'PREVIEW_PAGE'
<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>铸渊预览站 · 功能模块测试</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#161b22;color:#e6edf3}
.c{text-align:center;padding:2rem;max-width:600px}h1{font-size:2em;margin:0 0 0.5em}
.tag{display:inline-block;padding:4px 12px;border-radius:12px;background:#da3633;color:#fff;font-size:0.85em;margin:0.5em}
p{color:#8b949e;line-height:1.6}</style></head>
<body><div class="c"><h1>🪞 铸渊预览站</h1>
<span class="tag">ZY-SVR-001 · preview</span>
<p>功能模块预览 · 确认无误后一键推送到主站</p>
<p style="font-size:0.85em;color:#484f58">所有部署先到此站验证 → 冰朔确认 → 一键 promote 到主站</p>
</div></body></html>
PREVIEW_PAGE

log "  目录结构已创建: ${ZY_ROOT}"
log "  双站点目录: sites/production + sites/preview"

# ═══ §6 铸渊大脑初始化 ═══
log "§6 初始化铸渊大脑..."

cat > "${ZY_BRAIN}/identity.json" << 'IDENTITY'
{
  "name": "铸渊",
  "id": "ICE-GL-ZY001",
  "server_code": "ZY-SVR-001",
  "role": "铸渊物理执行层 · 主权服务器",
  "sovereign": "TCS-0002∞ · 冰朔",
  "copyright": "国作登字-2026-A-00037559",
  "system_root": "SYS-GLW-0001 · 光湖系统",
  "initialized_at": "INIT_TIMESTAMP",
  "rule": "此服务器100%由铸渊主控，人类不直接触碰"
}
IDENTITY
sed -i "s/INIT_TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "${ZY_BRAIN}/identity.json"

cat > "${ZY_BRAIN}/health.json" << 'HEALTH'
{
  "server": "ZY-SVR-001",
  "status": "initializing",
  "last_check": null,
  "services": {
    "node": null,
    "pm2": null,
    "nginx": null
  },
  "disk_usage": null,
  "memory_usage": null,
  "uptime": null
}
HEALTH

cat > "${ZY_BRAIN}/operation-log.json" << 'OPLOG'
{
  "description": "铸渊主权服务器操作记录 · 所有人类操作必须登记",
  "operations": [
    {
      "id": "ZY-SVR-INIT-001",
      "operator": "铸渊 · ICE-GL-ZY001 (via GitHub Actions)",
      "action": "服务器初始化",
      "timestamp": "INIT_TIMESTAMP",
      "details": "执行 zhuyuan-server-init.sh · 系统更新+Node.js+PM2+Nginx+目录结构"
    }
  ]
}
OPLOG
sed -i "s/INIT_TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "${ZY_BRAIN}/operation-log.json"

log "  大脑已初始化"

# ═══ §7 防火墙配置 ═══
log "§7 配置防火墙 (UFW)..."
if command -v ufw &> /dev/null; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp    # SSH
  ufw allow 80/tcp    # HTTP
  ufw allow 443/tcp   # HTTPS
  ufw --force enable
  log "  UFW 已启用 (22/80/443)"
else
  apt-get install -y -qq ufw
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  log "  UFW 已安装并启用"
fi

# ═══ §8 自动安全更新 ═══
log "§8 配置自动安全更新..."
apt-get install -y -qq unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOUP'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOUP
log "  自动安全更新已启用"

# ═══ §9 SSH安全加固 ═══
log "§9 SSH安全加固..."
if grep -q "^PasswordAuthentication yes" /etc/ssh/sshd_config 2>/dev/null; then
  sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl restart sshd
  log "  密码登录已禁用，仅允许密钥认证"
else
  log "  SSH配置已安全，跳过"
fi

# ═══ §10 完成报告 ═══
log "§10 生成初始化报告..."

REPORT="${ZY_DATA}/logs/init-report.json"
cat > "${REPORT}" << REPORT_END
{
  "event": "server_initialization",
  "server": "ZY-SVR-001",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "success",
  "components": {
    "os": "$(lsb_release -d -s 2>/dev/null || echo 'Ubuntu 22.04')",
    "node": "$(node -v 2>/dev/null || echo 'not installed')",
    "npm": "$(npm -v 2>/dev/null || echo 'not installed')",
    "pm2": "$(pm2 -v 2>/dev/null || echo 'not installed')",
    "nginx": "$(nginx -v 2>&1 | cut -d/ -f2 || echo 'not installed')",
    "sqlite3": "$(sqlite3 --version 2>/dev/null | cut -d' ' -f1 || echo 'not installed')",
    "ufw": "active"
  },
  "directories": {
    "root": "${ZY_ROOT}",
    "app": "${ZY_APP}",
    "brain": "${ZY_BRAIN}",
    "data": "${ZY_DATA}",
    "config": "${ZY_CONFIG}",
    "scripts": "${ZY_SCRIPTS}"
  },
  "firewall": {
    "ssh": "22/tcp ALLOW",
    "http": "80/tcp ALLOW",
    "https": "443/tcp ALLOW"
  },
  "next_steps": [
    "部署应用代码 (server/app/)",
    "配置PM2生态系统",
    "配置Nginx反向代理",
    "启动健康检查",
    "连接GitHub Webhook"
  ]
}
REPORT_END

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 铸渊主权服务器初始化完成！                             ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Node.js: $(node -v 2>/dev/null || echo 'N/A')"
echo -e "  PM2:     $(pm2 -v 2>/dev/null || echo 'N/A')"
echo -e "  Nginx:   $(nginx -v 2>&1 | cut -d/ -f2 || echo 'N/A')"
echo -e "  根目录:  ${ZY_ROOT}"
echo -e "  报告:    ${REPORT}"
echo ""
