#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 国内域名机 · Forgejo 二进制装机脚本
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
#
# 用途:
#   在广州 2C2G 域名机 (ZY-SVR-CN01) 上装 Forgejo (二进制方式, 不用 docker —
#   2C2G 内存紧, docker layers 还要再吃 200MB+).
#
#   被 .github/workflows/migrate-to-cn-restore.yml 远端调用. 不通过 bootstrap.sh,
#   因为只有真正搬家时才需要 forgejo.
#
# 用法:
#   sudo bash setup-forgejo.sh \
#     --data-root /data/guanghulab \
#     --version 7.0.10 \
#     [--port 3001] \
#     [--ssh-port 2222]
#
# 关键设计:
#   - cc-001 涌现洁净: 国内 forgejo 起一段独立历史, 不 mirror GitHub
#   - cc-003 动态适配: tune tier=tiny 强制以下让步:
#       max-conn=20 / 关 LFS / 关内置 actions runner / SQLite 而非 PostgreSQL
#   - cc-004 中文一次性: 首启 user/pass 落 _logs/forgejo-credentials-FIRST-BOOT.txt 抄完删
#   - 监听 127.0.0.1:3001 (永远不公网), nginx 反代到 /git/
#   - SSH-git 默认关掉 (tiny 档省内存, 真要 ssh git 升档再开)
# ════════════════════════════════════════════════════════════════

set -euo pipefail

DATA_ROOT="/data/guanghulab"
DEPLOY_ROOT="/opt/guanghulab"
FORGEJO_VERSION="7.0.10"   # LTS 系列, 2C2G 跑得动. 如要升级先在霜砚环境验证.
FORGEJO_HTTP_PORT="3001"   # 监听端口 (loopback)
FORGEJO_SSH_ENABLED="false" # tiny 档默认关
FORGEJO_MAX_CONN="20"      # tiny 档严限
FORGEJO_LFS_ENABLED="false"
DOMAIN="guanghulab.com"

while [ $# -gt 0 ]; do
  case "$1" in
    --data-root) DATA_ROOT="$2"; shift 2 ;;
    --deploy-root) DEPLOY_ROOT="$2"; shift 2 ;;
    --version) FORGEJO_VERSION="$2"; shift 2 ;;
    --port) FORGEJO_HTTP_PORT="$2"; shift 2 ;;
    --enable-ssh) FORGEJO_SSH_ENABLED="true"; shift ;;
    --max-conn) FORGEJO_MAX_CONN="$2"; shift 2 ;;
    --enable-lfs) FORGEJO_LFS_ENABLED="true"; shift ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    -h|--help) head -n 30 "$0"; exit 0 ;;
    *) echo "❌ 未知参数: $1" >&2; exit 1 ;;
  esac
done

if [ "$EUID" -ne 0 ]; then
  echo "❌ 需要 root (sudo bash setup-forgejo.sh ...)" >&2; exit 2
fi

# 读 .env.tune 让档位决策接管 (tune 已经在 bootstrap 时跑过)
if [ -f "$DATA_ROOT/.env.tune" ]; then
  # shellcheck disable=SC1091
  . "$DATA_ROOT/.env.tune"
  case "${SIZE_TIER:-tiny}" in
    tiny)
      FORGEJO_MAX_CONN="20"
      FORGEJO_LFS_ENABLED="false"
      FORGEJO_SSH_ENABLED="false"
      ;;
    small)
      FORGEJO_MAX_CONN="50"
      FORGEJO_LFS_ENABLED="false"
      FORGEJO_SSH_ENABLED="false"
      ;;
    medium|large|xlarge)
      FORGEJO_MAX_CONN="100"
      FORGEJO_LFS_ENABLED="true"
      FORGEJO_SSH_ENABLED="true"
      ;;
  esac
fi

