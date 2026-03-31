#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 🔒 铸渊主权服务器 · SSL证书自动化配置
# ═══════════════════════════════════════════════════════════
#
# 编号: ZY-SVR-SSL-001
# 守护: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559
#
# 功能:
#   使用 Let's Encrypt (certbot) 自动获取免费SSL证书
#   自动配置 Nginx HTTPS
#   自动设置证书续期
#
# 用法:
#   sudo bash setup-ssl.sh <域名> [邮箱]
#   sudo bash setup-ssl.sh guanghulab.online admin@guanghulab.online
#   sudo bash setup-ssl.sh --all   # 配置所有已知域名
#
# 前提条件:
#   1. 域名已解析到本服务器IP
#   2. Nginx已安装并运行
#   3. 80端口可从外网访问
# ═══════════════════════════════════════════════════════════

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[铸渊SSL]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[铸渊SSL]${NC} ⚠️  $1"; }
log_error() { echo -e "${RED}[铸渊SSL]${NC} ❌ $1"; }
log_step()  { echo -e "${BLUE}[铸渊SSL]${NC} 📌 $1"; }

# ── 配置 ──────────────────────────────────────
ZY_ROOT="/opt/zhuyuan"
SSL_DIR="${ZY_ROOT}/config/ssl"
NGINX_CONF_DIR="${ZY_ROOT}/config/nginx"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
LOG_FILE="${ZY_ROOT}/data/logs/ssl-setup.log"

# ── 检查root权限 ─────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    log_error "需要root权限运行此脚本"
    log_info "请使用: sudo bash $0 $*"
    exit 1
fi

# ── 确保目录存在 ─────────────────────────────
mkdir -p "$SSL_DIR" "$NGINX_CONF_DIR" "$(dirname $LOG_FILE)"

# ── 记录日志 ─────────────────────────────────
exec > >(tee -a "$LOG_FILE") 2>&1
echo ""
echo "═══════════════════════════════════════════════"
echo "🔒 SSL配置开始 · $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S CST')"
echo "═══════════════════════════════════════════════"

# ── §1 安装 certbot ──────────────────────────
install_certbot() {
    log_step "§1 安装 certbot..."

    if command -v certbot &> /dev/null; then
        CERTBOT_VER=$(certbot --version 2>&1 | head -1)
        log_info "certbot 已安装: $CERTBOT_VER"
        return 0
    fi

    log_info "安装 certbot 和 nginx 插件..."

    # 更新包列表
    apt-get update -qq

    # 安装 certbot + nginx 插件
    apt-get install -y -qq certbot python3-certbot-nginx

    if command -v certbot &> /dev/null; then
        log_info "✅ certbot 安装成功"
    else
        log_error "certbot 安装失败"
        exit 1
    fi
}

