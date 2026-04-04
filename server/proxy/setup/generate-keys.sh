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

set -uo pipefail
# 注意: 不使用 set -e，手动处理错误以确保密钥生成的健壮性

# 清理临时文件
_TMPFILES=()
cleanup_tmp() { for f in "${_TMPFILES[@]}"; do rm -f "$f" 2>/dev/null; done; }
trap cleanup_tmp EXIT

# 工具函数: 将二进制数据转为base64url编码
to_base64url() {
    base64 | tr '+/' '-_' | tr -d '='
}

echo "════════════════════════════════════════"
echo "🔑 铸渊专线 · 密钥生成"
echo "════════════════════════════════════════"
echo ""

HAS_ERROR=0

# ── 生成UUID ─────────────────────────────────
UUID=$(xray uuid 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16 | sed 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{12\}\)/\1-\2-\3-\4-\5/')
echo "ZY_PROXY_UUID=$UUID"

# ── 生成Reality X25519密钥对 ──────────────────
PRIVATE_KEY=""
PUBLIC_KEY=""

# 方法1: 使用 xray x25519
if command -v xray &>/dev/null; then
    echo "  尝试 xray x25519 ..."
    KEYS_OUTPUT=""
    KEYS_STDERR=""

    # 捕获stdout和stderr分别处理
    KEYS_STDERR_FILE=$(mktemp)
    _TMPFILES+=("$KEYS_STDERR_FILE")
    KEYS_OUTPUT=$(xray x25519 2>"$KEYS_STDERR_FILE") || true
    KEYS_STDERR=$(cat "$KEYS_STDERR_FILE" 2>/dev/null) || true
    rm -f "$KEYS_STDERR_FILE"

    # 如果stdout为空，尝试从stderr获取（某些版本输出到stderr）
    if [ -z "$KEYS_OUTPUT" ] && [ -n "$KEYS_STDERR" ]; then
        echo "  xray x25519 输出在stderr，自动切换"
        KEYS_OUTPUT="$KEYS_STDERR"
    fi

    if [ -n "$KEYS_OUTPUT" ]; then
        # 灵活解析: 支持多种输出格式
        # 格式1: "Private key: <key>" (标准格式)
        # 格式2: "PrivateKey: <key>"
        # 格式3: 仅输出两行key
        PRIVATE_KEY=$(echo "$KEYS_OUTPUT" | grep -i "private" | awk '{print $NF}') || true
        PUBLIC_KEY=$(echo "$KEYS_OUTPUT" | grep -i "public" | awk '{print $NF}') || true

        # 如果上面的解析失败，尝试按行解析（假设第一行私钥第二行公钥）
        if [ -z "$PRIVATE_KEY" ]; then
            LINE_COUNT=$(echo "$KEYS_OUTPUT" | wc -l)
            if [ "$LINE_COUNT" -ge 2 ]; then
                PRIVATE_KEY=$(echo "$KEYS_OUTPUT" | sed -n '1p' | awk '{print $NF}')
                PUBLIC_KEY=$(echo "$KEYS_OUTPUT" | sed -n '2p' | awk '{print $NF}')
            fi
        fi
    fi

    if [ -n "$PRIVATE_KEY" ] && [ -n "$PUBLIC_KEY" ]; then
        echo "  ✅ xray x25519 密钥生成成功"
    else
        echo "  ⚠️ xray x25519 解析失败"
        if [ -n "$KEYS_OUTPUT" ]; then
            echo "  stdout: $KEYS_OUTPUT"
        fi
        if [ -n "$KEYS_STDERR" ]; then
            echo "  stderr: $KEYS_STDERR"
        fi
        PRIVATE_KEY=""
        PUBLIC_KEY=""
    fi
fi

# 方法2: 使用 openssl 生成 X25519 密钥
if [ -z "$PRIVATE_KEY" ] && command -v openssl &>/dev/null; then
    echo "  尝试 openssl X25519 ..."
    TMPKEY=$(mktemp)

    if openssl genpkey -algorithm X25519 -out "$TMPKEY" 2>/dev/null; then
        # 从DER格式提取原始32字节密钥，转为base64url (43字符)
        PRIVATE_KEY=$(openssl pkey -in "$TMPKEY" -outform DER 2>/dev/null \
            | tail -c 32 | to_base64url) || true
        PUBLIC_KEY=$(openssl pkey -in "$TMPKEY" -pubout -outform DER 2>/dev/null \
            | tail -c 32 | to_base64url) || true
    fi
    rm -f "$TMPKEY"

    if [ -n "$PRIVATE_KEY" ]; then
        echo "  ✅ openssl X25519 密钥生成成功"
        if [ -z "$PUBLIC_KEY" ]; then
            PUBLIC_KEY="(需要在服务器上运行 xray x25519 重新生成公钥)"
        fi
    else
        echo "  ⚠️ openssl X25519 生成失败"
    fi
fi

# 方法3: 最终兜底 - 生成随机占位密钥
if [ -z "$PRIVATE_KEY" ]; then
    echo "  ⚠️ 所有X25519生成方法均失败，使用随机占位密钥"
    echo "  ⚠️ 请在服务器上手动运行: xray x25519"
    echo "  ⚠️ Reality公钥为占位符，VPN不可用直到手动替换"
    PRIVATE_KEY=$(openssl rand 32 | to_base64url | head -c 43)
    PUBLIC_KEY="PLACEHOLDER_REGENERATE_WITH_XRAY_X25519"
    HAS_ERROR=1
fi

echo ""
echo "ZY_PROXY_REALITY_PRIVATE_KEY=$PRIVATE_KEY"
if [ "$PUBLIC_KEY" = "PLACEHOLDER_REGENERATE_WITH_XRAY_X25519" ]; then
    echo "ZY_PROXY_REALITY_PUBLIC_KEY=$PUBLIC_KEY"
    echo ""
    echo "❌ 公钥生成失败！请在服务器上手动执行以下步骤："
    echo "   1. SSH到服务器: ssh root@your-server"
    echo "   2. 运行: xray x25519"
    echo "   3. 将输出的Public key添加到GitHub Secrets: ZY_PROXY_REALITY_PUBLIC_KEY"
else
    echo "ZY_PROXY_REALITY_PUBLIC_KEY=$PUBLIC_KEY"
fi

# ── 生成ShortId ──────────────────────────────
SHORT_ID=$(openssl rand -hex 8 || head -c 8 /dev/urandom | xxd -p)
echo "ZY_PROXY_REALITY_SHORT_ID=$SHORT_ID"

# ── 生成订阅Token ────────────────────────────
SUB_TOKEN=$(openssl rand -hex 32 || head -c 32 /dev/urandom | xxd -p)
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

if [ "$HAS_ERROR" -eq 1 ]; then
    echo ""
    echo "⚠️  密钥生成使用了占位符，请手动重新生成:"
    echo "    ssh root@<server> 'xray x25519'"
    echo "    然后更新 $KEYS_FILE 和 GitHub Secrets"
fi
