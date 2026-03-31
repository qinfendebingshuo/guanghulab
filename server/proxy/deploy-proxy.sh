#!/bin/bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
# server/proxy/deploy-proxy.sh
# 🚀 铸渊专线 · 一键部署脚本
#
# 在SG服务器上执行，完成代理服务的完整部署:
#   1. 安装Xray-core + BBR
#   2. 生成密钥
#   3. 配置Xray (从环境变量或密钥文件读取)
#   4. 配置Nginx反代
#   5. 启动PM2服务
#   6. 健康检查
#
# 用法:
#   bash deploy-proxy.sh install    — 首次安装
#   bash deploy-proxy.sh update     — 更新配置
#   bash deploy-proxy.sh status     — 检查状态
#   bash deploy-proxy.sh restart    — 重启所有服务
# ═══════════════════════════════════════════════

set -uo pipefail
# 注意: 不使用 set -e，关键步骤手动检查错误

PROXY_DIR="/opt/zhuyuan/proxy"
REPO_PROXY_DIR="$(dirname "$0")"
ACTION="${1:-status}"

echo "════════════════════════════════════════"
echo "🌐 铸渊专线 · 部署 · action=$ACTION"
echo "════════════════════════════════════════"

# ── 共用: 确保Xray以root运行 (修复User=nobody问题) ──
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

# ── 共用: 确保日志目录权限正确 ──
ensure_log_permissions() {
    mkdir -p "$PROXY_DIR/logs"
    chmod 755 "$PROXY_DIR/logs"
}

# ── 共用: 保存ZY_SERVER_HOST到.env.keys ──
save_server_host() {
    KEYS_FILE="$PROXY_DIR/.env.keys"
    if [ -n "${ZY_SERVER_HOST:-}" ] && [ -f "$KEYS_FILE" ]; then
        # 检查是否已存在
        if grep -q "^ZY_SERVER_HOST=" "$KEYS_FILE" 2>/dev/null; then
            # 更新已有的值
            sed -i "s|^ZY_SERVER_HOST=.*|ZY_SERVER_HOST=${ZY_SERVER_HOST}|" "$KEYS_FILE"
        else
            # 追加新行
            echo "" >> "$KEYS_FILE"
            echo "# 服务器地址 (部署时自动写入)" >> "$KEYS_FILE"
            echo "ZY_SERVER_HOST=${ZY_SERVER_HOST}" >> "$KEYS_FILE"
        fi
        echo "  ✅ ZY_SERVER_HOST 已保存到 .env.keys"
    elif [ -n "${ZY_SERVER_HOST:-}" ] && [ ! -f "$KEYS_FILE" ]; then
        echo "  ⚠️ .env.keys 不存在，创建并写入 ZY_SERVER_HOST"
        echo "# 服务器地址 (部署时自动写入)" > "$KEYS_FILE"
        echo "ZY_SERVER_HOST=${ZY_SERVER_HOST}" >> "$KEYS_FILE"
        chmod 600 "$KEYS_FILE"
    fi
}

# ── install: 首次完整安装 ─────────────────────
install() {
    echo ""
    echo "═══ [1/7] 安装Xray-core + BBR ═══"
    bash "$REPO_PROXY_DIR/setup/install-xray.sh"

    echo ""
    echo "═══ [2/7] 配置Xray ═══"
    if ! configure_xray; then
        echo "❌ Xray配置失败，安装中止"
        exit 1
    fi

    echo ""
    echo "═══ [3/7] 启动Xray服务 ═══"
    ensure_xray_root_user
    ensure_log_permissions

    systemctl enable xray
    systemctl restart xray
    sleep 2
    if systemctl is-active --quiet xray; then
        echo "✅ Xray运行中"
    else
        echo "❌ Xray启动失败"
        journalctl -u xray --no-pager -n 20
        exit 1
    fi

    echo ""
    echo "═══ [4/7] 部署代理服务代码 ═══"
    deploy_services
    save_server_host

    echo ""
    echo "═══ [5/7] 配置Nginx ═══"
    configure_nginx

    echo ""
    echo "═══ [6/7] 启动PM2服务 ═══"
    start_pm2_services

    echo ""
    echo "═══ [7/7] 健康检查 ═══"
    health_check

    echo ""
    echo "════════════════════════════════════════"
    echo "✅ 铸渊专线安装完成"
    echo ""
    echo "下一步:"
    echo "  1. 将生成的密钥添加到GitHub Secrets"
    echo "  2. 运行 'send-subscription' 工作流发送订阅链接"
    echo "════════════════════════════════════════"
}