# ── §2 验证域名解析 ──────────────────────────
verify_domain() {
    local domain="$1"
    log_step "§2 验证域名解析: $domain"

    # 获取本机公网IP
    local server_ip
    server_ip=$(curl -sf --max-time 5 https://api.ipify.org 2>/dev/null || curl -sf --max-time 5 https://ifconfig.me 2>/dev/null || echo "unknown")
    log_info "本机公网IP: $server_ip"

    # 解析域名
    local domain_ip
    domain_ip=$(dig +short "$domain" 2>/dev/null | tail -1)

    if [ -z "$domain_ip" ]; then
        log_error "域名 $domain 无法解析"
        log_warn "请确认域名DNS已配置指向本服务器IP: $server_ip"
        return 1
    fi

    log_info "域名 $domain 解析到: $domain_ip"

    if [ "$domain_ip" = "$server_ip" ]; then
        log_info "✅ 域名解析正确 · 指向本机"
        return 0
    else
        log_warn "域名解析IP ($domain_ip) 与本机IP ($server_ip) 不一致"
        log_warn "如果使用CDN或负载均衡，这可能是正常的"
        # 不阻断，让certbot验证决定
        return 0
    fi
}

# ── §3 获取SSL证书 ───────────────────────────
obtain_certificate() {
    local domain="$1"
    local email="${2:-admin@${domain}}"

    log_step "§3 获取SSL证书: $domain"

    # 检查是否已有有效证书
    if [ -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]; then
        local expiry
        expiry=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${domain}/fullchain.pem" 2>/dev/null | cut -d= -f2)
        log_info "已有证书，过期时间: $expiry"

        # 检查是否即将过期（30天内）
        if openssl x509 -checkend 2592000 -noout -in "/etc/letsencrypt/live/${domain}/fullchain.pem" 2>/dev/null; then
            log_info "✅ 证书仍然有效，跳过获取"
            return 0
        else
            log_warn "证书即将过期，续期中..."
        fi
    fi

    log_info "使用 Let's Encrypt 获取免费SSL证书..."
    log_info "域名: $domain"
    log_info "邮箱: $email"

    # 确保80端口的Nginx正在运行（certbot需要HTTP验证）
    if ! systemctl is-active --quiet nginx; then
        log_warn "Nginx未运行，启动中..."
        systemctl start nginx
    fi

    # 使用 certonly 模式 + nginx 插件进行验证
    # certonly 只获取证书不修改Nginx配置，铸渊自己管理Nginx SSL配置
    certbot certonly \
        --nginx \
        --non-interactive \
        --agree-tos \
        --email "$email" \
        --domain "$domain" \
        2>&1

    if [ $? -eq 0 ]; then
        log_info "✅ SSL证书获取成功: $domain"

        # 创建符号链接到铸渊标准路径
        ln -sf "/etc/letsencrypt/live/${domain}/fullchain.pem" "${SSL_DIR}/${domain}-fullchain.pem"
        ln -sf "/etc/letsencrypt/live/${domain}/privkey.pem" "${SSL_DIR}/${domain}-privkey.pem"
        log_info "证书链接已创建: ${SSL_DIR}/"

        return 0
    else
        log_error "SSL证书获取失败"
        log_warn ""
        log_warn "常见原因:"
        log_warn "  1. 域名未正确解析到本服务器"
        log_warn "  2. 服务器80端口未开放（检查防火墙/安全组）"
        log_warn "  3. Let's Encrypt 速率限制（每小时最多5次失败）"
        log_warn ""
        log_warn "排查步骤:"
        log_warn "  ping $domain  # 确认域名解析"
        log_warn "  curl -I http://$domain  # 确认HTTP可访问"
        log_warn "  sudo ufw status  # 检查防火墙"
        return 1
    fi
}

# ── §4 配置Nginx SSL ─────────────────────────
# ⚠️ 架构说明 (Reality反探测优先):
#   Xray 监听 443 (外部) · VLESS+Reality协议
#   dest回落到 www.microsoft.com:443 (反探测伪装·不可改为内部端口)
#   Nginx SSL 监听 8443 (外部直接访问) · 独立HTTPS服务
#
#   如果Xray未安装 → Nginx直接监听443 (标准HTTPS)
#   如果Xray已安装 → Nginx监听8443 (避免端口冲突)
configure_nginx_ssl() {
    local domain="$1"
    local cert_path="/etc/letsencrypt/live/${domain}"

    log_step "§4 配置Nginx HTTPS: $domain"

    if [ ! -f "${cert_path}/fullchain.pem" ]; then
        log_error "证书文件不存在: ${cert_path}/fullchain.pem"
        return 1
    fi

    # 读取当前Nginx配置
    local nginx_conf="${NGINX_CONF_DIR}/zhuyuan-sovereign.conf"
    if [ ! -f "$nginx_conf" ]; then
        nginx_conf="${NGINX_SITES_AVAILABLE}/zhuyuan.conf"
    fi

    if [ ! -f "$nginx_conf" ]; then
        log_error "Nginx配置文件未找到"
        return 1
    fi

    # 确定这是哪个域名（主站还是预览站）
    local site_mode="preview"
    local api_port="3801"
    if echo "$domain" | grep -q "hololake"; then
        site_mode="production"
        api_port="3800"
    fi

    # 确定SSL监听端口: Xray在443时用8443，否则用443
    local ssl_listen_port="443"
    local ssl_listen_addr=""
    if command -v xray &>/dev/null; then
        ssl_listen_port="8443"
        ssl_listen_addr=""
        log_info "检测到Xray已安装 · Nginx SSL使用端口8443 (避免与VPN冲突)"
        log_info "网站HTTPS: https://${domain}:8443"
        # 开放8443端口
        ufw allow 8443/tcp comment "Nginx SSL (Xray共存)" 2>/dev/null || true
    else
        log_info "Xray未安装 · Nginx SSL使用标准端口443"
        log_info "网站HTTPS: https://${domain}"
    fi

    log_info "站点模式: $site_mode · API端口: $api_port · SSL端口: $ssl_listen_port"

    # 生成SSL server block
    local ssl_conf="${NGINX_CONF_DIR}/ssl-${domain}.conf"

    cat > "$ssl_conf" << SSLCONF
# ═══════════════════════════════════════════════
# 🔒 铸渊SSL配置 · ${domain}
# 自动生成于: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M CST')
# 证书来源: Let's Encrypt (certbot)
# 证书路径: ${cert_path}/
#
# SSL端口: ${ssl_listen_port}
# $([ "$ssl_listen_port" = "8443" ] && echo "⚠️ Xray占用443(VPN) · Nginx SSL在8443(直接访问)" || echo "标准HTTPS · 端口443")
# ═══════════════════════════════════════════════

# ─── HTTPS 服务 ───
server {
    listen ${ssl_listen_port} ssl http2;
    server_name ${domain};

    # ─── SSL证书 (Let's Encrypt) ───
    ssl_certificate ${cert_path}/fullchain.pem;
    ssl_certificate_key ${cert_path}/privkey.pem;

    # ─── SSL安全配置 ───
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # ─── 安全头 ───
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Server-Identity "ZY-SVR-002" always;
    add_header X-Site-Mode "${site_mode}" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ─── 静态文件 ───
    root /opt/zhuyuan/sites/${site_mode};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # ─── API反向代理 ───
    location /api/ {
        proxy_pass http://127.0.0.1:${api_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Site-Mode "${site_mode}";
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # ─── AI聊天API (SSE流式) ───
    location /api/chat {
        proxy_pass http://127.0.0.1:3721/api/chat;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_read_timeout 120s;
        proxy_send_timeout 60s;
    }

    # ─── Persona Studio API ───
    location /api/ps/ {
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        if (\$request_method = OPTIONS) { return 204; }
        proxy_pass http://127.0.0.1:3002/api/ps/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 120s;
    }

    # ─── 铸渊专线订阅 ───
    location /api/proxy-sub/ {
        proxy_pass http://127.0.0.1:3802/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ─── 健康探针 ───
    location = /health {
        proxy_pass http://127.0.0.1:${api_port}/api/health;
        proxy_set_header Host \$host;
    }

    # ─── 静态资源缓存 ───
    location /static/ {
        alias /opt/zhuyuan/sites/${site_mode}/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # ─── 错误页面 ───
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;

    # ─── 日志 ───
    access_log /opt/zhuyuan/data/logs/nginx-${site_mode}-ssl.log;
    error_log /opt/zhuyuan/data/logs/nginx-${site_mode}-ssl-error.log;
}

$([ "$ssl_listen_port" = "443" ] && cat << REDIR
# ─── HTTP → HTTPS 重定向 ───
server {
    listen 80;
    server_name ${domain};
    return 301 https://\\\$host\\\$request_uri;
}
REDIR
)
SSLCONF

    log_info "SSL配置已生成: $ssl_conf"

    # 安装到Nginx
    cp "$ssl_conf" "${NGINX_SITES_AVAILABLE}/ssl-${domain}.conf"
    ln -sf "${NGINX_SITES_AVAILABLE}/ssl-${domain}.conf" "${NGINX_SITES_ENABLED}/ssl-${domain}.conf"

    log_info "SSL配置已安装到Nginx"
    if [ "$ssl_listen_port" = "8443" ]; then
        log_info "  HTTPS: https://${domain}:8443 (直接访问)"
        log_info "  HTTP: http://${domain} (端口80·正常访问)"
        log_info "  VPN: Xray占用443 · dest→microsoft.com (反探测)"
    else
        log_info "  HTTPS: https://${domain} (标准端口443)"
        log_info "  HTTP重定向: 80 → https://${domain}"
    fi

    # 测试Nginx配置
    if nginx -t 2>&1; then
        log_info "✅ Nginx配置测试通过"
        systemctl reload nginx
        log_info "✅ Nginx已重新加载"
    else
        log_error "Nginx配置测试失败"
        # 回滚
        rm -f "${NGINX_SITES_ENABLED}/ssl-${domain}.conf"
        systemctl reload nginx
        return 1
    fi

    return 0
}

# ── §5 设置自动续期 ───────────────────────────
setup_auto_renewal() {
    log_step "§5 配置证书自动续期"

    # certbot安装时通常已配置systemd timer
    if systemctl is-enabled certbot.timer 2>/dev/null; then
        log_info "✅ certbot自动续期已启用"
    else
        # 手动启用
        systemctl enable certbot.timer 2>/dev/null || true
        systemctl start certbot.timer 2>/dev/null || true
        log_info "✅ certbot自动续期已配置"
    fi

    # 添加续期后自动reload nginx的hook
    local hook_dir="/etc/letsencrypt/renewal-hooks/post"
    mkdir -p "$hook_dir"
    cat > "${hook_dir}/reload-nginx.sh" << 'HOOK'
#!/bin/bash
# 铸渊SSL · 证书续期后自动重载Nginx
systemctl reload nginx
echo "[铸渊SSL] $(date) · 证书已续期 · Nginx已重载" >> /opt/zhuyuan/data/logs/ssl-renewal.log
HOOK
    chmod +x "${hook_dir}/reload-nginx.sh"
    log_info "✅ Nginx reload hook 已配置"

    # 测试续期（dry-run）
    log_info "测试续期功能..."
    certbot renew --dry-run 2>&1 | tail -3
}

# ── §6 验证HTTPS ─────────────────────────────
verify_https() {
    local domain="$1"
    log_step "§6 验证HTTPS: $domain"

    sleep 2  # 等待Nginx完全重载

    # 确定SSL端口
    local ssl_port="443"
    if command -v xray &>/dev/null; then
        ssl_port="8443"
    fi

    log_info "验证SSL端口: $ssl_port"

    # 检查SSL端口是否监听
    if ss -tlnp | grep -q ":${ssl_port} "; then
        log_info "✅ SSL端口 ${ssl_port}: 监听中"
    else
        log_warn "SSL端口 ${ssl_port} 未监听"
    fi

    # 使用curl测试HTTPS
    local test_url="https://${domain}/"
    if [ "$ssl_port" != "443" ]; then
        test_url="https://${domain}:${ssl_port}/"
    fi

    local response
    response=$(curl -sf -o /dev/null -w "%{http_code}" "$test_url" 2>/dev/null)

    if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
        log_info "✅ HTTPS访问正常 · 状态码: $response"
        log_info "  → 访问: $test_url"
    else
        log_warn "HTTPS访问状态码: ${response:-无响应}"
        log_warn "  → 尝试访问: $test_url"
        log_warn "  → 可能需要等待DNS传播"
    fi

    # 检查证书信息
    echo | openssl s_client -servername "$domain" -connect "${domain}:${ssl_port}" 2>/dev/null | \
        openssl x509 -noout -subject -issuer -dates 2>/dev/null || true

    # 如果是标准443端口，测试HTTP→HTTPS重定向
    if [ "$ssl_port" = "443" ]; then
        local redirect
        redirect=$(curl -sf -o /dev/null -w "%{redirect_url}" "http://${domain}/" 2>/dev/null)
        if echo "$redirect" | grep -q "https"; then
            log_info "✅ HTTP→HTTPS重定向正常"
        else
            log_warn "HTTP→HTTPS重定向未生效 (可能需要等待DNS)"
        fi
    else
        log_info "ℹ️ Xray占用443端口，HTTP不会重定向到HTTPS"
        log_info "  → 网站HTTP访问: http://${domain} (端口80)"
        log_info "  → 网站HTTPS访问: https://${domain}:${ssl_port}"
        log_info "  → VPN: 通过Xray端口443正常工作"
    fi
}

# ── 主逻辑 ────────────────────────────────────
main() {
    local domain="$1"
    local email="${2:-}"

    echo ""
    echo "═══════════════════════════════════════════════"
    echo "🔒 铸渊SSL证书自动化配置"
    echo "═══════════════════════════════════════════════"
    echo ""

    if [ "$domain" = "--all" ]; then
        # 配置所有已知域名
        log_info "配置所有域名..."

        # 从Nginx配置中提取域名
        local domains=()
        if [ -f "${NGINX_SITES_AVAILABLE}/zhuyuan.conf" ]; then
            while IFS= read -r d; do
                # 跳过占位符和IP
                if [[ "$d" != *"PLACEHOLDER"* ]] && [[ "$d" != *"_"* ]] && [[ "$d" =~ \. ]]; then
                    domains+=("$d")
                fi
            done < <(grep "server_name" "${NGINX_SITES_AVAILABLE}/zhuyuan.conf" | awk '{for(i=2;i<=NF;i++) print $i}' | tr -d ';')
        fi

        if [ ${#domains[@]} -eq 0 ]; then
            log_error "未找到已配置的域名"
            log_warn "请指定域名: sudo bash $0 guanghulab.online"
            exit 1
        fi

        for d in "${domains[@]}"; do
            log_info "────────────────────────────"
            log_info "处理域名: $d"
            log_info "────────────────────────────"
            process_domain "$d" "$email"
            echo ""
        done
    elif [ -z "$domain" ]; then
        echo "用法:"
        echo "  sudo bash $0 <域名> [邮箱]"
        echo ""
        echo "示例:"
        echo "  sudo bash $0 guanghulab.online"
        echo "  sudo bash $0 guanghulab.online admin@guanghulab.online"
        echo "  sudo bash $0 --all    # 配置所有已知域名"
        echo ""
        echo "说明:"
        echo "  使用 Let's Encrypt 免费SSL证书"
        echo "  自动获取、配置、续期"
        echo "  证书有效期90天，自动续期"
        exit 0
    else
        process_domain "$domain" "$email"
    fi

    echo ""
    echo "═══════════════════════════════════════════════"
    echo "🔒 SSL配置完成 · $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S CST')"
    echo "═══════════════════════════════════════════════"
}

process_domain() {
    local domain="$1"
    local email="${2:-admin@${domain}}"

    # §1 安装certbot
    install_certbot

    # §2 验证域名
    verify_domain "$domain" || {
        log_error "域名验证失败，但仍尝试获取证书..."
    }

    # §3 获取证书
    obtain_certificate "$domain" "$email" || {
        log_error "获取证书失败: $domain"
        return 1
    }

    # §4 配置Nginx
    configure_nginx_ssl "$domain" || {
        log_error "Nginx SSL配置失败: $domain"
        return 1
    }

    # §5 自动续期
    setup_auto_renewal

    # §6 验证
    verify_https "$domain"

    log_info ""
    log_info "🎉 $domain SSL配置完成!"
    log_info ""
    log_info "证书文件:"
    log_info "  完整链: /etc/letsencrypt/live/${domain}/fullchain.pem"
    log_info "  私钥:   /etc/letsencrypt/live/${domain}/privkey.pem"
    log_info ""
    log_info "访问: https://${domain}"
}

main "$@"
