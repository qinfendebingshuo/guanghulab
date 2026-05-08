#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 光湖灯塔 · 国内主服务器 bootstrap · v0.1.0
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 把一台格式化干净的 Ubuntu 22.04 国内 CVM 准备成"光湖灯塔":
#   1. 装基础工具链 (走阿里云镜像源, 国内可达)
#   2. 装 Docker + Compose (跳过 get.docker.com, 用阿里云镜像)
#   3. 在 /data 数据盘下建 Gitea/Postgres/Redis/Runner 标准目录
#   4. 起 Gitea + PostgreSQL + Redis + Gitea Actions Runner
#   5. 部署 Nginx 反代 (Gitea + 灯塔门户 + 总控 API 占位)
#   6. 装 PM2 / certbot / fail2ban / ufw 基础守护
#
# 服务器现状假设 (来自冰朔同步):
#   - 实例: GH-CVM-MAIN-PROD-01 · 4C16G · Ubuntu 22.04
#   - 数据盘: 100GB ext4 已挂载 /data, fstab 自动挂载
#   - 安全组: 22/80/443/3000 已放行
#   - 默认登录用户: ubuntu (本脚本需要 sudo -i 切到 root 后运行)
#
# 用法:
#   sudo CN_LIGHTHOUSE_SERVER_ID=GH-CVM-MAIN-PROD-01 \
#        GITEA_ADMIN_USER=bingshuo \
#        GITEA_ADMIN_PASS=xxx \
#        GITEA_ADMIN_EMAIL=you@example.com \
#        GITEA_DB_PASS=xxx \
#        bash bootstrap.sh
#
# 环境变量:
#   CN_LIGHTHOUSE_SERVER_ID  必填 · 母编号 (GH-CVM-MAIN-PROD-01 / GH-CVM-BACKUP-01)
#   DATA_ROOT                可选 · 默认 /data (持久数据根, 必须挂载)
#   DEPLOY_ROOT              可选 · 默认 /opt/guanghu (代码 / pm2 进程根)
#   GITEA_ADMIN_USER         必填 · Gitea 初始管理员账号
#   GITEA_ADMIN_PASS         必填 · Gitea 初始管理员密码 (≥24 位)
#   GITEA_ADMIN_EMAIL        必填 · 管理员邮箱
#   GITEA_DB_PASS            必填 · PostgreSQL gitea 用户密码
#   GITEA_HTTP_PORT          可选 · 默认 3000
#   GITEA_SSH_PORT           可选 · 默认 2222 (避开系统 22)
#   STAGE                    可选 · bootstrap (默认) / update / rollback
# ════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── 全局参数 ─────────────────────────────────────────────────
TEMPLATE_VERSION="0.2.0"
SERVER_ID="${CN_LIGHTHOUSE_SERVER_ID:-${SERVER_ID:-}}"
DATA_ROOT="${DATA_ROOT:-/data}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/guanghu}"
GITEA_HTTP_PORT="${GITEA_HTTP_PORT:-3000}"
GITEA_SSH_PORT="${GITEA_SSH_PORT:-2222}"
STAGE="${STAGE:-bootstrap}"

export DEBIAN_FRONTEND=noninteractive

# ─── 校验前置条件 ─────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "❌ 需要 root (请用 sudo -i 切到 root 后再跑)" >&2
  exit 1
fi

if [ -z "$SERVER_ID" ]; then
  echo "❌ 必须传入母编号: CN_LIGHTHOUSE_SERVER_ID=GH-CVM-MAIN-PROD-01" >&2
  exit 1
fi

if ! [[ "$SERVER_ID" =~ ^GH-CVM-[A-Z0-9-]+$ ]]; then
  echo "❌ 母编号格式不合法: $SERVER_ID (应为 GH-CVM-[A-Z0-9-]+)" >&2
  exit 1
fi

if [ ! -d "$DATA_ROOT" ]; then
  echo "❌ 数据盘根目录不存在: $DATA_ROOT (请先挂载数据盘)" >&2
  exit 1
