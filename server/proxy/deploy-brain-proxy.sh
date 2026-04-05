#!/bin/bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
# server/proxy/deploy-brain-proxy.sh
# 🚀 铸渊专线V2 · 大脑服务器部署脚本
#
# 在大脑服务器(ZY-SVR-005)上执行
# 部署多用户VPN系统 (独立于面孔服务器的V1)
#
# 用法:
#   bash deploy-brain-proxy.sh install     — 首次安装
#   bash deploy-brain-proxy.sh update      — 更新代码
#   bash deploy-brain-proxy.sh status      — 检查状态
#   bash deploy-brain-proxy.sh restart     — 重启服务
#   bash deploy-brain-proxy.sh add-user <email> [quota_gb]  — 添加用户
#   bash deploy-brain-proxy.sh remove-user <email>          — 移除用户
#   bash deploy-brain-proxy.sh list-users                   — 列出用户
# ═══════════════════════════════════════════════

set -uo pipefail

PROXY_DIR="/opt/zhuyuan-brain/proxy"
REPO_PROXY_DIR="$(dirname "$0")"
ACTION="${1:-status}"

echo "════════════════════════════════════════"
echo "🌐 铸渊专线V2 · 大脑服务器部署 · action=$ACTION"
echo "════════════════════════════════════════"

# ── 共用: 确保Xray以root运行 ──
ensure_xray_root_user() {
    if [ ! -f /etc/systemd/system/xray.service.d/override.conf ]; then
        mkdir -p /etc/systemd/system/xray.service.d
        cat > /etc/systemd/system/xray.service.d/override.conf <<EOF
[Service]
User=root
EOF
        systemctl daemon-reload
        echo "  ✅ Xray服务已配置为root用户运行"
    fi
}

# ── install: 首次完整安装 ─────────────────────
install() {
    echo ""
    echo "═══ [1/7] 安装Xray-core + BBR ═══"
    bash "$REPO_PROXY_DIR/setup/install-xray.sh"

    echo ""
    echo "═══ [2/7] 创建V2目录结构 ═══"
    mkdir -p "$PROXY_DIR"/{config,data,logs,service}

    echo ""
    echo "═══ [3/7] 生成V2密钥 ═══"
    generate_v2_keys

    echo ""
    echo "═══ [4/7] 部署V2服务代码 ═══"
    deploy_services

    echo ""
    echo "═══ [5/7] 配置Xray ═══"
    ensure_xray_root_user
    mkdir -p "$PROXY_DIR/logs"
    chmod 755 "$PROXY_DIR/logs"
    # Xray配置由user-manager动态生成，初始为空用户
    node "$PROXY_DIR/service/user-manager.js" rebuild 2>/dev/null || {
        echo "  ⚠️ 初始Xray配置为空(无用户)，添加用户后自动生成"
    }

    systemctl enable xray
    systemctl restart xray 2>/dev/null || true
    sleep 2

    echo ""
    echo "═══ [6/7] 启动PM2服务 ═══"
    start_pm2_services

    echo ""
    echo "═══ [7/7] 健康检查 ═══"
    health_check

    echo ""
    echo "════════════════════════════════════════"
    echo "✅ 铸渊专线V2安装完成 (大脑服务器)"
    echo ""
    echo "下一步:"
    echo "  1. 将生成的密钥添加到GitHub Secrets"
    echo "  2. 添加用户: bash deploy-brain-proxy.sh add-user <email>"
    echo "  3. 配置腾讯云防火墙: 开放443端口"
    echo "════════════════════════════════════════"
}