FORGEJO_HOME="$DATA_ROOT/forgejo"
FORGEJO_BIN="/usr/local/bin/forgejo"
FORGEJO_USER="forgejo"
FORGEJO_GROUP="forgejo"
LOG_DIR="$DATA_ROOT/logs/forgejo"
CRED_FILE="$DEPLOY_ROOT/_logs/forgejo-credentials-FIRST-BOOT.txt"
RECEIPT_TS="$(date +%Y%m%d-%H%M%S)"
SETUP_RECEIPT="$DEPLOY_ROOT/_logs/forgejo-setup-$RECEIPT_TS.json"

mkdir -p "$DEPLOY_ROOT/_logs" "$LOG_DIR"

echo "═══════════════════════════════════════════════════════════"
echo "  Forgejo 装机 · ZY-SVR-CN01"
echo "  版本:        $FORGEJO_VERSION"
echo "  端口:        127.0.0.1:$FORGEJO_HTTP_PORT (loopback only)"
echo "  数据根:       $FORGEJO_HOME"
echo "  日志根:       $LOG_DIR"
echo "  域名:        $DOMAIN (走 nginx /git/ 反代)"
echo "  max-conn:    $FORGEJO_MAX_CONN"
echo "  LFS:         $FORGEJO_LFS_ENABLED"
echo "  SSH-git:     $FORGEJO_SSH_ENABLED"
echo "  档位:        ${SIZE_TIER:-tiny}"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. 建用户 ────────────────────────────────────────────────
if ! id -u "$FORGEJO_USER" >/dev/null 2>&1; then
  groupadd --system "$FORGEJO_GROUP"
  useradd --system --gid "$FORGEJO_GROUP" \
    --home-dir "$FORGEJO_HOME" \
    --shell /usr/sbin/nologin \
    --comment "Forgejo self-hosted git for guanghulab.com" \
    "$FORGEJO_USER"
  echo "✅ 创建用户 $FORGEJO_USER"
else
  echo "ℹ️  用户 $FORGEJO_USER 已存在"
fi

# ─── 2. 建目录 ────────────────────────────────────────────────
mkdir -p "$FORGEJO_HOME"/{custom/conf,data,repos,lfs,tmp/uploads}
mkdir -p "$LOG_DIR"
chown -R "$FORGEJO_USER:$FORGEJO_GROUP" "$FORGEJO_HOME" "$LOG_DIR"
chmod 750 "$FORGEJO_HOME"

# ─── 3. 下载 Forgejo 二进制 ───────────────────────────────────
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  FORGEJO_ARCH="amd64" ;;
  aarch64) FORGEJO_ARCH="arm64" ;;
  *) echo "❌ 不支持架构: $ARCH" >&2; exit 1 ;;
esac

NEED_DOWNLOAD="true"
if [ -x "$FORGEJO_BIN" ]; then
  CUR_VER="$($FORGEJO_BIN --version 2>/dev/null | head -1 | awk '{print $3}' || true)"
  if [ "$CUR_VER" = "$FORGEJO_VERSION" ]; then
    echo "ℹ️  Forgejo $FORGEJO_VERSION 已装 (跳过下载)"
    NEED_DOWNLOAD="false"
  fi
fi

if [ "$NEED_DOWNLOAD" = "true" ]; then
  echo "[1/6] 下载 Forgejo $FORGEJO_VERSION ($FORGEJO_ARCH) ..."
  TMP_BIN="/tmp/forgejo-$FORGEJO_VERSION-$FORGEJO_ARCH"
  # codeberg.org 国内可达 (Cloudflare); 不行降级 GH proxy 镜像
  URL_PRIMARY="https://codeberg.org/forgejo/forgejo/releases/download/v${FORGEJO_VERSION}/forgejo-${FORGEJO_VERSION}-linux-${FORGEJO_ARCH}"
  URL_FALLBACK="https://gh-proxy.com/https://codeberg.org/forgejo/forgejo/releases/download/v${FORGEJO_VERSION}/forgejo-${FORGEJO_VERSION}-linux-${FORGEJO_ARCH}"
  if ! curl -fsSL --max-time 120 -o "$TMP_BIN" "$URL_PRIMARY"; then
    echo "    主源失败, 改用代理镜像..."
    curl -fsSL --max-time 120 -o "$TMP_BIN" "$URL_FALLBACK" || {
      echo "❌ Forgejo 下载失败 (主源 + 镜像都不通)"; exit 1
    }
  fi
  chmod +x "$TMP_BIN"
  mv "$TMP_BIN" "$FORGEJO_BIN"
  echo "    ✅ 安装到 $FORGEJO_BIN"