fi

# 检查 /data 是不是真的挂载点 (避免误装到系统盘)
if ! mountpoint -q "$DATA_ROOT"; then
  echo "⚠️  $DATA_ROOT 不是挂载点, Gitea 数据会落到系统盘 (50G), 请确认" >&2
  echo "    继续? (5秒后自动继续, Ctrl+C 中止)" >&2
  sleep 5
fi

# ─── 自我感知: 探测真实硬件 + 动态调优 ────────────────────────
# 不再硬假设 4C16G, 适配 2C8G / 4C16G / 任意规格
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$DEPLOY_ROOT/_logs"
SERVER_ENV_JSON="$DEPLOY_ROOT/_logs/server-env.json"

if [ -x "$SCRIPT_DIR/detect-env.sh" ]; then
  echo "[0/8] 探测当前服务器实际配置 (detect-env.sh)..."
  DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
    bash "$SCRIPT_DIR/detect-env.sh" "$SERVER_ENV_JSON" || {
      echo "⚠️  detect-env.sh 失败, 继续但不动态调优" >&2
    }
fi

if [ "$STAGE" = "bootstrap" ]; then
  for v in GITEA_ADMIN_USER GITEA_ADMIN_PASS GITEA_ADMIN_EMAIL GITEA_DB_PASS; do
    if [ -z "${!v:-}" ]; then
      echo "❌ bootstrap 阶段必填环境变量: $v" >&2
      exit 1
    fi
  done
fi

echo "═══════════════════════════════════════════════════════════"
echo "  光湖灯塔 bootstrap"
echo "  母编号:    $SERVER_ID"
echo "  数据根:    $DATA_ROOT"
echo "  部署根:    $DEPLOY_ROOT"
echo "  阶段:      $STAGE"
echo "  模板版本:  $TEMPLATE_VERSION"
echo "═══════════════════════════════════════════════════════════"

# ─── 阶段路由 ─────────────────────────────────────────────────
case "$STAGE" in
  bootstrap) ;;
  update) STAGE_UPDATE_ONLY=1 ;;
  rollback)
    echo "[rollback] 委派给 rollback.sh (快照式回滚)..."
    if [ -x "$SCRIPT_DIR/rollback.sh" ]; then
      # 修复: ROLLBACK_TS 为空时不能用 ${VAR:+--to} ${VAR:-} 拼参,
      # 那会传两个空字符串 "" "" 给 rollback.sh, 触发 "未知参数" 退码 2.
      # 改用条件数组拼参: 只在非空时才追加 --to + 时间戳.
      ROLLBACK_ARGS=()
      if [ -n "${ROLLBACK_TS:-}" ]; then
        ROLLBACK_ARGS=(--to "$ROLLBACK_TS")
      fi
      DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
        bash "$SCRIPT_DIR/rollback.sh" "${ROLLBACK_ARGS[@]}"
      exit $?
    else
      echo "[rollback fallback] 脚本未找到, 仅停服" >&2
      cd "$DATA_ROOT/lighthouse" 2>/dev/null && docker compose down || true
      exit 0
    fi
    ;;
  *)
    echo "❌ 未知 STAGE: $STAGE (合法: bootstrap / update / rollback)" >&2
    exit 1
    ;;
esac