# ── 生成V2独立密钥 ────────────────────────────
generate_v2_keys() {
    KEYS_FILE="$PROXY_DIR/.env.keys"

    # 如果已有密钥文件，跳过
    if [ -f "$KEYS_FILE" ] && grep -q "ZY_PROXY_REALITY_PRIVATE_KEY" "$KEYS_FILE" 2>/dev/null; then
        echo "  密钥文件已存在，跳过生成"
        return
    fi

    echo "  生成V2独立密钥..."

    # Reality密钥对
    PRIVATE_KEY=""
    PUBLIC_KEY=""

    if command -v xray &>/dev/null; then
        KEYS_OUTPUT=$(xray x25519 2>&1)
        PRIVATE_KEY=$(echo "$KEYS_OUTPUT" | grep -i "private" | awk '{print $NF}') || true
        PUBLIC_KEY=$(echo "$KEYS_OUTPUT" | grep -i "public" | awk '{print $NF}') || true
    fi

    if [ -z "$PRIVATE_KEY" ] && command -v openssl &>/dev/null; then
        TMPKEY=$(mktemp)
        if openssl genpkey -algorithm X25519 -out "$TMPKEY" 2>/dev/null; then
            PRIVATE_KEY=$(openssl pkey -in "$TMPKEY" -outform DER 2>/dev/null | tail -c 32 | base64 | tr '+/' '-_' | tr -d '=')
            PUBLIC_KEY=$(openssl pkey -in "$TMPKEY" -pubout -outform DER 2>/dev/null | tail -c 32 | base64 | tr '+/' '-_' | tr -d '=')
        fi
        rm -f "$TMPKEY"
    fi

    if [ -z "$PRIVATE_KEY" ]; then
        echo "  ❌ 无法生成X25519密钥"
        exit 1
    fi

    SHORT_ID=$(openssl rand -hex 8)

    cat > "$KEYS_FILE" <<EOF
# 铸渊专线V2密钥 · 大脑服务器 · 自动生成 · $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ⚠️ 仅root可读 · 不可提交到仓库
# ⚠️ V2密钥独立于V1 · 两套VPN互不影响
ZY_PROXY_REALITY_PRIVATE_KEY=$PRIVATE_KEY
ZY_PROXY_REALITY_PUBLIC_KEY=$PUBLIC_KEY
ZY_PROXY_REALITY_SHORT_ID=$SHORT_ID
EOF

    # 保存服务器地址
    if [ -n "${ZY_BRAIN_HOST:-}" ]; then
        echo "ZY_BRAIN_HOST=${ZY_BRAIN_HOST}" >> "$KEYS_FILE"
    elif [ -n "${ZY_SERVER_HOST:-}" ]; then
        echo "ZY_SERVER_HOST=${ZY_SERVER_HOST}" >> "$KEYS_FILE"
    fi

    # 保存面孔服务器节点信息 (多节点智能选路)
    if [ -n "${ZY_FACE_HOST:-}" ]; then
        echo "" >> "$KEYS_FILE"
        echo "# 面孔服务器节点 (ZY-SVR-002 · SG2 · 多节点智能选路)" >> "$KEYS_FILE"
        echo "ZY_FACE_HOST=${ZY_FACE_HOST}" >> "$KEYS_FILE"
    fi
    if [ -n "${ZY_FACE_REALITY_PUBLIC_KEY:-}" ]; then
        echo "ZY_FACE_REALITY_PUBLIC_KEY=${ZY_FACE_REALITY_PUBLIC_KEY}" >> "$KEYS_FILE"
    fi
    if [ -n "${ZY_FACE_REALITY_SHORT_ID:-}" ]; then
        echo "ZY_FACE_REALITY_SHORT_ID=${ZY_FACE_REALITY_SHORT_ID}" >> "$KEYS_FILE"
    fi

    # 保存CN中转节点信息
    if [ -n "${ZY_CN_RELAY_HOST:-}" ]; then
        echo "" >> "$KEYS_FILE"
        echo "# CN中转节点 (国内→SG · 低延迟)" >> "$KEYS_FILE"
        echo "ZY_CN_RELAY_HOST=${ZY_CN_RELAY_HOST}" >> "$KEYS_FILE"
        echo "ZY_CN_RELAY_PORT=${ZY_CN_RELAY_PORT:-2053}" >> "$KEYS_FILE"
    fi

    chmod 600 "$KEYS_FILE"

    echo ""
    echo "  ══════════ V2密钥已生成 ══════════"
    echo "  ⚠️ 密钥已保存到: $KEYS_FILE (权限600·仅root可读)"
    echo "  ⚠️ 如需查看密钥，请SSH到服务器执行: cat $KEYS_FILE"
    echo "  ⚠️ 部署完成后，将公钥和ShortID添加到GitHub Secrets:"
    echo "     ZY_BRAIN_PROXY_REALITY_PUBLIC_KEY"
    echo "     ZY_BRAIN_PROXY_REALITY_SHORT_ID"
    echo "  ═══════════════════════════════════"
}

# ── 部署V2服务代码 ────────────────────────────
deploy_services() {
    mkdir -p "$PROXY_DIR"/{service,data,logs,config}

    # 复制V2服务文件
    cp "$REPO_PROXY_DIR"/service/user-manager.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/service/subscription-server-v2.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/service/traffic-monitor-v2.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/service/zy-cloud-vpn.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/service/vpn-worker.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/ecosystem.brain-proxy.config.js "$PROXY_DIR/"

    # 复制共用文件(发邮件等)
    cp "$REPO_PROXY_DIR"/service/send-subscription.js "$PROXY_DIR/service/" 2>/dev/null || true

    echo "✅ V2服务代码已部署到 $PROXY_DIR"
}

