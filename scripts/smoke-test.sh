#!/bin/bash
# smoke-test.sh — 冒烟检查脚本（铸渊 · 光湖沙盒部署自动化）
# 用法: bash smoke-test.sh
# 检查所有已注册模块的 HTTP 可达性

set -uo pipefail

HOST="${DEPLOY_HOST:-localhost}"
PROTOCOL="${SMOKE_PROTOCOL:-https}"
BASE_URL="${PROTOCOL}://${HOST}"

echo "🔥 smoke-test · 冒烟检查"
echo "🌐 目标: ${BASE_URL}"
echo ""

TOTAL=0
PASSED=0
FAILED=0
RESULTS=""

smoke_check() {
  local path="$1"
  local name="$2"
  TOTAL=$((TOTAL + 1))

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}${path}" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
    RESULTS="${RESULTS}\n  ✅ ${name} (${path}) → HTTP ${HTTP_CODE}"
    PASSED=$((PASSED + 1))
  else
    RESULTS="${RESULTS}\n  ❌ ${name} (${path}) → HTTP ${HTTP_CODE} · 异常"
    FAILED=$((FAILED + 1))
  fi
}

# 主站检查
smoke_check "/" "主站首页"
smoke_check "/api/health" "API 健康检查"

# 已注册模块检查（从 dev-registry.json 动态读取或使用默认列表）
REGISTRY_FILE="/var/www/deploy-status/dev-registry.json"
if [ -f "$REGISTRY_FILE" ]; then
  # 从注册表动态提取模块路径
  MODULES=$(python3 -c "
import json
with open('$REGISTRY_FILE') as f:
    data = json.load(f)
for dev_id, info in data.items():
    for mod in info.get('modules', []):
        print(f'{dev_id}/{mod}')
" 2>/dev/null || echo "")

  if [ -n "$MODULES" ]; then
    while IFS= read -r mod_path; do
      smoke_check "/${mod_path}/" "${mod_path}"
    done <<< "$MODULES"
  fi
else
  # 默认模块列表
  smoke_check "/status-board/" "看板模块"
  smoke_check "/cost-control/" "成本控制模块"
fi

# 输出结果汇总
echo "===== 冒烟检查结果 ====="
echo -e "$RESULTS"
echo ""
echo "📊 总计: ${TOTAL} | ✅ 通过: ${PASSED} | ❌ 异常: ${FAILED}"

if [ "$FAILED" -gt 0 ]; then
  echo "⚠️ 有 ${FAILED} 个模块冒烟检查异常"
else
  echo "✅ 全部通过"
fi