# ─── update / bootstrap: 跑前先建快照 ────────────────────────
# 这样万一这次 update 把 compose / app.ini 改坏, rollback.sh 能回到这一刻
if [ -d "$DATA_ROOT/lighthouse" ] && [ -f "$DATA_ROOT/lighthouse/docker-compose.yml" ]; then
  PRE_TS="$(date +%Y%m%d-%H%M%S)"
  PRE_SNAP="$DATA_ROOT/lighthouse/snapshots/$PRE_TS-pre-$STAGE"
  mkdir -p "$PRE_SNAP"
  for f in docker-compose.yml .env .env.tune; do
    [ -f "$DATA_ROOT/lighthouse/$f" ] && cp -a "$DATA_ROOT/lighthouse/$f" "$PRE_SNAP/" || true
  done
  if [ -f "$DATA_ROOT/lighthouse/gitea/conf/app.ini" ]; then
    mkdir -p "$PRE_SNAP/gitea/conf"
    cp -a "$DATA_ROOT/lighthouse/gitea/conf/app.ini" "$PRE_SNAP/gitea/conf/" || true
  fi
  echo "snapshot before $STAGE @ $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$PRE_SNAP/NOTE"
  # 只保留最近 10 份, 防数据盘塞满
  ls -1tr "$DATA_ROOT/lighthouse/snapshots" 2>/dev/null \
    | head -n -10 \
    | xargs -I{} rm -rf "$DATA_ROOT/lighthouse/snapshots/{}" 2>/dev/null || true
  echo "[snap] pre-$STAGE 快照 -> $PRE_SNAP"
fi

# ─── 1. APT 镜像源 (阿里云) ──────────────────────────────────
if [ "${STAGE}" = "bootstrap" ]; then
  echo "[1/8] 切换 APT 源到阿里云镜像 ..."
  if ! grep -q "mirrors.aliyun.com" /etc/apt/sources.list 2>/dev/null; then
    cp /etc/apt/sources.list "/etc/apt/sources.list.bak.$(date +%s)" || true
    cat > /etc/apt/sources.list <<'EOF'
deb https://mirrors.aliyun.com/ubuntu/ jammy main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ jammy-updates main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ jammy-security main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ jammy-backports main restricted universe multiverse
EOF
  fi
  apt-get update -qq
fi

# ─── 2. 基础工具链 ───────────────────────────────────────────
echo "[2/8] 安装基础工具链 ..."
apt-get install -y -qq \
  curl wget ca-certificates gnupg lsb-release \
  git jq unzip vim htop net-tools \
  nginx certbot python3-certbot-nginx \
  fail2ban ufw \
  rsync openssh-client \
  build-essential

# ─── 3. Node 20 + PM2 (npmmirror 镜像) ───────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -v 2>/dev/null | sed 's/v//;s/\..*//')" -lt 20 ]; then
  echo "[3/8] 安装 Node 20 (NodeSource 国内可达, 备用 nvm) ..."
  if ! curl -fsSL --max-time 30 https://deb.nodesource.com/setup_20.x | bash - ; then
    echo "    NodeSource 不可达, 改用阿里云 nvm 源..."
    export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
    curl -fsSL https://gitee.com/mirrors/nvm/raw/master/install.sh | bash || {
      echo "❌ Node 安装失败, 请人工介入" >&2
      exit 1
    }
  fi
  apt-get install -y -qq nodejs || true
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm config set registry https://registry.npmmirror.com
  npm install -g pm2 --silent
fi

# ─── 4. Docker (阿里云镜像源, 跳过 get.docker.com) ─────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "[4/8] 安装 Docker (阿里云镜像源) ..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# Docker daemon 镜像加速
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ],
  "data-root": "$DATA_ROOT/docker",
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" }
}
EOF
  systemctl restart docker || systemctl start docker
fi
systemctl enable docker >/dev/null 2>&1 || true

# ─── 5. /data 标准目录 ───────────────────────────────────────
echo "[5/8] 在 $DATA_ROOT 下建标准目录 ..."
mkdir -p \
  "$DATA_ROOT/lighthouse" \
  "$DATA_ROOT/lighthouse/gitea" \
  "$DATA_ROOT/lighthouse/postgres" \
  "$DATA_ROOT/lighthouse/redis" \
  "$DATA_ROOT/lighthouse/runner" \
  "$DATA_ROOT/lighthouse/backup" \
  "$DATA_ROOT/cos-cache" \
  "$DATA_ROOT/pm2" \
  "$DATA_ROOT/logs/gitea" \
  "$DATA_ROOT/logs/nginx" \
  "$DATA_ROOT/logs/runner"