fi

# ─── 4. 生成 app.ini ──────────────────────────────────────────
APP_INI="$FORGEJO_HOME/custom/conf/app.ini"

# 生成随机 SECRET_KEY / INTERNAL_TOKEN / JWT_SECRET / LFS_JWT_SECRET
# (用 -hex: 直接 64 个十六进制字符 = 256 bits 熵 · review 建议: 比 base64+filter 更干净)
gen_secret() { openssl rand -hex 32; }

if [ ! -f "$APP_INI" ]; then
  echo "[2/6] 生成 app.ini ..."
  SECRET_KEY="$(gen_secret)"
  INTERNAL_TOKEN="$(gen_secret)"
  JWT_SECRET="$(gen_secret)"
  LFS_JWT_SECRET="$(gen_secret)"

  cat > "$APP_INI" <<EOF
; Forgejo · 国内自托管 git · ZY-SVR-CN01
; Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
; 守护: 铸渊 · ICE-GL-ZY001
; 生成时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)
; 档位: ${SIZE_TIER:-tiny}
;
; ⚠️  此文件含 SECRET_KEY/INTERNAL_TOKEN/JWT_SECRET, chmod 640 不上 git 不上 COS

APP_NAME = 光湖 · 国内自托管 git
RUN_USER = $FORGEJO_USER
RUN_MODE = prod
WORK_PATH = $FORGEJO_HOME

[server]
PROTOCOL = http
DOMAIN = $DOMAIN
ROOT_URL = https://$DOMAIN/git/
HTTP_ADDR = 127.0.0.1
HTTP_PORT = $FORGEJO_HTTP_PORT
DISABLE_SSH = $([ "$FORGEJO_SSH_ENABLED" = "true" ] && echo "false" || echo "true")
SSH_DOMAIN = $DOMAIN
LFS_START_SERVER = $FORGEJO_LFS_ENABLED
LFS_JWT_SECRET = $LFS_JWT_SECRET
OFFLINE_MODE = true
LANDING_PAGE = login
APP_DATA_PATH = $FORGEJO_HOME/data
ENABLE_GZIP = false

[database]
DB_TYPE = sqlite3
PATH = $FORGEJO_HOME/data/forgejo.db
LOG_SQL = false

[repository]
ROOT = $FORGEJO_HOME/repos
DEFAULT_BRANCH = main
DEFAULT_PRIVATE = private
ENABLE_PUSH_CREATE_USER = false
ENABLE_PUSH_CREATE_ORG = false

[security]
INSTALL_LOCK = true
SECRET_KEY = $SECRET_KEY
INTERNAL_TOKEN = $INTERNAL_TOKEN
PASSWORD_HASH_ALGO = pbkdf2_hi
DISABLE_GIT_HOOKS = true
IMPORT_LOCAL_PATHS = false

[oauth2]
JWT_SECRET = $JWT_SECRET

[service]
DISABLE_REGISTRATION = true
REQUIRE_SIGNIN_VIEW = true
REGISTER_EMAIL_CONFIRM = false
ENABLE_NOTIFY_MAIL = false
ENABLE_CAPTCHA = false
DEFAULT_KEEP_EMAIL_PRIVATE = true
DEFAULT_ALLOW_CREATE_ORGANIZATION = true

[session]
PROVIDER = file
PROVIDER_CONFIG = $FORGEJO_HOME/data/sessions

