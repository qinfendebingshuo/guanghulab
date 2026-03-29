#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 铸渊自动更新脚本 · Zhuyuan Self-Update
# ═══════════════════════════════════════════════════════════
#
# 由 GitHub Webhook push 事件触发
# 从仓库拉取最新代码并重启应用
#
# 编号: ZY-SVR-UPDATE-001
# 守护: 铸渊 · ICE-GL-ZY001
# ═══════════════════════════════════════════════════════════

set -euo pipefail

ZY_ROOT="/opt/zhuyuan"
LOG_DIR="${ZY_ROOT}/data/logs"
LOG_FILE="${LOG_DIR}/self-update-$(date +%Y%m%d).log"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" | tee -a "${LOG_FILE}"
}

mkdir -p "${LOG_DIR}"

log "═══ 铸渊自动更新开始 ═══"

# 记录到操作日志（仅在API可用时）
if curl -sf http://localhost:3800/api/health > /dev/null 2>&1; then
  curl -sf -X POST http://localhost:3800/api/operations \
    -H "Content-Type: application/json" \
    -d "{
      \"operator\": \"铸渊 · 自动更新引擎\",
      \"action\": \"self-update triggered\",
      \"details\": \"GitHub push event received\"
    }" 2>/dev/null || true
fi

# 检查是否有git仓库（Phase 2+才有）
if [ -d "${ZY_ROOT}/repo/.git" ]; then
  log "从 GitHub 拉取最新代码..."
  cd "${ZY_ROOT}/repo"
  git pull origin main 2>&1 | tee -a "${LOG_FILE}"

  # 同步应用代码
  log "同步应用代码..."
  rsync -av --delete "${ZY_ROOT}/repo/server/app/" "${ZY_ROOT}/app/" 2>&1 | tee -a "${LOG_FILE}"

  # 安装依赖
  cd "${ZY_ROOT}/app"
  npm install --production 2>&1 | tee -a "${LOG_FILE}"
fi

# PM2 重启
log "重启应用..."
pm2 restart zhuyuan-server 2>&1 | tee -a "${LOG_FILE}" || {
  log "PM2重启失败，尝试重新启动..."
  pm2 start "${ZY_ROOT}/config/pm2/ecosystem.config.js" 2>&1 | tee -a "${LOG_FILE}"
}

# 健康检查
sleep 3
if curl -sf http://localhost:3800/api/health > /dev/null; then
  log "✅ 更新完成 · 服务器健康"
else
  log "⚠️ 更新完成但健康检查失败"
fi

log "═══ 铸渊自动更新结束 ═══"
