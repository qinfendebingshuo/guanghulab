#!/bin/bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
# server/proxy/setup/generate-keys.sh
# 🔑 生成Xray VLESS + Reality所需的所有密钥
#
# 输出:
#   - UUID (VLESS用户ID)
#   - Reality X25519密钥对 (私钥/公钥)
#   - Reality ShortId
#   - 订阅访问Token
#
# ⚠️ 生成的密钥需要添加到GitHub Secrets
# ═══════════════════════════════════════════════

set -euo pipefail

echo "════════════════════════════════════════"
echo "🔑 铸渊专线 · 密钥生成"
echo "════════════════════════════════════════"
echo ""

# ── 生成UUID ─────────────────────────────────
UUID=$(xray uuid 2>/dev/null || cat /proc/sys/kernel/random/uuid)
echo "ZY_PROXY_UUID=$UUID"

# ── 生成Reality X25519密钥对 ──────────────────
if command -v xray &>/dev/null; then
    KEYS=$(xray x25519)
    PRIVATE_KEY=$(echo "$KEYS" | grep "Private key:" | awk '{print $3}')
    PUBLIC_KEY=$(echo "$KEYS" | grep "Public key:" | awk '{print $3}')
else
    # Fallback: 用openssl生成
    PRIVATE_KEY=$(openssl genpkey -algorithm X25519 2>/dev/null | openssl pkey -text -noout 2>/dev/null | grep -A5 priv: | tail -4 | tr -d ' :\n' | head -c 43)
    PUBLIC_KEY="(需要安装xray后重新生成)"
fi
echo "ZY_PROXY_REALITY_PRIVATE_KEY=$PRIVATE_KEY"
echo "ZY_PROXY_REALITY_PUBLIC_KEY=$PUBLIC_KEY"

# ── 生成ShortId ──────────────────────────────
SHORT_ID=$(openssl rand -hex 8)
echo "ZY_PROXY_REALITY_SHORT_ID=$SHORT_ID"

# ── 生成订阅Token ────────────────────────────
SUB_TOKEN=$(openssl rand -hex 32)
echo "ZY_PROXY_SUB_TOKEN=$SUB_TOKEN"

echo ""
echo "════════════════════════════════════════"
echo "⚠️  请将以上密钥添加到 GitHub Secrets"
echo ""
echo "  需要添加的Secrets:"
echo "    ZY_PROXY_UUID"
echo "    ZY_PROXY_REALITY_PRIVATE_KEY"
echo "    ZY_PROXY_REALITY_PUBLIC_KEY"
echo "    ZY_PROXY_REALITY_SHORT_ID"
echo "    ZY_PROXY_SUB_TOKEN"
echo ""
echo "  ⚠️ 这些密钥仅在此处显示一次"
echo "  ⚠️ 请立即复制到安全位置"
echo "════════════════════════════════════════"

# ── 保存到服务器本地(仅root可读) ──────────────
KEYS_FILE="/opt/zhuyuan/proxy/.env.keys"
mkdir -p /opt/zhuyuan/proxy
cat > "$KEYS_FILE" <<EOF
# 铸渊专线密钥 · 自动生成 · $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ⚠️ 仅root可读 · 不可提交到仓库
ZY_PROXY_UUID=$UUID
ZY_PROXY_REALITY_PRIVATE_KEY=$PRIVATE_KEY
ZY_PROXY_REALITY_PUBLIC_KEY=$PUBLIC_KEY
ZY_PROXY_REALITY_SHORT_ID=$SHORT_ID
ZY_PROXY_SUB_TOKEN=$SUB_TOKEN
EOF
chmod 600 "$KEYS_FILE"
echo ""
echo "密钥已保存到服务器: $KEYS_FILE (权限600)"