# ── 启动PM2服务 ───────────────────────────────
start_pm2_services() {
    cd "$PROXY_DIR" || { echo "❌ 无法进入 $PROXY_DIR"; return 1; }

    # 加载密钥作为环境变量
    if [ -f "$PROXY_DIR/.env.keys" ]; then
        set -a
        # shellcheck source=/dev/null
        source "$PROXY_DIR/.env.keys"
        set +a
    fi

    pm2 startOrRestart ecosystem.brain-proxy.config.js --update-env
    pm2 save
    echo "✅ V2 PM2服务已就绪"
    pm2 list
}

# ── 健康检查 ──────────────────────────────────
health_check() {
    echo "检查V2服务状态..."

    # Xray
    if systemctl is-active --quiet xray 2>/dev/null; then
        echo "  ✅ Xray: 运行中"
    else
        echo "  ⚠️ Xray: 未运行 (可能还没有用户)"
    fi

    # 443端口
    if ss -tlnp | grep -q ":443 "; then
        echo "  ✅ 端口443: 监听中"
    else
        echo "  ⚠️ 端口443: 未监听 (添加用户后启动)"
    fi

    # V2订阅服务
    if curl -sf http://127.0.0.1:3803/health >/dev/null 2>&1; then
        HEALTH=$(curl -sf http://127.0.0.1:3803/health)
        USERS=$(echo "$HEALTH" | grep -o '"users_count":[0-9]*' | cut -d: -f2)
        echo "  ✅ V2订阅服务: 正常 (${USERS:-0}个用户)"
    else
        echo "  ❌ V2订阅服务: 端口3803无响应"
    fi

    # PM2
    pm2 list 2>/dev/null || echo "  ⚠️ PM2: 未配置"

    # 用户列表
    echo ""
    echo "  ═══ 用户列表 ═══"
    node "$PROXY_DIR/service/user-manager.js" list 2>/dev/null || echo "  (无用户)"

    # 云防火墙提醒
    echo ""
    echo "  ═══ 云防火墙提醒 ═══"
    echo "  ⚠️ 大脑服务器腾讯云控制台防火墙需开放:"
    echo "     TCP 443 端口 允许所有来源 (0.0.0.0/0) ← VPN入口"
    echo "     TCP 22 端口 允许所有来源 ← SSH管理"
}

# ── update: 更新代码 ──────────────────────────
update() {
    echo "更新V2代理服务..."
    deploy_services
    ensure_xray_root_user
    mkdir -p "$PROXY_DIR/logs"
    chmod 755 "$PROXY_DIR/logs"

    # 重建Xray配置（根据当前用户列表）
    node "$PROXY_DIR/service/user-manager.js" rebuild 2>/dev/null || true
    systemctl restart xray 2>/dev/null || true

    # 确保UFW开放443
    if command -v ufw &>/dev/null; then
        ufw allow 443/tcp comment "Xray VLESS+Reality V2" 2>/dev/null || true
    fi

    start_pm2_services
    health_check
    echo "✅ V2更新完成"
}

# ── restart: 重启 ─────────────────────────────
restart() {
    echo "重启V2代理服务..."
    systemctl restart xray 2>/dev/null || true
    start_pm2_services
    sleep 3
    health_check
}

# ── add-user: 添加用户 ────────────────────────
add_user() {
    EMAIL="${2:-}"
    QUOTA="${3:-500}"

    if [ -z "$EMAIL" ]; then
        echo "用法: bash deploy-brain-proxy.sh add-user <email> [quota_gb]"
        exit 1
    fi

    node "$PROXY_DIR/service/user-manager.js" add "$EMAIL" "$QUOTA"
}

# ── remove-user: 移除用户 ─────────────────────
remove_user() {
    EMAIL="${2:-}"

    if [ -z "$EMAIL" ]; then
        echo "用法: bash deploy-brain-proxy.sh remove-user <email>"
        exit 1
    fi

    node "$PROXY_DIR/service/user-manager.js" remove "$EMAIL"
}

# ── list-users: 列出用户 ──────────────────────
list_users() {
    node "$PROXY_DIR/service/user-manager.js" list
}

# ── 执行 ──────────────────────────────────────
case "$ACTION" in
    install)      install ;;
    update)       update ;;
    status)       health_check ;;
    restart)      restart ;;
    add-user)     add_user "$@" ;;
    remove-user)  remove_user "$@" ;;
    list-users)   list_users ;;
    *)
        echo "用法: bash deploy-brain-proxy.sh {install|update|status|restart|add-user|remove-user|list-users}"
        exit 1
        ;;
esac
