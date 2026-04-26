#!/usr/bin/env bash
# E2E 测试模块 · 安装脚本
# 遵循 GMP-SPEC-v1.0 install.sh 规范
# 幂等: 重复执行不出错

set -euo pipefail

MODULE_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_NAME="e2e-test-mock-module"

echo "[${MODULE_NAME}] 安装开始..."

# 1. 检查 Node.js 环境
if ! command -v node &>/dev/null; then
  echo "[${MODULE_NAME}] 错误: Node.js 未安装"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "${NODE_VERSION}" -lt 18 ]; then
  echo "[${MODULE_NAME}] 错误: 需要 Node.js >= 18, 当前: $(node -v)"
  exit 1
fi

# 2. 检查必要文件
if [ ! -f "${MODULE_DIR}/manifest.yaml" ]; then
  echo "[${MODULE_NAME}] 错误: manifest.yaml 不存在"
  exit 1
fi

if [ ! -f "${MODULE_DIR}/index.js" ]; then
  echo "[${MODULE_NAME}] 错误: index.js 不存在"
  exit 1
fi

# 3. 创建运行时目录 (幂等)
mkdir -p "${MODULE_DIR}/data"
mkdir -p "${MODULE_DIR}/logs"

# 4. 写入安装标记
echo "{\"installedAt\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\", \"module\": \"${MODULE_NAME}\"}" > "${MODULE_DIR}/data/install-marker.json"

echo "[${MODULE_NAME}] 安装完成 ✅"
exit 0
