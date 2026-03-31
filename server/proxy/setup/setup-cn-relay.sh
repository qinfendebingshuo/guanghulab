#!/bin/bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
# server/proxy/setup/setup-cn-relay.sh
# 🇨🇳 广州CN中转 · 安装配置脚本
#
# 在广州服务器(ZY-SVR-004)上执行
# 将VPN流量从国内中转到新加坡服务器
#
# 架构:
#   国内用户 → CN:2053 (Nginx stream) → SG:443 (Xray VPN)
#   国内用户 → CN:80/api/proxy-sub/ → SG订阅服务 (配置获取)
#
# 用法:
#   bash setup-cn-relay.sh <SG_SERVER_IP>
#   bash setup-cn-relay.sh 43.134.16.246
#
# 环境变量:
#   ZY_SG_SERVER_HOST — 新加坡服务器IP (必需)
# ═══════════════════════════════════════════════

set -uo pipefail
# 注意: 不使用 set -e，因为 grep/nc 等命令在无匹配时返回非零
# 关键步骤手动检查错误

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[CN中转]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[CN中转]${NC} ⚠️  $1"; }
log_error() { echo -e "${RED}[CN中转]${NC} ❌ $1"; }
log_step()  { echo -e "${BLUE}[CN中转]${NC} 📌 $1"; }

# ── 参数 ──────────────────────────────────────
SG_HOST="${ZY_SG_SERVER_HOST:-${1:-}}"
RELAY_PORT="${ZY_CN_RELAY_PORT:-2053}"
CN_ROOT="/opt/zhuyuan-cn"

if [ -z "$SG_HOST" ]; then
    log_error "缺少新加坡服务器IP"
    echo ""
    echo "用法: bash setup-cn-relay.sh <SG_SERVER_IP>"
    echo "  或: ZY_SG_SERVER_HOST=1.2.3.4 bash setup-cn-relay.sh"
    exit 1
fi

echo "════════════════════════════════════════"
echo "🇨🇳 铸渊专线 · CN中转配置"
echo "════════════════════════════════════════"
echo ""
echo "  SG服务器: $SG_HOST"
echo "  中转端口: $RELAY_PORT"
echo ""

# ── §1 安装Nginx stream模块 ──────────────────
log_step "§1 检查Nginx stream模块"

# 检查Nginx是否安装
if ! command -v nginx &>/dev/null; then
    log_info "安装Nginx..."
    apt-get update -qq
    apt-get install -y -qq nginx
fi

# 检查stream模块是否可用
if nginx -V 2>&1 | grep -q "with-stream"; then
    log_info "✅ Nginx stream模块已可用"
else
    log_warn "Nginx未包含stream模块，安装完整版..."
    apt-get install -y -qq nginx-full 2>/dev/null || apt-get install -y -qq nginx-extras 2>/dev/null || true

    if nginx -V 2>&1 | grep -q "with-stream"; then
        log_info "✅ Nginx stream模块已安装"
    else
        log_error "无法安装Nginx stream模块"
        log_warn "尝试使用socat替代方案..."
        apt-get install -y -qq socat 2>/dev/null || true
    fi
fi

# 检查是否需要动态加载stream模块
# Ubuntu/Debian的Nginx通常将stream编译为动态模块(.so)，需要用load_module显式加载
NGINX_MAIN="/etc/nginx/nginx.conf"
STREAM_MODULE_PATH=""
for mod_path in \
    /usr/lib/nginx/modules/ngx_stream_module.so \
    /usr/lib64/nginx/modules/ngx_stream_module.so \
    /etc/nginx/modules/ngx_stream_module.so; do
    if [ -f "$mod_path" ]; then
        STREAM_MODULE_PATH="$mod_path"
        break
    fi
done

if [ -n "$STREAM_MODULE_PATH" ]; then
    if ! grep -q "ngx_stream_module" "$NGINX_MAIN" 2>/dev/null; then
        log_info "加载stream动态模块: $STREAM_MODULE_PATH"
        # load_module必须在nginx.conf最顶部(events块之前)
        sed -i "1i load_module $STREAM_MODULE_PATH;" "$NGINX_MAIN"
        log_info "✅ stream动态模块已加载"
    else
        log_info "✅ stream动态模块已在配置中"
    fi
else
    # 没有找到.so文件，可能是静态编译的，继续
    log_info "stream模块为静态编译或路径非标准，跳过load_module"
fi

# ── §2 配置Nginx stream中转 ──────────────────
log_step "§2 配置TCP中转 (端口$RELAY_PORT → $SG_HOST:443)"

# 创建stream配置目录
mkdir -p /etc/nginx/stream-conf.d

# 创建stream中转配置
cat > /etc/nginx/stream-conf.d/zy-relay.conf << STREAMCONF
# ═══════════════════════════════════════════════
# 🇨🇳 铸渊专线 · CN中转 · TCP Stream
# 自动生成于: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M CST')
#
# 架构: 国内用户 → CN:${RELAY_PORT} → SG:443 (Xray VPN)
# 协议: 原始TCP转发 (不解密，不修改)
# ═══════════════════════════════════════════════

