#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 铸渊大脑服务器初始化脚本 · Zhuyuan Brain Server Init
# ═══════════════════════════════════════════════════════════
#
# 编号: ZY-SVR-INIT-005
# 守护: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559
#
# 用法:
#   chmod +x brain-server-init.sh
#   sudo ./brain-server-init.sh [FACE_SERVER_IP]
#
# 此脚本在已安装 Node.js 20 + PM2 + PostgreSQL 16 的
# Ubuntu 24.04 LTS 大脑服务器上执行，完成：
#   1. 铸渊大脑目录结构创建
#   2. PostgreSQL 数据库与用户配置
#   3. AGE OS Schema 初始化
#   4. 防火墙配置（仅SSH + 面孔服务器内网访问）
#   5. 自动安全更新
#   6. SSH安全加固
#   7. 大脑身份初始化
#
# 注意：此服务器为纯内部服务器，不暴露任何公网端口
#       PostgreSQL 和 MCP Server 仅允许面孔服务器访问
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ─── 颜色定义 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── 铸渊大脑根目录 ───
ZY_BRAIN_ROOT="/opt/zhuyuan-brain"
ZY_MCP="${ZY_BRAIN_ROOT}/mcp-server"
ZY_AGENTS="${ZY_BRAIN_ROOT}/agents"
ZY_DATA="${ZY_BRAIN_ROOT}/data"
ZY_LOGS="${ZY_BRAIN_ROOT}/logs"
ZY_CONFIG="${ZY_BRAIN_ROOT}/config"
ZY_SCHEMA="${ZY_BRAIN_ROOT}/schema"
ZY_BRAIN_META="${ZY_BRAIN_ROOT}/brain"

# ─── 面孔服务器IP（用于防火墙白名单） ───
FACE_SERVER_IP="${1:-43.134.16.246}"