mkdir -p \
  "$DEPLOY_ROOT/_active" \
  "$DEPLOY_ROOT/_archive" \
  "$DEPLOY_ROOT/_logs" \
  "$DEPLOY_ROOT/_manifest" \
  "$DEPLOY_ROOT/_secrets" \
  "$DEPLOY_ROOT/lighthouse-cn"
chmod 700 "$DEPLOY_ROOT/_secrets"

# pm2 默认日志/进程目录指向 /data/pm2, 系统盘只剩系统
export PM2_HOME="$DATA_ROOT/pm2"

# ─── 6. Gitea + Postgres + Redis (docker compose) ────────────
echo "[6/8] 部署 Gitea / PostgreSQL / Redis ..."
COMPOSE_DIR="$DATA_ROOT/lighthouse"
if [ ! -f "$COMPOSE_DIR/docker-compose.yml" ]; then
  cp "$(dirname "$0")/docker-compose.yml" "$COMPOSE_DIR/docker-compose.yml"
fi
if [ ! -f "$COMPOSE_DIR/.env" ]; then
  cat > "$COMPOSE_DIR/.env" <<EOF
# Generated by lighthouse-cn bootstrap @ $(date -u +%Y-%m-%dT%H:%M:%SZ)
SERVER_ID=$SERVER_ID
DATA_ROOT=$DATA_ROOT
GITEA_HTTP_PORT=$GITEA_HTTP_PORT
GITEA_SSH_PORT=$GITEA_SSH_PORT
GITEA_DB_NAME=gitea
GITEA_DB_USER=gitea
GITEA_DB_PASS=$GITEA_DB_PASS
TZ=Asia/Shanghai
EOF
  chmod 600 "$COMPOSE_DIR/.env"
fi

# Gitea app.ini 模板渲染 (首次启动用)
APP_INI_TPL="$(dirname "$0")/gitea/app.ini.template"
if [ -f "$APP_INI_TPL" ] && [ ! -f "$DATA_ROOT/lighthouse/gitea/conf/app.ini" ]; then
  mkdir -p "$DATA_ROOT/lighthouse/gitea/conf"
  # 生成密码学安全的 SECRET_KEY (Gitea 推荐 ≥ 64 字符)
  GITEA_SECRET_KEY="$(openssl rand -base64 48 | tr -d '\n=' | head -c 64)"
  if [ -z "$GITEA_SECRET_KEY" ]; then
    echo "❌ 无法生成 SECRET_KEY (openssl 缺失?)" >&2
    exit 1
  fi
  # 用 awk 而非 sed (避免密码中特殊字符 / 引号歧义)
  APP_INI_OUT="$DATA_ROOT/lighthouse/gitea/conf/app.ini"
  # 先把 placeholder 替换值通过 env 传给 awk, 不进 shell 历史
  GITEA_HTTP_PORT="$GITEA_HTTP_PORT" \
  GITEA_SSH_PORT="$GITEA_SSH_PORT" \
  GITEA_SECRET_KEY="$GITEA_SECRET_KEY" \
  awk '
    {
      gsub(/__GITEA_HTTP_PORT__/, ENVIRON["GITEA_HTTP_PORT"])
      gsub(/__GITEA_SSH_PORT__/,  ENVIRON["GITEA_SSH_PORT"])
      gsub(/__GITEA_SECRET_KEY__/, ENVIRON["GITEA_SECRET_KEY"])
      print
    }' "$APP_INI_TPL" > "$APP_INI_OUT"
  # app.ini 含 SECRET_KEY, 必须 chmod 600
  chmod 600 "$APP_INI_OUT"
  unset GITEA_SECRET_KEY
fi