upstream zy_sg_backend {
    server ${SG_HOST}:443;
}

server {
    listen ${RELAY_PORT};
    proxy_pass zy_sg_backend;
    proxy_timeout 300s;
    proxy_connect_timeout 10s;
}
STREAMCONF

log_info "✅ Stream中转配置已创建"

# 确保主Nginx配置包含stream块
if ! grep -q "stream-conf.d" "$NGINX_MAIN" 2>/dev/null; then
    log_info "添加stream块到nginx.conf..."

    # 在文件末尾添加stream块 (stream块必须在http块之外)
    cat >> "$NGINX_MAIN" << 'STREAMBLOCK'

# ═══ 铸渊专线 · CN中转 Stream ═══
stream {
    include /etc/nginx/stream-conf.d/*.conf;
}
STREAMBLOCK
    log_info "✅ stream块已添加到nginx.conf"
fi

# ── §3 配置Nginx HTTP反代订阅 ────────────────
log_step "§3 配置订阅服务反代 (CN → SG订阅)"

# 创建或更新CN的Nginx HTTP配置
CN_NGINX_CONF="/etc/nginx/sites-available/zy-cn-relay.conf"
cat > "$CN_NGINX_CONF" << HTTPCONF
# ═══════════════════════════════════════════════
# 🇨🇳 铸渊专线 · CN中转 · HTTP反代
# 自动生成于: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M CST')
#
# 功能: 将订阅请求反代到SG服务器
# 国内用户通过CN服务器获取订阅配置 (无需国际网)
# ═══════════════════════════════════════════════

server {
    listen 80 default_server;
    server_name _;

    # ─── 健康检查 ───
    location = /health {
        return 200 '{"status":"ok","service":"zy-cn-relay","relay_to":"${SG_HOST}"}';
        add_header Content-Type application/json;
    }

    # ─── 订阅服务反代 → SG服务器 ───
    location /api/proxy-sub/ {
        proxy_pass http://${SG_HOST}/api/proxy-sub/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
    }

    # ─── 默认页面 ───
    location / {
        return 200 '铸渊CN中转节点 · ZY-SVR-004';
        add_header Content-Type 'text/plain; charset=utf-8';
    }

    access_log /var/log/nginx/zy-cn-relay.log;
    error_log /var/log/nginx/zy-cn-relay-error.log;
}
HTTPCONF

# 启用配置
ln -sf "$CN_NGINX_CONF" /etc/nginx/sites-enabled/zy-cn-relay.conf
# 移除默认配置以避免冲突
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

log_info "✅ HTTP反代配置已创建"

# ── §4 防火墙配置 ────────────────────────────
log_step "§4 防火墙配置"

ufw allow 80/tcp comment "HTTP (订阅反代)" 2>/dev/null || true
ufw allow ${RELAY_PORT}/tcp comment "ZY-Relay (VPN中转)" 2>/dev/null || true
ufw reload 2>/dev/null || true
log_info "✅ 防火墙已开放: 80(HTTP) + ${RELAY_PORT}(VPN中转)"

# ── §5 测试配置并重载 ────────────────────────
log_step "§5 测试并应用配置"

if nginx -t 2>&1; then
    systemctl reload nginx
    log_info "✅ Nginx配置测试通过 · 已重载"
else
    log_error "Nginx配置测试失败"
    nginx -t 2>&1
    exit 1
fi

# ── §6 保存中转状态 ──────────────────────────
log_step "§6 保存中转状态"

mkdir -p "$CN_ROOT/data"
cat > "$CN_ROOT/data/relay-status.json" << STATUSJSON
{
  "service": "zy-cn-relay",
  "sg_server": "$SG_HOST",
  "relay_port": $RELAY_PORT,
  "subscription_proxy": "http://CN_IP/api/proxy-sub/",
  "vpn_relay": "CN_IP:$RELAY_PORT → $SG_HOST:443",
  "configured_at": "$(TZ=Asia/Shanghai date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "status": "active"
}
STATUSJSON

log_info "✅ 中转状态已保存"

# ── §7 健康检查 ──────────────────────────────
log_step "§7 健康检查"

sleep 1

# 检查中转端口
if ss -tlnp | grep -q ":${RELAY_PORT} "; then
    log_info "✅ 中转端口 ${RELAY_PORT}: 监听中"
else
    log_warn "中转端口 ${RELAY_PORT}: 未监听 (可能需要等待)"
fi

# 检查HTTP
if curl -sf http://127.0.0.1/health >/dev/null 2>&1; then
    log_info "✅ HTTP健康检查: 正常"
else
    log_warn "HTTP健康检查: 未响应"
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ CN中转配置完成"
echo ""
echo "中转架构:"
echo "  VPN: 国内用户 → CN:${RELAY_PORT} → SG:443 (Xray)"
echo "  订阅: http://CN_IP/api/proxy-sub/sub/{token}"
echo ""
echo "下一步:"
echo "  1. 运行 deploy-proxy-service.yml action=update 更新SG的Xray配置"
echo "  2. 重新发送订阅邮件 (新配置包含CN中转节点)"
echo "════════════════════════════════════════"
