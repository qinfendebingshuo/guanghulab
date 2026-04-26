#!/usr/bin/env bash
# E2E 测试模块 · 卸载脚本
# 遵循 GMP-SPEC-v1.0 uninstall.sh 规范
# 幂等: 重复执行不出错

set -euo pipefail

MODULE_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_NAME="e2e-test-mock-module"

echo "[${MODULE_NAME}] 卸载开始..."

# 1. 停止进程 (如果在运行)
if command -v pm2 &>/dev/null; then
  pm2 stop "${MODULE_NAME}" 2>/dev/null || true
  pm2 delete "${MODULE_NAME}" 2>/dev/null || true
fi

# 2. 清理运行时数据 (幂等)
rm -rf "${MODULE_DIR}/data" 2>/dev/null || true
rm -rf "${MODULE_DIR}/logs" 2>/dev/null || true

echo "[${MODULE_NAME}] 卸载完成 ✅"
exit 0
