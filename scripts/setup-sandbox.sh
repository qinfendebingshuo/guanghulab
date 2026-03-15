#!/bin/bash
# setup-sandbox.sh — 新开发者沙盒初始化脚本（铸渊 · 光湖沙盒部署自动化）
# 用法: bash setup-sandbox.sh <DEV_ID> [MODULE...]
# 在服务器上创建开发者沙盒目录并设置权限

set -euo pipefail

DEV_ID="${1:-}"

if [ -z "$DEV_ID" ]; then
  echo "❌ 用法: setup-sandbox.sh <DEV_ID> [MODULE...]"
  echo "   示例: setup-sandbox.sh DEV-005 status-board cost-control"
  exit 1
fi

if [[ ! "$DEV_ID" =~ ^DEV-[0-9]{3}$ ]]; then
  echo "❌ 无效的 DEV 编号: ${DEV_ID} (应为 DEV-XXX 格式)"
  exit 1
fi

SANDBOX_ROOT="/var/www/${DEV_ID}"

echo "🏠 setup-sandbox · 初始化沙盒"
echo "🆔 开发者: ${DEV_ID}"
echo "📂 沙盒根目录: ${SANDBOX_ROOT}"
echo ""

# 创建沙盒根目录
mkdir -p "${SANDBOX_ROOT}"
echo "  ✅ 创建根目录: ${SANDBOX_ROOT}"

# 创建模块子目录（如指定）
shift
for MODULE in "$@"; do
  MODULE_DIR="${SANDBOX_ROOT}/${MODULE}"
  mkdir -p "${MODULE_DIR}"
  echo "  ✅ 创建模块目录: ${MODULE_DIR}"
done

# 创建共享目录（如不存在）
SHARED_DIR="/var/www/_shared"
if [ ! -d "$SHARED_DIR" ]; then
  mkdir -p "$SHARED_DIR"
  echo "  ✅ 创建共享目录: ${SHARED_DIR}"
fi

# 设置权限
chown -R nginx:nginx "${SANDBOX_ROOT}"
find "${SANDBOX_ROOT}" -type d -exec chmod 755 {} \;
find "${SANDBOX_ROOT}" -type f -exec chmod 644 {} \;
echo "  ✅ 权限已设置: nginx:nginx + 755/644"

echo ""
echo "✅ 沙盒初始化完成: ${DEV_ID}"