# ── 配置Xray ──────────────────────────────────
configure_xray() {
    # 读取密钥 (优先环境变量, 其次密钥文件)
    KEYS_FILE="$PROXY_DIR/.env.keys"
    if [ -z "${ZY_PROXY_UUID:-}" ] && [ -f "$KEYS_FILE" ]; then
        # shellcheck source=/dev/null
        source "$KEYS_FILE"
    fi

    # 验证关键变量
    if [ -z "${ZY_PROXY_UUID:-}" ]; then
        echo "❌ 缺少 ZY_PROXY_UUID"
        echo "  请先运行 install 生成密钥，或设置环境变量"
        return 1
    fi

    if [ -z "${ZY_PROXY_REALITY_PRIVATE_KEY:-}" ]; then
        echo "❌ 缺少 ZY_PROXY_REALITY_PRIVATE_KEY"
        return 1
    fi

    if [ -z "${ZY_PROXY_REALITY_SHORT_ID:-}" ]; then
        echo "❌ 缺少 ZY_PROXY_REALITY_SHORT_ID"
        return 1
    fi

    # 用环境变量替换模板
    CONFIG_TEMPLATE="$REPO_PROXY_DIR/config/xray-config-template.json"
    CONFIG_OUTPUT="/usr/local/etc/xray/config.json"

    sed -e "s|{{ZY_PROXY_UUID}}|${ZY_PROXY_UUID}|g" \
        -e "s|{{ZY_PROXY_REALITY_PRIVATE_KEY}}|${ZY_PROXY_REALITY_PRIVATE_KEY}|g" \
        -e "s|{{ZY_PROXY_REALITY_SHORT_ID}}|${ZY_PROXY_REALITY_SHORT_ID}|g" \
        "$CONFIG_TEMPLATE" > "$CONFIG_OUTPUT"

    # 验证配置
    if xray run -test -c "$CONFIG_OUTPUT" 2>/dev/null; then
        echo "✅ Xray配置验证通过"
    else
        echo "⚠️ Xray配置验证失败，查看详情:"
        xray run -test -c "$CONFIG_OUTPUT" 2>&1 || true
        echo "  配置文件: $CONFIG_OUTPUT"
        return 1
    fi
}

# ── 部署服务代码 ──────────────────────────────
deploy_services() {
    mkdir -p "$PROXY_DIR"/{service,data,logs,dashboard}

    # 复制服务文件
    cp "$REPO_PROXY_DIR"/service/*.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/dashboard/*.js "$PROXY_DIR/dashboard/"
    cp "$REPO_PROXY_DIR"/ecosystem.proxy.config.js "$PROXY_DIR/"

    echo "✅ 服务代码已部署到 $PROXY_DIR"
}

# ── 配置Nginx ─────────────────────────────────
configure_nginx() {
    # 检查主Nginx配置是否已有proxy-sub
    NGINX_CONF="/etc/nginx/sites-enabled/default"

    if [ -f "$NGINX_CONF" ] && ! grep -q "proxy-sub" "$NGINX_CONF" 2>/dev/null; then
        echo "  添加Nginx代理订阅反向代理配置..."
        # 在第一个 location = /health 之前插入 proxy-sub location
        sed -i '/# ─── 健康探针 ───/{
            # 只在第一次匹配时插入
            i\    # ─── 铸渊专线订阅服务 (端口 3802) ───\n    location /api/proxy-sub/ {\n        proxy_pass http://127.0.0.1:3802/;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        add_header X-Content-Type-Options nosniff always;\n        add_header Cache-Control "no-store, no-cache, must-revalidate" always;\n    }\n
        }' "$NGINX_CONF" || true
        echo "  ✅ Nginx proxy-sub配置已注入"
    else
        echo "  Nginx代理配置已存在 (或主配置不存在)"
    fi

    if nginx -t 2>/dev/null; then
        nginx -s reload || true
        echo "  ✅ Nginx配置验证通过并已重载"
    fi
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

    pm2 start ecosystem.proxy.config.js
    pm2 save
    echo "✅ PM2代理服务已启动"
    pm2 list
}

# ── 健康检查 ──────────────────────────────────
health_check() {
    echo "检查服务状态..."

    # Xray
    if systemctl is-active --quiet xray; then
        echo "  ✅ Xray: 运行中"
    else
        echo "  ❌ Xray: 未运行"
    fi

    # 443端口
    if ss -tlnp | grep -q ":443 "; then
        echo "  ✅ 端口443: 监听中"
    else
        echo "  ❌ 端口443: 未监听"
    fi

    # 订阅服务
    if curl -sf http://127.0.0.1:3802/health >/dev/null 2>&1; then
        echo "  ✅ 订阅服务: 正常"
    else
        echo "  ⏳ 订阅服务: 启动中..."
    fi

    # PM2
    pm2 list 2>/dev/null || echo "  ⚠️ PM2: 未配置"
}

# ── update: 更新配置 ──────────────────────────
update() {
    echo "更新代理服务..."
    deploy_services
    save_server_host
    configure_xray

    ensure_xray_root_user
    ensure_log_permissions

    systemctl restart xray
    pm2 restart zy-proxy-sub zy-proxy-monitor zy-proxy-guardian 2>/dev/null || true
    health_check
    echo "✅ 更新完成"
}

# ── status: 检查状态 ──────────────────────────
status() {
    health_check
}

# ── restart: 重启所有 ─────────────────────────
restart() {
    echo "重启所有代理服务..."
    systemctl restart xray
    pm2 restart zy-proxy-sub zy-proxy-monitor zy-proxy-guardian 2>/dev/null || true
    sleep 3
    health_check
}

# ── 执行 ──────────────────────────────────────
case "$ACTION" in
    install)  install ;;
    update)   update ;;
    status)   status ;;
    restart)  restart ;;
    *)
        echo "用法: bash deploy-proxy.sh {install|update|status|restart}"
        exit 1
        ;;
esac
