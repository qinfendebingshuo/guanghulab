#!/bin/bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
# server/proxy/deploy-brain-proxy.sh
# 🚀 铸渊专线V2 + 光湖语言世界V3 · 大脑服务器部署脚本
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
#   bash deploy-brain-proxy.sh deploy-v3   — 部署V3测试环境
#   bash deploy-brain-proxy.sh switch-v3   — 切换V2→V3 (用户刷新即升级)
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
    echo "═══ [1/8] 安装Xray-core + BBR ═══"
    bash "$REPO_PROXY_DIR/setup/install-xray.sh"

    echo ""
    echo "═══ [2/8] 创建V2目录结构 ═══"
    mkdir -p "$PROXY_DIR"/{config,data,logs,service}

    echo ""
    echo "═══ [3/8] 生成V2密钥 ═══"
    generate_v2_keys

    echo ""
    echo "═══ [4/8] 部署V2服务代码 ═══"
    deploy_services

    echo ""
    echo "═══ [5/8] 配置Xray ═══"
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
    echo "═══ [6/8] 配置Nginx反向代理 ═══"
    configure_nginx

    echo ""
    echo "═══ [7/8] 启动PM2服务 ═══"
    start_pm2_services

    echo ""
    echo "═══ [8/8] 健康检查 ═══"
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

    # 复制V3服务文件 (独立运行·不影响V2)
    cp "$REPO_PROXY_DIR"/service/subscription-server-v3.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/service/llm-router.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/service/reverse-boost-agent.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/service/proxy-guardian.js "$PROXY_DIR/service/"
    cp "$REPO_PROXY_DIR"/ecosystem.brain-proxy-v3.config.js "$PROXY_DIR/"

    # 复制V2 Nginx配置参考
    cp "$REPO_PROXY_DIR"/config/nginx-brain-proxy-snippet.conf "$PROXY_DIR/config/" 2>/dev/null || true
    cp "$REPO_PROXY_DIR"/config/nginx-brain-proxy-v3-snippet.conf "$PROXY_DIR/config/" 2>/dev/null || true

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