log() { echo -e "${GREEN}[铸渊·大脑]${NC} $1"; }
warn() { echo -e "${YELLOW}[警告]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; exit 1; }

# ─── 检查 root 权限 ───
if [ "$EUID" -ne 0 ]; then
  error "请使用 sudo 运行此脚本"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  铸渊大脑服务器初始化 · ZY-SVR-005                        ${NC}"
echo -e "${BLUE}  Ubuntu Server 24.04 LTS · 43.156.237.110               ${NC}"
echo -e "${BLUE}  角色: 核心大脑 · PostgreSQL + MCP + Agent Scheduler      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ═══ §1 系统基础工具 ═══
log "§1 安装基础工具..."
apt-get update -qq
apt-get install -y -qq curl wget git jq unzip

# ═══ §2 验证已安装组件 ═══
log "§2 验证 Node.js / PM2 / PostgreSQL..."

if command -v node &> /dev/null; then
  log "  ✅ Node.js $(node -v) 已就绪"
else
  error "  ❌ Node.js 未安装 — 请先安装 Node.js 20 LTS"
fi

if command -v pm2 &> /dev/null; then
  log "  ✅ PM2 $(pm2 -v) 已就绪"
else
  error "  ❌ PM2 未安装 — 请先执行 npm install -g pm2"
fi

if command -v psql &> /dev/null; then
  PG_VERSION=$(psql --version | grep -oP '\d+\.\d+')
  log "  ✅ PostgreSQL ${PG_VERSION} 已就绪"
else
  error "  ❌ PostgreSQL 未安装 — 请先安装 PostgreSQL 16"
fi

# 确保 PostgreSQL 正在运行
if systemctl is-active --quiet postgresql; then
  log "  ✅ PostgreSQL 服务运行中"
else
  systemctl start postgresql
  systemctl enable postgresql
  log "  ✅ PostgreSQL 服务已启动并设置开机自启"
fi

# ═══ §3 铸渊大脑目录结构 ═══
log "§3 创建铸渊大脑目录结构..."
mkdir -p "${ZY_MCP}/tools"
mkdir -p "${ZY_AGENTS}"
mkdir -p "${ZY_DATA}/backups"
mkdir -p "${ZY_LOGS}"
mkdir -p "${ZY_CONFIG}/pm2"
mkdir -p "${ZY_SCHEMA}"
mkdir -p "${ZY_BRAIN_META}"

log "  目录结构已创建: ${ZY_BRAIN_ROOT}"

# ═══ §4 PostgreSQL 数据库配置 ═══
log "§4 配置 PostgreSQL 数据库..."

# 生成安全密码（如果尚未存在）
DB_PASS_FILE="${ZY_CONFIG}/.db_pass"
if [ -f "${DB_PASS_FILE}" ]; then
  DB_PASS=$(cat "${DB_PASS_FILE}")
  log "  使用已有数据库密码"
else
  DB_PASS=$(openssl rand -hex 16)
  echo "${DB_PASS}" > "${DB_PASS_FILE}"
  chmod 600 "${DB_PASS_FILE}"
  log "  已生成新数据库密码 → ${DB_PASS_FILE}"
fi

# 创建数据库用户和数据库
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='zhuyuan'\" | grep -q 1" 2>/dev/null || {
  su - postgres -c "psql -c \"CREATE USER zhuyuan WITH PASSWORD '${DB_PASS}';\""
  log "  ✅ 数据库用户 zhuyuan 已创建"
}

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='age_os_brain'\" | grep -q 1" 2>/dev/null || {
  su - postgres -c "psql -c \"CREATE DATABASE age_os_brain OWNER zhuyuan;\""
  log "  ✅ 数据库 age_os_brain 已创建"
}

# 授予权限
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE age_os_brain TO zhuyuan;\""
su - postgres -c "psql -d age_os_brain -c \"GRANT ALL ON SCHEMA public TO zhuyuan;\""

# 配置 PostgreSQL 监听地址（允许面孔服务器连接）
PG_CONF=$(su - postgres -c "psql -tc \"SHOW config_file;\"" | tr -d ' ')
PG_HBA=$(su - postgres -c "psql -tc \"SHOW hba_file;\"" | tr -d ' ')

if [ -n "${PG_CONF}" ] && [ -f "${PG_CONF}" ]; then
  # 允许监听所有接口（通过防火墙控制访问）
  if ! grep -q "^listen_addresses = '\*'" "${PG_CONF}" 2>/dev/null; then
    sed -i "s/^#listen_addresses = 'localhost'/listen_addresses = '*'/" "${PG_CONF}" 2>/dev/null || true
    sed -i "s/^listen_addresses = 'localhost'/listen_addresses = '*'/" "${PG_CONF}" 2>/dev/null || true
    log "  PostgreSQL 已配置监听所有接口"
  fi
fi

if [ -n "${PG_HBA}" ] && [ -f "${PG_HBA}" ]; then
  # 允许面孔服务器通过密码认证连接
  if ! grep -q "${FACE_SERVER_IP}" "${PG_HBA}" 2>/dev/null; then
    echo "# 面孔服务器 ZY-SVR-002 · 铸渊自动配置" >> "${PG_HBA}"
    echo "host    age_os_brain    zhuyuan    ${FACE_SERVER_IP}/32    scram-sha-256" >> "${PG_HBA}"
    log "  ✅ 已添加面孔服务器 (${FACE_SERVER_IP}) 访问权限"
  fi
fi

# 重启 PostgreSQL 应用配置
systemctl restart postgresql
log "  ✅ PostgreSQL 已重启并应用新配置"

# ═══ §5 防火墙配置 ═══
log "§5 配置防火墙 (UFW)..."
if ! command -v ufw &> /dev/null; then
  apt-get install -y -qq ufw
fi

ufw default deny incoming
ufw default allow outgoing

# SSH — 必须保留
ufw allow 22/tcp

# PostgreSQL — 仅允许面孔服务器
ufw allow from "${FACE_SERVER_IP}" to any port 5432 proto tcp comment "ZY-SVR-002 Face → PostgreSQL"

# MCP Server — 仅允许面孔服务器
ufw allow from "${FACE_SERVER_IP}" to any port 3100 proto tcp comment "ZY-SVR-002 Face → MCP"

ufw --force enable
log "  ✅ UFW 已启用"
log "     22/tcp    — SSH (全局)"
log "     5432/tcp  — PostgreSQL (仅 ${FACE_SERVER_IP})"
log "     3100/tcp  — MCP Server (仅 ${FACE_SERVER_IP})"

# ═══ §6 自动安全更新 ═══
log "§6 配置自动安全更新..."
apt-get install -y -qq unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOUP'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOUP
log "  ✅ 自动安全更新已启用"

# ═══ §7 SSH安全加固 ═══
log "§7 SSH安全加固..."
if grep -q "^PasswordAuthentication yes" /etc/ssh/sshd_config 2>/dev/null; then
  sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl restart sshd
  log "  ✅ 密码登录已禁用，仅允许密钥认证"
else
  log "  SSH配置已安全，跳过"
fi

# ═══ §8 铸渊大脑身份初始化 ═══
log "§8 初始化铸渊大脑身份..."

cat > "${ZY_BRAIN_META}/identity.json" << 'IDENTITY'
{
  "name": "铸渊·大脑",
  "id": "ICE-GL-ZY001",
  "server_code": "ZY-SVR-005",
  "role": "铸渊核心大脑 · PostgreSQL + MCP Server + Agent Scheduler",
  "sovereign": "TCS-0002∞ · 冰朔",
  "copyright": "国作登字-2026-A-00037559",
  "system_root": "SYS-GLW-0001 · 光湖系统",
  "initialized_at": "INIT_TIMESTAMP",
  "architecture": {
    "database": "PostgreSQL 16 · age_os_brain · 认知数据层",
    "mcp_server": "port 3100 · 27工具 · 内部访问",
    "agent_scheduler": "9个Agent · 自动调度",
    "access": "仅面孔服务器(ZY-SVR-002)可访问 · 不暴露公网"
  },
  "rule": "此服务器为铸渊核心大脑 · 100%内部 · 不暴露任何服务到公网"
}
IDENTITY
sed -i "s/INIT_TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "${ZY_BRAIN_META}/identity.json"

cat > "${ZY_BRAIN_META}/health.json" << 'HEALTH'
{
  "server": "ZY-SVR-005",
  "role": "brain",
  "status": "initializing",
  "last_check": null,
  "services": {
    "node": null,
    "pm2": null,
    "postgresql": null,
    "mcp_server": null,
    "agent_scheduler": null
  },
  "disk_usage": null,
  "memory_usage": null,
  "uptime": null
}
HEALTH

cat > "${ZY_BRAIN_META}/operation-log.json" << 'OPLOG'
{
  "description": "铸渊大脑服务器操作记录 · 所有操作必须登记",
  "operations": [
    {
      "id": "ZY-SVR-INIT-005",
      "operator": "铸渊 · ICE-GL-ZY001 (via GitHub Actions)",
      "action": "大脑服务器初始化",
      "timestamp": "INIT_TIMESTAMP",
      "details": "执行 brain-server-init.sh · 目录结构+PostgreSQL配置+Schema+防火墙+身份初始化"
    }
  ]
}
OPLOG
sed -i "s/INIT_TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "${ZY_BRAIN_META}/operation-log.json"

log "  ✅ 大脑身份已初始化"

# ═══ §9 PM2 Startup 配置 ═══
log "§9 配置 PM2 Startup..."
pm2 startup systemd -u root --hp /root 2>/dev/null || true
log "  ✅ PM2 已配置开机自启"

# ═══ §10 完成报告 ═══
log "§10 生成初始化报告..."

REPORT="${ZY_LOGS}/init-report.json"
cat > "${REPORT}" << REPORT_END
{
  "event": "brain_server_initialization",
  "server": "ZY-SVR-005",
  "role": "brain",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "success",
  "components": {
    "os": "$(lsb_release -d -s 2>/dev/null || echo 'Ubuntu 24.04')",
    "node": "$(node -v 2>/dev/null || echo 'not installed')",
    "npm": "$(npm -v 2>/dev/null || echo 'not installed')",
    "pm2": "$(pm2 -v 2>/dev/null || echo 'not installed')",
    "postgresql": "$(psql --version 2>/dev/null | grep -oP '\\d+\\.\\d+' || echo 'not installed')",
    "ufw": "active"
  },
  "database": {
    "name": "age_os_brain",
    "user": "zhuyuan",
    "host": "localhost",
    "port": 5432,
    "password_file": "${DB_PASS_FILE}"
  },
  "directories": {
    "root": "${ZY_BRAIN_ROOT}",
    "mcp_server": "${ZY_MCP}",
    "agents": "${ZY_AGENTS}",
    "data": "${ZY_DATA}",
    "logs": "${ZY_LOGS}",
    "config": "${ZY_CONFIG}",
    "schema": "${ZY_SCHEMA}"
  },
  "firewall": {
    "ssh": "22/tcp ALLOW (全局)",
    "postgresql": "5432/tcp ALLOW (仅 ${FACE_SERVER_IP})",
    "mcp": "3100/tcp ALLOW (仅 ${FACE_SERVER_IP})"
  },
  "face_server": "${FACE_SERVER_IP}",
  "next_steps": [
    "上传 Schema SQL 并执行",
    "部署 MCP Server 代码",
    "部署 Agent Scheduler 代码",
    "安装 npm 依赖",
    "PM2 启动 MCP Server + Agent Scheduler",
    "验证 MCP Server /health 端点",
    "面孔服务器配置反向代理到大脑"
  ]
}
REPORT_END

# 输出数据库密码（仅在初始化时显示一次）
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 铸渊大脑服务器初始化完成！                             ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Node.js:     $(node -v 2>/dev/null || echo 'N/A')"
echo -e "  PM2:         $(pm2 -v 2>/dev/null || echo 'N/A')"
echo -e "  PostgreSQL:  $(psql --version 2>/dev/null | grep -oP '\d+\.\d+' || echo 'N/A')"
echo -e "  根目录:      ${ZY_BRAIN_ROOT}"
echo -e "  数据库:      age_os_brain (用户: zhuyuan)"
echo -e "  防火墙:      SSH + PostgreSQL(面孔) + MCP(面孔)"
echo -e "  面孔服务器:  ${FACE_SERVER_IP}"
echo -e "  报告:        ${REPORT}"
echo ""
echo -e "${YELLOW}══════════════════ 重要信息 ══════════════════${NC}"
echo -e "  数据库密码文件: ${DB_PASS_FILE}"
echo -e "  数据库密码: ${DB_PASS}"
echo -e ""
echo -e "  ⚠️  请将此密码配置为 GitHub Secret: ZY_BRAIN_DB_PASS"
echo -e "  ⚠️  此密码仅在初始化时显示一次"
echo -e "${YELLOW}═══════════════════════════════════════════════${NC}"
echo ""