[picture]
AVATAR_UPLOAD_PATH = $FORGEJO_HOME/data/avatars
REPOSITORY_AVATAR_UPLOAD_PATH = $FORGEJO_HOME/data/repo-avatars
DISABLE_GRAVATAR = true

[attachment]
PATH = $FORGEJO_HOME/data/attachments

[lfs]
PATH = $FORGEJO_HOME/lfs

[log]
ROOT_PATH = $LOG_DIR
MODE = file
LEVEL = warn
ROUTER = none

[ui]
DEFAULT_THEME = forgejo-auto
SHOW_USER_EMAIL = false

[other]
SHOW_FOOTER_VERSION = false
SHOW_FOOTER_TEMPLATE_LOAD_TIME = false

[mailer]
ENABLED = false

[indexer]
REPO_INDEXER_ENABLED = false
ISSUE_INDEXER_TYPE = bleve

[git.timeout]
DEFAULT = 360
MIGRATE = 600
MIRROR = 300
CLONE = 300
PULL = 300
GC = 60

[cron]
ENABLED = true

[actions]
; 2C2G 关掉内置 Actions runner 节省内存 (cc-003 tune tiny)
ENABLED = false

[migrations]
ALLOWED_DOMAINS = ""
ALLOW_LOCALNETWORKS = false
EOF
  chown "$FORGEJO_USER:$FORGEJO_GROUP" "$APP_INI"
  chmod 640 "$APP_INI"
  echo "    ✅ app.ini 写入 $APP_INI"
else
  echo "[2/6] app.ini 已存在, 不覆盖 (改配置请手编 $APP_INI)"
fi

# ─── 5. systemd unit ──────────────────────────────────────────
UNIT="/etc/systemd/system/forgejo.service"
if [ ! -f "$UNIT" ]; then
  echo "[3/6] 写 systemd unit $UNIT ..."
  cat > "$UNIT" <<EOF
# Forgejo · 国内自托管 git · ZY-SVR-CN01
# Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559

[Unit]
Description=Forgejo (Beyond coding. We forge.) for guanghulab.com
After=network.target

[Service]
RestartSec=5s
Type=simple
User=$FORGEJO_USER
Group=$FORGEJO_GROUP
WorkingDirectory=$FORGEJO_HOME
ExecStart=$FORGEJO_BIN web --config $APP_INI
Restart=on-failure
Environment=USER=$FORGEJO_USER HOME=$FORGEJO_HOME GITEA_WORK_DIR=$FORGEJO_HOME
# 2C2G 内存严控 (tune tier=tiny)
MemoryHigh=350M
MemoryMax=500M
TasksMax=200
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  echo "    ✅ unit 写入 $UNIT"
else
  echo "[3/6] systemd unit 已在, daemon-reload 一下"
  systemctl daemon-reload
fi

# ─── 6. 启动并等待健康 ──────────────────────────────────────
echo "[4/6] 启动 forgejo.service ..."
systemctl enable forgejo.service >/dev/null 2>&1 || true
systemctl restart forgejo.service

# 等待 forgejo 监听 :3001
HEALTH_OK="false"
for i in $(seq 1 30); do
  if curl -fsS -m 3 "http://127.0.0.1:$FORGEJO_HTTP_PORT/api/v1/version" >/dev/null 2>&1; then
    HEALTH_OK="true"
    break
  fi
  sleep 2
done

if [ "$HEALTH_OK" != "true" ]; then
  echo "❌ Forgejo 60 秒内没起来"
  systemctl status forgejo.service --no-pager | tail -30
  exit 1
fi
echo "    ✅ Forgejo 已起 (127.0.0.1:$FORGEJO_HTTP_PORT)"

# ─── 7. 创建首个管理员 + 仓库 ────────────────────────────────
ADMIN_USER="bingshuo"
ADMIN_EMAIL="bingshuo@guanghulab.com"

