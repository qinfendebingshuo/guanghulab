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

set -euo pipefail

echo "════════════════════════════════════════"
echo "🌐 铸渊专线 · Xray-core 安装"
echo "════════════════════════════════════════"

# ── 1. 系统更新 ──────────────────────────────
echo "[1/6] 系统更新..."
apt-get update -y
apt-get upgrade -y

# ── 2. 安装Xray-core ────────────────────────
echo "[2/6] 安装Xray-core..."
if command -v xray &>/dev/null; then
    echo "  Xray已安装: $(xray version | head -1)"
else
    # 使用XTLS官方安装脚本 (https://github.com/XTLS/Xray-install)
    # 安装脚本自带GPG签名验证，确保二进制完整性
    bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
    echo "  Xray安装完成: $(xray version | head -1)"
fi

# ── 3. 启用BBR TCP加速 ──────────────────────
echo "[3/6] 配置BBR TCP加速..."
if sysctl net.ipv4.tcp_congestion_control 2>/dev/null | grep -q bbr; then
    echo "  BBR已启用"
else
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
    sysctl -p
    echo "  BBR已启用"
fi

# ── 4. 防火墙配置 ────────────────────────────
echo "[4/6] 配置防火墙..."
ufw allow 443/tcp comment "Xray VLESS+Reality"
ufw allow 3802/tcp comment "ZY-Proxy subscription service"
ufw reload
echo "  防火墙已配置: 443(Xray) + 3802(订阅服务)"

# ── 5. 生成密钥 ──────────────────────────────
echo "[5/6] 生成密钥..."
bash "$(dirname "$0")/generate-keys.sh"

# ── 6. 创建数据目录 ──────────────────────────
echo "[6/6] 创建数据目录..."
mkdir -p /opt/zhuyuan/proxy/{config,data,logs}
chown -R root:root /opt/zhuyuan/proxy

echo ""
echo "════════════════════════════════════════"
echo "✅ 安装完成"
echo ""
echo "下一步:"
echo "  1. 将生成的密钥添加到GitHub Secrets"
echo "  2. 运行部署脚本配置Xray"
echo "  3. 运行send-subscription发送订阅链接"
echo "════════════════════════════════════════"
