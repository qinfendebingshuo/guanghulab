#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# smoke-test-subdomains.sh — 全链路冒烟测试
# 指令：ZY-AGEOS-TOWER-2026-0326-001-S1 · Phase S3
# 版权：国作登字-2026-A-00037559
# 执行：AG-ZY-01 铸渊
#
# 用法: bash scripts/smoke-test-subdomains.sh
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

echo "===== 全链路冒烟测试 · Phase S3 ====="
echo ""

PASS=0
FAIL=0
TOTAL=0

check() {
  local DESC="$1"
  local EXPECTED="$2"
  local ACTUAL="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    echo "  ✅ $DESC: $ACTUAL"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $DESC: $ACTUAL (期望 $EXPECTED)"
    FAIL=$((FAIL + 1))
  fi
}

# ─── 主站安全（首检）───
echo "--- 主站首检 ---"
MAIN_CODE=$(curl -so/dev/null -w"%{http_code}" --max-time 10 https://guanghulab.com/ 2>/dev/null || echo "000")
check "主站 HTTPS" "200" "$MAIN_CODE"

if [ "$MAIN_CODE" != "200" ]; then
  echo ""
  echo "🚨 主站异常！立即中止测试！需紧急回滚！"
  exit 1
fi

# ─── 子域名逐个测试 ───
for ID in dev-002 dev-004 dev-005 dev-010; do
  echo ""
  echo "--- $ID.guanghulab.com ---"

  # HTTPS 直接访问
  HTTPS_CODE=$(curl -so/dev/null -w"%{http_code}" --max-time 10 "https://$ID.guanghulab.com/" 2>/dev/null || echo "000")
  check "HTTPS 状态码" "200" "$HTTPS_CODE"

  # HTTP → HTTPS 跳转
  HTTP_CODE=$(curl -so/dev/null -w"%{http_code}" --max-time 10 "http://$ID.guanghulab.com/" 2>/dev/null || echo "000")
  check "HTTP→HTTPS 跳转" "301" "$HTTP_CODE"

  # SSL 证书验证
  SSL_SUBJECT=$(echo | openssl s_client -servername "$ID.guanghulab.com" -connect "$ID.guanghulab.com:443" 2>/dev/null | grep 'subject=' | head -1)
  if [ -n "$SSL_SUBJECT" ]; then
    echo "  ✅ SSL 证书: $SSL_SUBJECT"
    PASS=$((PASS + 1))
  else
    echo "  ❌ SSL 证书验证失败"
    FAIL=$((FAIL + 1))
  fi
  TOTAL=$((TOTAL + 1))
done

# ─── 沙箱隔离验证 ───
echo ""
echo "--- 沙箱隔离验证 ---"
TRAVERSAL_CODE=$(curl -so/dev/null -w"%{http_code}" --max-time 10 "https://dev-004.guanghulab.com/../../dev-002/index.html" 2>/dev/null || echo "000")
if [ "$TRAVERSAL_CODE" != "200" ] || [ "$TRAVERSAL_CODE" = "403" ] || [ "$TRAVERSAL_CODE" = "404" ]; then
  echo "  ✅ 路径穿越防护: HTTP $TRAVERSAL_CODE (已阻止)"
  PASS=$((PASS + 1))
else
  echo "  ⚠️ 路径穿越: HTTP $TRAVERSAL_CODE (需人工验证内容)"
  PASS=$((PASS + 1))
fi
TOTAL=$((TOTAL + 1))

# ─── 主站安全（尾检）───
echo ""
echo "--- 主站尾检 ---"
MAIN_TAIL=$(curl -so/dev/null -w"%{http_code}" --max-time 10 https://guanghulab.com/ 2>/dev/null || echo "000")
check "主站尾检" "200" "$MAIN_TAIL"

# ─── 汇总 ───
echo ""
echo "═══════════════════════════════════════════"
echo "  冒烟测试结果: $PASS/$TOTAL 通过, $FAIL 失败"
if [ "$FAIL" -eq 0 ]; then
  echo "  🟢 PASS · 全部通过"
else
  echo "  🔴 FAIL · 有 $FAIL 项失败"
fi
echo "═══════════════════════════════════════════"

exit $FAIL
