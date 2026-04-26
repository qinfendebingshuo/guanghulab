#!/usr/bin/env bash
# E2E 测试模块 · 健康检查脚本
# 遵循 GMP-SPEC-v1.0 health_check.sh 规范
# 退出码: 0=健康 1=不健康

set -euo pipefail

MODULE_NAME="e2e-test-mock-module"
HEALTH_PORT="${E2E_MOCK_PORT:-19800}"

# 检查 HTTP 端点
if curl -sf "http://127.0.0.1:${HEALTH_PORT}/health" >/dev/null 2>&1; then
  echo "[${MODULE_NAME}] 健康 ✅"
  exit 0
else
  echo "[${MODULE_NAME}] 不健康 ❌ (端口 ${HEALTH_PORT} 无响应)"
  exit 1
fi