# ─── 6.5 动态调优 ─────────────────────────────────────────────
# 依据 detect-env 探到的真实硬件档位, 写 .env.tune
if [ -x "$SCRIPT_DIR/tune-from-env.sh" ] && [ -f "$SERVER_ENV_JSON" ]; then
  ENV_FILE="$SERVER_ENV_JSON" DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
    bash "$SCRIPT_DIR/tune-from-env.sh" || echo "⚠️  tune-from-env.sh 失败, 用默认参数继续"
fi

# 加载档位决策, 决定是否在 update 阶段顺带启 runner profile
RUNNER_DEFAULT_ENABLED="false"
if [ -f "$DATA_ROOT/lighthouse/.env.tune" ]; then
  # shellcheck disable=SC1091
  . "$DATA_ROOT/lighthouse/.env.tune"
fi

cd "$COMPOSE_DIR"
docker compose pull

# update 阶段且档位允许 + token 已注入 → 顺带启 runner
COMPOSE_UP_ARGS=("up" "-d")
if [ "$STAGE" = "update" ] && [ "${RUNNER_DEFAULT_ENABLED:-false}" = "true" ] \
   && [ -n "${GITEA_RUNNER_TOKEN:-}" ]; then
  echo "    档位允许 + RUNNER_TOKEN 已注入, 顺带启 runner"
  COMPOSE_UP_ARGS=("--profile" "runner" "up" "-d")
fi

docker compose "${COMPOSE_UP_ARGS[@]}"

# 等 Gitea 起来
echo "    等待 Gitea 健康检查 ..."
GITEA_HEALTHY="false"
for i in $(seq 1 30); do
  if curl -fs "http://127.0.0.1:$GITEA_HTTP_PORT/api/v1/version" >/dev/null 2>&1; then
    echo "    Gitea 已上线"
    GITEA_HEALTHY="true"
    break
  fi
  sleep 2
done

# ─── 自动兜底: update 失败 → 自动回滚到 pre-snapshot ──────────
# bootstrap (首次) 不触发自动回滚 (没有"上一个版本"可回)
if [ "$GITEA_HEALTHY" = "false" ] && [ "$STAGE" = "update" ] && [ -n "${PRE_SNAP:-}" ]; then
  echo "❌ Gitea 60s 内未上线, 触发自动回滚到 pre-update 快照..." >&2
  PRE_TS_BASENAME="$(basename "$PRE_SNAP")"
  if [ -x "$SCRIPT_DIR/rollback.sh" ]; then
    DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
      bash "$SCRIPT_DIR/rollback.sh" --to "$PRE_TS_BASENAME" || \
      echo "⚠️  自动回滚也失败了, 请人工介入. snapshot=$PRE_SNAP" >&2
  fi
  echo "[autorollback] 已触发. 仔细看上方日志." >&2
  exit 1
fi

# 创建初始管理员 (idempotent: 已存在会报错并被忽略)
# 用临时文件 + stdin 避免密码进 ps / shell history
if [ "$STAGE" = "bootstrap" ]; then
  ADMIN_PASS_FILE="$(mktemp)"
  chmod 600 "$ADMIN_PASS_FILE"
  printf '%s' "$GITEA_ADMIN_PASS" > "$ADMIN_PASS_FILE"
  # 把密码文件 cp 进容器, 用 --password-file 读 (Gitea 1.21+ 支持)
  docker cp "$ADMIN_PASS_FILE" lighthouse-gitea:/tmp/.adm-pass 2>/dev/null || true
  docker exec lighthouse-gitea chown git:git /tmp/.adm-pass 2>/dev/null || true
  docker exec lighthouse-gitea chmod 600 /tmp/.adm-pass 2>/dev/null || true
  # Gitea 1.21 admin user create 仍需 --password 参数. 退而求其次: 用 env 透传
  # (注: 进程参数仍可见, 但 GITEA_ADMIN_PASS 已通过 env 而非 cmd-line 传)
  set +e
  docker exec -u git -e GITEA_ADM_PASS="$(cat "$ADMIN_PASS_FILE")" \
    lighthouse-gitea \
    sh -c 'gitea admin user create --username "$1" --password "$GITEA_ADM_PASS" --email "$2" --admin --must-change-password=false' \
    _ "$GITEA_ADMIN_USER" "$GITEA_ADMIN_EMAIL" 2>&1 | grep -v "$(cat "$ADMIN_PASS_FILE")" \
    || echo "    管理员创建跳过 (可能已存在)"
  set -e
  rm -f "$ADMIN_PASS_FILE"
  docker exec lighthouse-gitea rm -f /tmp/.adm-pass 2>/dev/null || true