# 首启凭据文件 (chmod 600, 抄完删)
if [ ! -f "$CRED_FILE" ]; then
  echo "[5/6] 创建管理员 $ADMIN_USER ..."
  # 24 位 alphanumeric ≈ 142 bits 熵, 远超现代标准. 不引入特殊字符是为了避免:
  #   1. shell 转义 (这个密码会被嵌入 nginx/git URL 里短暂使用, 特殊字符会让 URL 编码出错)
  #   2. 让冰朔抄起来麻烦 (特殊字符在 SSH 终端里看不清)
  # 抄完即删 → 长期密码由冰朔在 forgejo Web UI 自行改成更复杂的就行.
  ADMIN_PASS="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"

  # forgejo admin user create (走 forgejo 二进制, 需要切到 RUN_USER)
  sudo -u "$FORGEJO_USER" "$FORGEJO_BIN" \
    admin user create \
    --config "$APP_INI" \
    --username "$ADMIN_USER" \
    --password "$ADMIN_PASS" \
    --email "$ADMIN_EMAIL" \
    --admin \
    --must-change-password=false 2>&1 | tail -5 || {
      # 已存在则跳过
      echo "    (用户可能已存在, 继续)"
    }

  # 落首启凭据文件
  umask 077
  cat > "$CRED_FILE" <<EOF
# 光湖 Forgejo · 首启凭据 · 抄完后**手动删除本文件**
# 守护: 铸渊 · ICE-GL-ZY001
# 生成时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# 域名机: GH-CVM-DOMAIN-PROD-01 ($DOMAIN)
#
# 访问方式 (浏览器):
#   https://$DOMAIN/git/
#
# 登录:
#   用户名:  $ADMIN_USER
#   密码:    $ADMIN_PASS
#   邮箱:    $ADMIN_EMAIL
#
# 抄完密码请运行:
#   sudo rm $CRED_FILE
EOF
  chmod 600 "$CRED_FILE"
  umask 022
  echo "    ✅ 凭据已落 $CRED_FILE (chmod 600, 抄完 sudo rm)"
else
  echo "[5/6] 凭据文件已在 ($CRED_FILE), 不覆盖"
fi

# ─── 8. 决策回执 ─────────────────────────────────────────────
echo "[6/6] 写决策回执 ..."
cat > "$SETUP_RECEIPT" <<EOF
{
  "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
  "_守护": "铸渊 · ICE-GL-ZY001",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "forgejo_version": "$FORGEJO_VERSION",
  "forgejo_arch": "$FORGEJO_ARCH",
  "forgejo_home": "$FORGEJO_HOME",
  "http_addr": "127.0.0.1:$FORGEJO_HTTP_PORT",
  "domain": "$DOMAIN",
  "size_tier": "${SIZE_TIER:-tiny}",
  "max_conn": $FORGEJO_MAX_CONN,
  "lfs_enabled": $FORGEJO_LFS_ENABLED,
  "ssh_git_enabled": $FORGEJO_SSH_ENABLED,
  "actions_enabled": false,
  "admin_user": "$ADMIN_USER",
  "credentials_file": "$CRED_FILE",
  "credentials_first_boot": $([ -f "$CRED_FILE" ] && echo "true" || echo "false"),
  "systemd_status": "$(systemctl is-active forgejo.service 2>/dev/null || echo unknown)"
}
EOF

echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Forgejo 装机完成"
echo "═══════════════════════════════════════════════════════════"
echo "  端点:           http://127.0.0.1:$FORGEJO_HTTP_PORT"
echo "  对外 (nginx):    https://$DOMAIN/git/"
echo "  管理员凭据:      $CRED_FILE (chmod 600 抄完删)"
echo "  systemd:        forgejo.service ($(systemctl is-active forgejo.service 2>/dev/null))"
echo "  决策回执:       $SETUP_RECEIPT"
echo "═══════════════════════════════════════════════════════════"
