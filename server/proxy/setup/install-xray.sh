#!/bin/bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
# server/proxy/setup/install-xray.sh
# 🌐 Xray-core安装 + BBR加速 + 防火墙配置
#
# 在SG服务器(ZY-SVR-002)上执行
# 安装Xray-core并启用BBR TCP加速
#
# 用法: bash install-xray.sh
# ═══════════════════════════════════════════════

set -uo pipefail
# 注意: 不使用 set -e，手动处理关键步骤错误

echo "════════════════════════════════════════"
echo "🌐 铸渊专线 · Xray-core 安装"
echo "════════════════════════════════════════"

# ── 1. 系统更新 ──────────────────────────────
echo "[1/6] 系统更新..."
apt-get update -y || { echo "❌ apt-get update 失败"; exit 1; }
apt-get upgrade -y || echo "⚠️ apt-get upgrade 部分失败，继续安装"

# ── 2. 安装Xray-core ────────────────────────
echo "[2/6] 安装Xray-core..."
if command -v xray &>/dev/null; then
    echo "  Xray已安装: $(xray version | head -1)"
else
    # 使用XTLS官方安装脚本 (https://github.com/XTLS/Xray-install)
    # 安装脚本自带GPG签名验证，确保二进制完整性
    bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
    if command -v xray &>/dev/null; then
        echo "  Xray安装完成: $(xray version | head -1)"
    else
        echo "❌ Xray安装失败"
        exit 1
    fi
fi

# ── 3. 启用BBR TCP加速 ──────────────────────
echo "[3/6] 配置BBR TCP加速..."
if sysctl net.ipv4.tcp_congestion_control 2>/dev/null | grep -q bbr; then
    echo "  BBR已启用"
else
    # 检查是否已添加过BBR配置，避免重复追加
    if ! grep -q "铸渊专线 BBR加速" /etc/sysctl.conf 2>/dev/null; then
        cat >> /etc/sysctl.conf <<EOF

# ── 铸渊专线 BBR加速 ──
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.ipv4.tcp_fastopen=3
net.ipv4.tcp_slow_start_after_idle=0
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
EOF
    fi
    sysctl -p || echo "⚠️ sysctl -p 有警告，继续"
    echo "  BBR已启用"
fi

# ── 4. 防火墙配置 ────────────────────────────
echo "[4/6] 配置防火墙..."
ufw allow 443/tcp comment "Xray VLESS+Reality" || true
# 端口3802不再需要外部直连 — 订阅服务通过Nginx反代(/api/proxy-sub/)访问
if ufw delete allow 3802/tcp 2>/dev/null; then
    echo "  ✅ 已移除3802端口外部访问规则"
else
    echo "  ℹ️ 3802端口规则不存在 (无需移除)"
fi
ufw reload || echo "⚠️ 防火墙重载失败，请手动检查"
echo "  防火墙已配置: 443(Xray) · 订阅服务走Nginx反代(端口80)"

# ── 5. 生成密钥 ──────────────────────────────
echo "[5/6] 生成密钥..."
SCRIPT_DIR="$(dirname "$0")"
if bash "$SCRIPT_DIR/generate-keys.sh"; then
    echo "  ✅ 密钥生成完成"
else
    echo "  ⚠️ 密钥生成脚本返回非零退出码，检查上方输出"
    echo "  密钥文件可能仍已创建，继续安装..."
fi

# ── 6. 创建数据目录 ──────────────────────────
echo "[6/6] 创建数据目录..."
mkdir -p /opt/zhuyuan/proxy/{config,data,logs}
chown -R root:root /opt/zhuyuan/proxy
chmod 755 /opt/zhuyuan/proxy/logs

# 修复: Xray官方安装脚本默认设置 User=nobody
# 导致无法写入日志目录 (permission denied) 且 systemd 警告
# "Special user nobody configured, this is not safe!"
# 创建 systemd drop-in 覆盖，以 root 身份运行 (443端口需要root)
mkdir -p /etc/systemd/system/xray.service.d
cat > /etc/systemd/system/xray.service.d/override.conf <<EOF
[Service]
User=root
EOF
systemctl daemon-reload
echo "  ✅ Xray服务已配置为root用户运行"

echo ""
echo "════════════════════════════════════════"
echo "✅ 安装完成"
echo ""
echo "下一步:"
echo "  1. 将生成的密钥添加到GitHub Secrets"
echo "  2. 运行部署脚本配置Xray"
echo "  3. 运行send-subscription发送订阅链接"
echo "════════════════════════════════════════"