fi

# ─── 7. Nginx 反代 ───────────────────────────────────────────
echo "[7/8] 配置 Nginx 反代 ..."
NGX_TPL="$(dirname "$0")/nginx/lighthouse.conf"
if [ -f "$NGX_TPL" ]; then
  cp "$NGX_TPL" /etc/nginx/sites-available/lighthouse.conf
  ln -sf /etc/nginx/sites-available/lighthouse.conf /etc/nginx/sites-enabled/lighthouse.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
fi

# ─── 8. ufw + fail2ban ────────────────────────────────────────
echo "[8/8] 加固防火墙 ..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow "$GITEA_HTTP_PORT/tcp"
ufw allow "$GITEA_SSH_PORT/tcp"
ufw --force enable
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban || true

# ─── 收尾回执 ─────────────────────────────────────────────────
mkdir -p "$DEPLOY_ROOT/_logs"
RECEIPT_TS="$(date +%Y%m%d-%H%M%S)"
SIZE_TIER_VAL="${SIZE_TIER:-unknown}"

# 真实 runner 运行态 (跟 RUNNER_DEFAULT_ENABLED 区分):
# RUNNER_DEFAULT_ENABLED = 当前档位是否"默认允许"启 runner (来自 .env.tune)
# runner_running         = 此刻 lighthouse-gitea-runner 容器是否真在跑
RUNNER_RUNNING="false"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'lighthouse-gitea-runner'; then
  RUNNER_RUNNING="true"
fi

cat > "$DEPLOY_ROOT/_logs/lighthouse-bootstrap-$RECEIPT_TS.json" <<EOF
{
  "_sovereign": "TCS-0002∞ | $SERVER_ID",
  "_copyright": "国作登字-2026-A-00037559",
  "template_version": "$TEMPLATE_VERSION",
  "stage": "$STAGE",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "data_root": "$DATA_ROOT",
  "deploy_root": "$DEPLOY_ROOT",
  "gitea_http_port": $GITEA_HTTP_PORT,
  "gitea_ssh_port": $GITEA_SSH_PORT,
  "size_tier": "$SIZE_TIER_VAL",
  "runner_default_enabled": ${RUNNER_DEFAULT_ENABLED:-false},
  "runner_running": $RUNNER_RUNNING,
  "pre_snapshot": "${PRE_SNAP:-none}",
  "server_env_file": "$SERVER_ENV_JSON",
  "post_health_ok": ${GITEA_HEALTHY:-false}
}
EOF

echo
echo "═══════════════════════════════════════════════════════════"
echo "  [OK] $SERVER_ID 灯塔 bootstrap 完成"
echo "═══════════════════════════════════════════════════════════"
echo "  Gitea Web:    http://<公网IP>:$GITEA_HTTP_PORT/"
echo "  Gitea SSH:    ssh://git@<公网IP>:$GITEA_SSH_PORT/"
echo "  数据根:       $DATA_ROOT/lighthouse/"
echo "  Compose 文件: $COMPOSE_DIR/docker-compose.yml"
echo "  下一步:"
echo "    1. 浏览器登录 Gitea, Site Admin → Actions → Runners 拿 token"
echo "    2. 把 token 配回 GitHub Secrets ZY_GITEA_RUNNER_TOKEN"
echo "    3. 跑 STAGE=update 注册 Gitea Actions Runner"
echo "    4. 从 COS 拉 guanghulab-snapshot.tar.gz, 跑 restore-from-cos.sh"
echo
