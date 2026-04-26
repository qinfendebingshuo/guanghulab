#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# GMP-Agent 部署验证脚本
# 工单: GH-GMP-006 · 录册A02
# 用途: 在测试服务器上验证 GMP-Agent 部署就绪状态
# 幂等: 可重复执行 · 不会破坏现有状态
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ─── 配置 ────────────────────────────────────────────────
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/guanghu}"
GMP_AGENT_DIR="${DEPLOY_ROOT}/guanghu-self-hosted/gmp-agent"
GMP_PORT="${GMP_PORT:-9800}"
ECOSYSTEM_CONFIG="${GMP_AGENT_DIR}/ecosystem.config.js"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
TOTAL_COUNT=0

# ─── 工具函数 ────────────────────────────────────────────

check_pass() {
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "  ${GREEN}✅ PASS${NC} $1"
}

check_fail() {
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "  ${RED}❌ FAIL${NC} $1"
}

check_warn() {
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  WARN_COUNT=$((WARN_COUNT + 1))
  echo -e "  ${YELLOW}⚠️  WARN${NC} $1"
}

section() {
  echo -e "\n${BLUE}══════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}══════════════════════════════════════${NC}"
}

# ─── Step 1: Git Pull 最新代码 ───────────────────────────
section "Step 1: Git Pull 最新代码"

if [ -d "${DEPLOY_ROOT}/.git" ]; then
  echo "  仓库目录: ${DEPLOY_ROOT}"
  cd "${DEPLOY_ROOT}"
  
  # 记录当前 commit
  BEFORE_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  
  # 拉取最新代码
  if git pull origin main --ff-only 2>/dev/null; then
    AFTER_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    if [ "${BEFORE_SHA}" = "${AFTER_SHA}" ]; then
      check_pass "代码已是最新 (${AFTER_SHA})"
    else
      check_pass "代码已更新 ${BEFORE_SHA} → ${AFTER_SHA}"
    fi
  else
    check_warn "git pull 失败 (可能有未提交变更), 使用当前代码继续"
  fi
else
  check_fail "部署目录不存在或不是git仓库: ${DEPLOY_ROOT}"
  echo -e "  ${YELLOW}提示: 请先执行 git clone 到 ${DEPLOY_ROOT}${NC}"
fi

# ─── Step 2: 检查 .env 配置完整性 ────────────────────────
section "Step 2: 检查配置完整性"

# 检查 GMP-Agent 目录
if [ -d "${GMP_AGENT_DIR}" ]; then
  check_pass "GMP-Agent 目录存在: ${GMP_AGENT_DIR}"
else
  check_fail "GMP-Agent 目录不存在: ${GMP_AGENT_DIR}"
fi

# 检查 package.json
if [ -f "${GMP_AGENT_DIR}/package.json" ]; then
  check_pass "package.json 存在"
else
  check_fail "package.json 不存在"
fi

# 检查 app.js
if [ -f "${GMP_AGENT_DIR}/app.js" ]; then
  check_pass "app.js 存在"
else
  check_fail "app.js (入口文件) 不存在"
fi

# 检查 .env 或环境变量 (非强制 · GMP-Agent 有合理默认值)
if [ -f "${GMP_AGENT_DIR}/.env" ]; then
  check_pass ".env 配置文件存在"
  
  # 检查关键配置项
  if grep -q "GMP_PORT" "${GMP_AGENT_DIR}/.env" 2>/dev/null; then
    check_pass ".env 包含 GMP_PORT 配置"
  else
    check_warn ".env 未配置 GMP_PORT (将使用默认 9800)"
  fi
  
  if grep -q "GMP_WEBHOOK_SECRET" "${GMP_AGENT_DIR}/.env" 2>/dev/null; then
    check_pass ".env 包含 GMP_WEBHOOK_SECRET 配置"
  else
    check_warn ".env 未配置 GMP_WEBHOOK_SECRET (webhook签名验证将跳过)"
  fi
else
  check_warn ".env 不存在 (GMP-Agent 将使用默认配置·可正常运行)"
fi

# 检查 node_modules
if [ -d "${GMP_AGENT_DIR}/node_modules" ]; then
  check_pass "node_modules 已安装"
else
  echo -e "  ${YELLOW}node_modules 不存在, 正在安装依赖...${NC}"
  cd "${GMP_AGENT_DIR}"
  if npm install --production 2>/dev/null; then
    check_pass "npm install 完成"
  else
    check_fail "npm install 失败"
  fi
fi

# 检查关键依赖命令
if command -v pm2 &>/dev/null; then
  check_pass "pm2 已安装: $(pm2 --version 2>/dev/null || echo 'unknown')"
else
  check_fail "pm2 未安装 (请执行 npm install -g pm2)"
fi

if command -v node &>/dev/null; then
  check_pass "Node.js 已安装: $(node --version 2>/dev/null || echo 'unknown')"
else
  check_fail "Node.js 未安装"
fi

# ─── Step 3: PM2 启动 GMP-Agent ──────────────────────────
section "Step 3: PM2 启动 GMP-Agent"

# 检查是否已在运行
GMP_RUNNING=false
if pm2 jlist 2>/dev/null | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    try { const p=JSON.parse(d); const g=p.find(x=>x.name==='gmp-agent');
      if(g && g.pm2_env && g.pm2_env.status==='online') process.exit(0);
      else process.exit(1);
    } catch(e) { process.exit(1); }
  });
