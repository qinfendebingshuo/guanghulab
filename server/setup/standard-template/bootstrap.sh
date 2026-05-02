#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# 光湖服务器标准模板 bootstrap · 0.1.0
# ═══════════════════════════════════════════════════════════
#
# 把一台干净的 Ubuntu 22.04 机器准备成"光湖标准插座":
#   - 装基础工具链 (Node 20 / PM2 / nginx / certbot / fail2ban)
#   - 建 /opt/guanghu/ 标准目录
#   - 起 channel-switcher 常驻进程
#
# 用法:
#   sudo CHANNEL_SWITCHER_SERVER_ID=ZY-SVR-006 bash bootstrap.sh
#
# 守护: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════════════════

set -euo pipefail

TEMPLATE_VERSION="0.1.0"
SERVER_ID="${CHANNEL_SWITCHER_SERVER_ID:-${SERVER_ID:-}}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/guanghu}"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/qinfendebingshuo/guanghulab/main}"

if [ -z "$SERVER_ID" ]; then
  echo "❌ 必须传入母编号: sudo CHANNEL_SWITCHER_SERVER_ID=ZY-SVR-XXX bash bootstrap.sh" >&2
  exit 1
fi

if ! [[ "$SERVER_ID" =~ ^ZY-SVR-[A-Z0-9]+$ ]]; then
  echo "❌ 母编号格式不合法: $SERVER_ID (应为 ZY-SVR-[A-Z0-9]+)" >&2
  exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "❌ 需要 root (请用 sudo)" >&2
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "  光湖标准插座 bootstrap"
echo "  母编号:    $SERVER_ID"
echo "  部署根:    $DEPLOY_ROOT"
echo "  模板版本:  $TEMPLATE_VERSION"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. 系统包 ───────────────────────────────────────────────
echo "[1/5] 安装系统包..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg jq git nginx certbot python3-certbot-nginx fail2ban ufw

# ─── 2. Node 20 + PM2 ────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -v 2>/dev/null | sed 's/v//;s/\..*//')" -lt 20 ]; then
  echo "[2/5] 安装 Node 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
else
  echo "[2/5] Node $(node -v) 已就位"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2 --silent
fi

# ─── 3. 标准目录 ─────────────────────────────────────────────
echo "[3/5] 建标准目录..."
mkdir -p \
  "$DEPLOY_ROOT/_active" \
  "$DEPLOY_ROOT/_archive" \
  "$DEPLOY_ROOT/_logs" \
  "$DEPLOY_ROOT/_manifest" \
  "$DEPLOY_ROOT/_secrets" \
  "$DEPLOY_ROOT/_shared/channel-badge" \
  "$DEPLOY_ROOT/channel-switcher" \
  /var/log/channel-switcher

chmod 700 "$DEPLOY_ROOT/_secrets"

# 写一个 placeholder manifest, 让 channel-switcher 第一次启动不至于报错
if [ ! -f "$DEPLOY_ROOT/_manifest/function-manifest.json" ]; then
  cat > "$DEPLOY_ROOT/_manifest/function-manifest.json" <<EOF
{
  "_sovereign": "TCS-0002∞ | SYS-GLW-0001",
  "_copyright": "国作登字-2026-A-00037559",
  "_description": "placeholder · 等部署 workflow 同步真实 manifest",
  "version": "0.0.0-placeholder",
  "updated_at": "$(date -u +%Y-%m-%d)",
  "servers": [
    { "id": "$SERVER_ID", "display_name_zh": "(待登记)", "ipv4": "(待登记)", "status": "bootstrapping", "template_version": "$TEMPLATE_VERSION", "registered_functions": [] }
  ],
  "functions": [],
  "active_routes": {}
}
EOF
fi

# ─── 4. channel-switcher ────────────────────────────────────
echo "[4/5] 安装 channel-switcher..."
for f in server.js ecosystem.config.js package.json; do
  curl -fsSL "$REPO_RAW/server/channel-switcher/$f" -o "$DEPLOY_ROOT/channel-switcher/$f"
done

cd "$DEPLOY_ROOT/channel-switcher"
# 无运行时依赖, 但保留 npm install 以兼容未来扩展
npm install --omit=dev --silent 2>/dev/null || true

# 启动/重启 PM2 进程
export CHANNEL_SWITCHER_SERVER_ID FUNCTION_MANIFEST_PATH="$DEPLOY_ROOT/_manifest/function-manifest.json"
pm2 describe channel-switcher >/dev/null 2>&1 \
  && pm2 reload ecosystem.config.js --update-env \
  || pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
systemctl enable pm2-root 2>/dev/null || true

# ─── 5. 频道徽章公共静态资源 ─────────────────────────────────
echo "[5/5] 同步频道徽章前端组件..."
curl -fsSL "$REPO_RAW/src/membrane/channel-badge/index.js" -o "$DEPLOY_ROOT/_shared/channel-badge/index.js"

# ─── 收尾 ────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════════"
echo "  [OK] $SERVER_ID bootstrap 完成 · template $TEMPLATE_VERSION"
echo "═══════════════════════════════════════════════════════════"
echo "  下一步:"
echo "    1. 在 nginx server 块里加 /__switch/ 与 /channel-badge/ 反代"
echo "       (见 server/setup/standard-template/nginx-snippet.conf)"
echo "    2. 由部署 workflow 同步 .github/brain/architecture/function-manifest.json"
echo "       到 $DEPLOY_ROOT/_manifest/function-manifest.json"
echo "    3. 验证: curl -s http://127.0.0.1:39000/__switch/health | jq ."
echo
