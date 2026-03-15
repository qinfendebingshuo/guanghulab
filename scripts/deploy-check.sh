#!/bin/bash
# deploy-check.sh — 部署前自检脚本（铸渊 · 光湖沙盒部署自动化）
# 用法: bash deploy-check.sh <DEV_ID> <MODULE>
# 返回: 检查结果（PASS / FAIL + 原因）

set -euo pipefail

DEV_ID="${1:-}"
MODULE="${2:-}"

if [ -z "$DEV_ID" ] || [ -z "$MODULE" ]; then
  echo "❌ FAIL: 缺少参数 (用法: deploy-check.sh DEV-XXX module-name)"
  exit 1
fi

SANDBOX="/var/www/${DEV_ID}/${MODULE}"
FAIL_COUNT=0
RESULTS=""

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "PASS" ]; then
    RESULTS="${RESULTS}\n  ✅ ${name}: PASS"
  else
    RESULTS="${RESULTS}\n  ❌ ${name}: FAIL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "🔍 deploy-check · ${DEV_ID}/${MODULE}"
echo "📂 检查目标: ${SANDBOX}"
echo ""

# 1. 目录存在性检查
if [ -d "$SANDBOX" ]; then
  check "目录存在" "PASS"
else
  check "目录存在" "FAIL"
  echo "❌ FAIL: 沙盒目录 ${SANDBOX} 不存在"
  exit 1
fi

# 2. 文件数量检查（至少有 1 个文件）
FILE_COUNT=$(find "$SANDBOX" -type f | wc -l)
if [ "$FILE_COUNT" -gt 0 ]; then
  check "文件数量(${FILE_COUNT}个)" "PASS"
else
  check "文件数量" "FAIL"
fi

# 3. 权限检查（目录 755, 文件 644）
BAD_DIRS=$(find "$SANDBOX" -type d ! -perm 755 2>/dev/null | wc -l)
if [ "$BAD_DIRS" -eq 0 ]; then
  check "目录权限(755)" "PASS"
else
  check "目录权限(755) - ${BAD_DIRS}个目录权限异常" "FAIL"
fi

BAD_FILES=$(find "$SANDBOX" -type f ! -perm 644 2>/dev/null | wc -l)
if [ "$BAD_FILES" -eq 0 ]; then
  check "文件权限(644)" "PASS"
else
  check "文件权限(644) - ${BAD_FILES}个文件权限异常" "FAIL"
fi

# 4. 所有者检查（nginx:nginx）
OWNER=$(stat -c '%U:%G' "$SANDBOX" 2>/dev/null || echo "unknown")
if [ "$OWNER" = "nginx:nginx" ]; then
  check "所有者(nginx:nginx)" "PASS"
else
  check "所有者(当前: ${OWNER})" "FAIL"
fi

# 5. 入口文件检查（index.html 或 index.js 或 package.json）
if [ -f "${SANDBOX}/index.html" ] || [ -f "${SANDBOX}/index.js" ] || [ -f "${SANDBOX}/package.json" ]; then
  check "入口文件" "PASS"
else
  check "入口文件(缺少 index.html/index.js/package.json)" "FAIL"
fi

# 6. 敏感文件检查
SENSITIVE_FILES=(".env" ".dev-profile" "node_modules")
HAS_SENSITIVE=false
for sf in "${SENSITIVE_FILES[@]}"; do
  if [ -e "${SANDBOX}/${sf}" ]; then
    HAS_SENSITIVE=true
    break
  fi
done
if [ "$HAS_SENSITIVE" = false ]; then
  check "无敏感文件" "PASS"
else
  check "发现敏感文件" "FAIL"
fi

# 输出结果汇总
echo "===== 自检结果 ====="
echo -e "$RESULTS"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "✅ 全部通过 (${DEV_ID}/${MODULE})"
else
  echo "❌ FAIL: ${FAIL_COUNT} 项检查未通过 (${DEV_ID}/${MODULE})"
fi