" 2>/dev/null; then
  GMP_RUNNING=true
  check_pass "GMP-Agent 进程已在 PM2 中运行"
else
  echo -e "  ${YELLOW}GMP-Agent 未运行, 尝试启动...${NC}"
  
  cd "${GMP_AGENT_DIR}"
  
  # 优先使用 ecosystem.config.js
  if [ -f "${ECOSYSTEM_CONFIG}" ]; then
    if pm2 start "${ECOSYSTEM_CONFIG}" 2>/dev/null; then
      check_pass "PM2 通过 ecosystem.config.js 启动成功"
      GMP_RUNNING=true
    else
      check_warn "ecosystem.config.js 启动失败, 尝试直接启动"
    fi
  fi
  
  # 回退: 直接启动 app.js
  if [ "${GMP_RUNNING}" = false ]; then
    if pm2 start app.js --name gmp-agent 2>/dev/null; then
      check_pass "PM2 直接启动 app.js 成功"
      GMP_RUNNING=true
    else
      check_fail "PM2 启动 GMP-Agent 失败"
    fi
  fi
fi

# 等待服务就绪
if [ "${GMP_RUNNING}" = true ]; then
  echo -e "  等待服务就绪 (最多10秒)..."
  for i in $(seq 1 10); do
    if curl -sf "http://127.0.0.1:${GMP_PORT}/health" >/dev/null 2>&1; then
      check_pass "GMP-Agent 服务就绪 (${i}秒)"
      break
    fi
    if [ "$i" -eq 10 ]; then
      check_fail "GMP-Agent 服务启动超时 (10秒)"
    fi
    sleep 1
  done
fi

# ─── Step 4: 验证 GMP-Agent 进程存活 ────────────────────
section "Step 4: 验证进程存活"

# PM2 进程状态
if pm2 jlist 2>/dev/null | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    try { const p=JSON.parse(d); const g=p.find(x=>x.name==='gmp-agent');
      if(g) { console.log('  PM2 状态: ' + (g.pm2_env?g.pm2_env.status:'unknown') + ' | PID: ' + g.pid + ' | 重启: ' + (g.pm2_env?g.pm2_env.restart_time:0));
        process.exit(g.pm2_env && g.pm2_env.status==='online' ? 0 : 1); }
      else { console.log('  PM2 中未找到 gmp-agent 进程'); process.exit(1); }
    } catch(e) { process.exit(1); }
  });
" 2>/dev/null; then
  check_pass "GMP-Agent PM2 进程在线"
else
  check_fail "GMP-Agent PM2 进程不在线"
fi

# ─── Step 5: 验证端口监听 ───────────────────────────────
section "Step 5: 验证端口监听"

# 检查 9800 端口 (主API + Webhook)
if ss -tlnp 2>/dev/null | grep -q ":${GMP_PORT} " || netstat -tlnp 2>/dev/null | grep -q ":${GMP_PORT} "; then
  check_pass "端口 ${GMP_PORT} 正在监听 (GMP-Agent 主API + Webhook)"
else
  # 回退: 用 curl 直接测试
  if curl -sf "http://127.0.0.1:${GMP_PORT}/health" >/dev/null 2>&1; then
    check_pass "端口 ${GMP_PORT} 可访问 (通过 curl 验证)"
  else
    check_fail "端口 ${GMP_PORT} 未监听"
  fi
fi

# 验证 /health 端点
HEALTH_RESPONSE=$(curl -sf "http://127.0.0.1:${GMP_PORT}/health" 2>/dev/null || echo "")
if [ -n "${HEALTH_RESPONSE}" ]; then
  echo -e "  健康检查响应: ${HEALTH_RESPONSE}"
  check_pass "/health 端点正常响应"
else
  check_fail "/health 端点无响应"
fi

# 验证 /webhook/status 端点
WEBHOOK_RESPONSE=$(curl -sf "http://127.0.0.1:${GMP_PORT}/webhook/status" 2>/dev/null || echo "")
if [ -n "${WEBHOOK_RESPONSE}" ]; then
  echo -e "  Webhook状态: ${WEBHOOK_RESPONSE}"
  check_pass "/webhook/status 端点正常响应"
else
  check_warn "/webhook/status 端点无响应 (webhook路由可能未加载)"
fi

# ─── 部署状态报告 ────────────────────────────────────────
section "部署验证报告"

echo -e "  部署根目录 : ${DEPLOY_ROOT}"
echo -e "  GMP-Agent  : ${GMP_AGENT_DIR}"
echo -e "  主端口     : ${GMP_PORT}"
echo -e "  时间       : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""
echo -e "  ${GREEN}✅ 通过: ${PASS_COUNT}${NC}"
echo -e "  ${RED}❌ 失败: ${FAIL_COUNT}${NC}"
echo -e "  ${YELLOW}⚠️  警告: ${WARN_COUNT}${NC}"
echo -e "  总计: ${TOTAL_COUNT}"
echo ""

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo -e "  ${RED}═══ 部署验证未通过 · 有 ${FAIL_COUNT} 项失败 ═══${NC}"
  exit 1
else
  echo -e "  ${GREEN}═══ 部署验证通过 ═══${NC}"
  exit 0
fi