# ── 配置Nginx反向代理 (V2·端口3803) ──────────
configure_nginx() {
    # 安装Nginx (如果未安装)
    if ! command -v nginx &>/dev/null; then
        echo "  安装Nginx..."
        if apt-get update -qq && apt-get install -y nginx 2>&1 | tail -5; then
            systemctl enable nginx
            echo "  ✅ Nginx已安装"
        else
            echo "  ❌ Nginx安装失败"
            return 1
        fi
    fi

    # 查找Nginx配置文件
    NGINX_CONF=""
    for candidate in /etc/nginx/sites-enabled/zhuyuan-brain.conf /etc/nginx/sites-enabled/default; do
        if [ -f "$candidate" ]; then
            NGINX_CONF="$candidate"
            break
        fi
    done

    # 如果没有配置文件，创建大脑服务器专用配置
    if [ -z "$NGINX_CONF" ]; then
        NGINX_CONF="/etc/nginx/sites-enabled/zhuyuan-brain.conf"
        echo "  创建大脑服务器Nginx配置..."
        cat > "$NGINX_CONF" <<'NGINXEOF'
server {
    listen 80 default_server;
    server_name localhost 127.0.0.1;

    # ─── 铸渊专线V2订阅服务 (端口 3803) ───
    location /api/proxy-v2/ {
        proxy_pass http://127.0.0.1:3803/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options DENY always;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }

    # ─── 健康探针 ───
    location = /health {
        return 200 '{"status":"ok","server":"ZY-SVR-005-brain"}';
        add_header Content-Type application/json;
    }
}
NGINXEOF
        # 移除默认配置避免冲突
        if [ -f /etc/nginx/sites-enabled/default ] && [ "$NGINX_CONF" != "/etc/nginx/sites-enabled/default" ]; then
            rm -f /etc/nginx/sites-enabled/default
            echo "  ✅ 已移除冲突的default配置"
        fi
        echo "  ✅ 已创建大脑服务器Nginx配置"
    else
        echo "  使用现有Nginx配置: $NGINX_CONF"

        # 修复端口错误: 如果存在3802端口配置，替换为3803
        if grep -q "proxy_pass.*127\.0\.0\.1:3802" "$NGINX_CONF" 2>/dev/null; then
            sed -i 's|proxy_pass[[:space:]]*http://127\.0\.0\.1:3802|proxy_pass http://127.0.0.1:3803|g' "$NGINX_CONF"
            echo "  ✅ 已修复端口: 3802 → 3803"
        fi

        # 修复路径错误: 如果V2配置仍使用旧的 /api/proxy-sub/ 路径，替换为 /api/proxy-v2/
        if grep -q "location.*/api/proxy-sub/" "$NGINX_CONF" 2>/dev/null && grep -q "127\.0\.0\.1:3803" "$NGINX_CONF" 2>/dev/null; then
            sed -i 's|location /api/proxy-sub/|location /api/proxy-v2/|g' "$NGINX_CONF"
            echo "  ✅ 已修复V2路径: /api/proxy-sub/ → /api/proxy-v2/"
        fi

        # 如果没有proxy-v2配置，注入V2配置
        if ! grep -q "proxy-v2" "$NGINX_CONF" 2>/dev/null; then
            echo "  添加V2订阅服务反向代理配置..."
            # 在server块内的最后一个location之后、server块结束}之前插入
            # 使用更安全的锚点: 匹配server块内的 } (缩进的)
            sed -i '/^[[:space:]]*location/,/^[[:space:]]*}/ {
                # 找到最后一个location块结束后的位置
            }' "$NGINX_CONF" 2>/dev/null || true

            # 使用perl进行更安全的插入（在server块的最后一个}之前）
            if command -v perl &>/dev/null; then
                perl -i -0pe 's/(server\s*\{(?:(?!server\s*\{).)*?)(^\})/\1    # ─── 铸渊专线V2订阅服务 (端口 3803) ───\n    location \/api\/proxy-v2\/ {\n        proxy_pass http:\/\/127.0.0.1:3803\/;\n        proxy_http_version 1.1;\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n        proxy_connect_timeout 10s;\n        proxy_read_timeout 30s;\n        proxy_send_timeout 30s;\n        add_header X-Content-Type-Options nosniff always;\n        add_header X-Frame-Options DENY always;\n        add_header Cache-Control "no-store, no-cache, must-revalidate" always;\n    }\n\n\2/ms' "$NGINX_CONF" 2>/dev/null
            else
                # 回退: 在第一个顶层 } 之前插入
                sed -i '/^}/i\
    # ─── 铸渊专线V2订阅服务 (端口 3803) ───\
    location /api/proxy-v2/ {\
        proxy_pass http://127.0.0.1:3803/;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_connect_timeout 10s;\
        proxy_read_timeout 30s;\
        proxy_send_timeout 30s;\
        add_header X-Content-Type-Options nosniff always;\
        add_header X-Frame-Options DENY always;\
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;\
    }' "$NGINX_CONF" || true
            fi
            echo "  ✅ V2 proxy-v2配置已注入"
        else
            echo "  proxy-v2配置已存在"
        fi
    fi

    # 验证并重载Nginx
    if nginx -t 2>/dev/null; then
        if nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null; then
            echo "  ✅ Nginx配置验证通过并已重载"
        else
            echo "  ⚠️ Nginx配置有效但重载失败，尝试重启..."
            systemctl restart nginx 2>/dev/null || true
        fi
    else
        echo "  ⚠️ Nginx配置验证失败:"
        nginx -t 2>&1 || true
    fi
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

    # V3订阅服务 (如果已部署)
    if curl -sf http://127.0.0.1:3805/health >/dev/null 2>&1; then
        HEALTH3=$(curl -sf http://127.0.0.1:3805/health)
        USERS3=$(echo "$HEALTH3" | grep -o '"users_count":[0-9]*' | cut -d: -f2)
        echo "  ✅ V3订阅服务: 正常 (${USERS3:-0}个用户) · 光湖语言世界"
    else
        echo "  ⚠️ V3订阅服务: 端口3805无响应 (未部署或未启动)"
    fi

    # Nginx反向代理
    if systemctl is-active --quiet nginx 2>/dev/null; then
        if curl -sf http://127.0.0.1:80/api/proxy-v2/health >/dev/null 2>&1; then
            echo "  ✅ Nginx反代: 正常 (/api/proxy-v2/ → 3803)"
        else
            echo "  ⚠️ Nginx反代: /api/proxy-v2/ 无法访问 (检查proxy_pass端口)"
        fi
    else
        echo "  ⚠️ Nginx: 未运行"
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

    # 修复/更新Nginx反向代理配置
    configure_nginx

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

# ── deploy-v3: 部署V3测试环境 ──────────────────
# V2继续运行·V3独立启动·通过/api/proxy-v3/测试
deploy_v3() {
    echo "部署V3测试环境 (V2继续运行)..."
    deploy_services

    # 加载密钥作为环境变量
    if [ -f "$PROXY_DIR/.env.keys" ]; then
        set -a
        # shellcheck source=/dev/null
        source "$PROXY_DIR/.env.keys"
        set +a
    fi

    # 启动V3 PM2进程
    cd "$PROXY_DIR" || { echo "❌ 无法进入 $PROXY_DIR"; return 1; }
    pm2 startOrRestart ecosystem.brain-proxy-v3.config.js --update-env
    pm2 save

    # 添加V3 Nginx测试路径
    NGINX_CONF=""
    for candidate in /etc/nginx/sites-enabled/zhuyuan-brain.conf /etc/nginx/sites-enabled/default; do
        if [ -f "$candidate" ]; then
            NGINX_CONF="$candidate"
            break
        fi
    done

    if [ -n "$NGINX_CONF" ] && ! grep -q "proxy-v3" "$NGINX_CONF" 2>/dev/null; then
        echo "  添加V3测试路径..."
        sed -i '/^}/i\
    # ─── 光湖语言世界V3测试 (端口 3805) ───\
    location /api/proxy-v3/ {\
        proxy_pass http://127.0.0.1:3805/;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_connect_timeout 10s;\
        proxy_read_timeout 30s;\
        proxy_send_timeout 30s;\
        add_header X-Content-Type-Options nosniff always;\
        add_header X-Frame-Options DENY always;\
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;\
    }' "$NGINX_CONF" || true
        echo "  ✅ V3测试路径已添加"
    else
        echo "  proxy-v3配置已存在或Nginx配置未找到"
    fi

    if nginx -t 2>/dev/null; then
        nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true
        echo "  ✅ Nginx已重载"
    fi

    echo ""
    echo "════════════════════════════════════════"
    echo "✅ V3测试环境已就绪"
    echo ""
    echo "测试方法:"
    echo "  V3订阅: https://域名/api/proxy-v3/sub/{token}"
    echo "  V3仪表盘: https://域名/api/proxy-v3/dashboard/{token}"
    echo "  V3健康: https://域名/api/proxy-v3/health"
    echo ""
    echo "V2继续运行在 /api/proxy-v2/ (端口3803)"
    echo "V3测试运行在 /api/proxy-v3/ (端口3805)"
    echo ""
    echo "测试通过后执行: bash deploy-brain-proxy.sh switch-v3"
    echo "════════════════════════════════════════"

    # V3健康检查
    sleep 2
    if curl -sf http://127.0.0.1:3805/health >/dev/null 2>&1; then
        HEALTH=$(curl -sf http://127.0.0.1:3805/health)
        echo "  ✅ V3订阅服务: 正常"
        echo "  $HEALTH"
    else
        echo "  ⚠️ V3订阅服务(3805)尚未就绪，请稍等几秒后检查"
    fi
}

# ── switch-v3: 切换V2→V3 ──────────────────────
# 用户刷新订阅即获取V3配置
switch_v3() {
    echo "切换 /api/proxy-v2/ → V3 (端口3805)..."

    NGINX_CONF=""
    for candidate in /etc/nginx/sites-enabled/zhuyuan-brain.conf /etc/nginx/sites-enabled/default; do
        if [ -f "$candidate" ]; then
            NGINX_CONF="$candidate"
            break
        fi
    done

    if [ -z "$NGINX_CONF" ]; then
        echo "❌ 未找到Nginx配置文件"
        exit 1
    fi

    # 验证V3服务是否运行
    if ! curl -sf http://127.0.0.1:3805/health >/dev/null 2>&1; then
        echo "❌ V3服务(3805)未运行！请先执行 deploy-v3"
        exit 1
    fi

    # 备份当前Nginx配置
    cp "$NGINX_CONF" "${NGINX_CONF}.v2-backup"
    echo "  ✅ 已备份Nginx配置到 ${NGINX_CONF}.v2-backup"

    # 将 /api/proxy-v2/ 的 proxy_pass 从 3803 改为 3805
    if grep -q "127\.0\.0\.1:3803" "$NGINX_CONF" 2>/dev/null; then
        sed -i 's|127\.0\.0\.1:3803|127.0.0.1:3805|g' "$NGINX_CONF"
        echo "  ✅ /api/proxy-v2/ 已切换到V3 (3803→3805)"
    else
        echo "  ⚠️ 未找到3803端口配置，可能已切换"
    fi

    # 重载Nginx
    if nginx -t 2>/dev/null; then
        nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true
        echo "  ✅ Nginx已重载"
    else
        echo "  ❌ Nginx配置验证失败，回滚..."
        cp "${NGINX_CONF}.v2-backup" "$NGINX_CONF"
        nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true
        echo "  ✅ 已回滚到V2配置"
        exit 1
    fi

    echo ""
    echo "════════════════════════════════════════"
    echo "✅ V2→V3 切换完成!"
    echo ""
    echo "现在 /api/proxy-v2/sub/{token} 指向V3 (端口3805)"
    echo "用户刷新订阅即可获取「光湖语言世界」配置"
    echo ""
    echo "回滚方法 (如有问题):"
    echo "  cp ${NGINX_CONF}.v2-backup $NGINX_CONF"
    echo "  nginx -s reload"
    echo "════════════════════════════════════════"
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
    deploy-v3)    deploy_v3 ;;
    switch-v3)    switch_v3 ;;
    *)
        echo "用法: bash deploy-brain-proxy.sh {install|update|status|restart|add-user|remove-user|list-users|deploy-v3|switch-v3}"
        exit 1
        ;;
esac
