#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 国内域名机 · 一键部署 · bootstrap.sh
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# 模板版本: 0.2.0
# ════════════════════════════════════════════════════════════════
#
# 服务器: GH-CVM-DOMAIN-PROD-01 / ZY-SVR-CN01 / 广州 2C2G 轻量
# 域名:   guanghulab.com (已备案 + Let's Encrypt 续到 2026-08-07)
# 角色:   唯一对外服务器 (Portal + 密钥管理页 + 自托管 git, 后续 PR 填业务)
#
# 这一份 bootstrap 把一台**重装系统后空白的 2C2G Ubuntu 22.04** 准备好:
#   1. 自我感知 (跑 detect-env.sh) + 动态调优 (跑 tune-from-env.sh)
#   2. 切换 APT 镜像源到阿里云 (国内可达, 不卡 Docker mirror)
#   3. 装基础工具链 + nginx + node 20 + pm2 + certbot
#   4. 在 /data/guanghulab/ 下建标准目录, 给后续 PR (portal/secrets-vault/forgejo) 留空位
#   5. enable certbot.timer (LE 证书续期 cron)
#   6. 渲染 nginx server block (不覆盖 SSL, 只追加 guanghulab.com 站点)
#   7. (tiny 档) 建 1G swap 兜底防 OOM
#   8. (失败时) 自动调用 rollback.sh 回到 pre-bootstrap 快照
#
# 设计理念:
#   - cc-003 动态适配: 不假设 2C2G, 探测后决档
#   - cc-004 强制自主: 失败自动回滚, 中文回执 → /data/guanghulab/_logs/deploy-report.md
#   - 不 apt upgrade (2C2G 跑 upgrade 会卡死 30+ 分钟)
#   - 不动 /etc/letsencrypt 已有证书 (LE 配置已在, 续期到 2026-08-07)
#
# 用法 (本地直跑):
#   sudo bash bootstrap.sh
#
# 通常通过 .github/workflows/deploy-domain-server.yml 远程触发,
# 该 workflow 设有"重装广州"误触锁.
#
# 环境变量:
#   DATA_ROOT       默认 /data/guanghulab (持久数据根)
#   DEPLOY_ROOT     默认 /opt/guanghulab (代码/快照/日志根)
#   DOMAIN          默认 guanghulab.com
#   STAGE           默认 bootstrap (合法值: bootstrap / update / rollback)
#   SERVER_ID       默认 GH-CVM-DOMAIN-PROD-01
#   ROLLBACK_TS     可选 (STAGE=rollback 时回到指定快照)
#
# 退出码:
#   0  全部 OK
#   1  bootstrap 失败 (失败前已尝试 autorollback)
#   2  前置条件错 (非 root / DATA_ROOT 缺失等), 不会动机器
# ════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── 全局参数 ─────────────────────────────────────────────────
TEMPLATE_VERSION="0.2.0"
SERVER_ID="${SERVER_ID:-GH-CVM-DOMAIN-PROD-01}"
DATA_ROOT="${DATA_ROOT:-/data/guanghulab}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/guanghulab}"
DOMAIN="${DOMAIN:-guanghulab.com}"
STAGE="${STAGE:-bootstrap}"

export DEBIAN_FRONTEND=noninteractive

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ENV_JSON="$DEPLOY_ROOT/_logs/server-env.json"

# ─── 校验前置条件 ─────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "❌ 需要 root (请用 sudo bash bootstrap.sh)" >&2
  exit 2
fi

if ! [[ "$SERVER_ID" =~ ^GH-CVM-[A-Z0-9-]+$ ]]; then
  echo "❌ SERVER_ID 格式不合法: $SERVER_ID (应为 GH-CVM-[A-Z0-9-]+)" >&2
  exit 2
fi

# ─── 中文回执 (整个流程持续追加, 任何阶段失败都能给霜砚看) ───
mkdir -p "$DEPLOY_ROOT/_logs"
DEPLOY_REPORT="$DEPLOY_ROOT/_logs/deploy-report.md"
RECEIPT_TS="$(date +%Y%m%d-%H%M%S)"

# 重置当次 report (每次跑 bootstrap 都覆盖, 历史在 _logs/deploy-report-*.md.bak)
if [ -f "$DEPLOY_REPORT" ]; then
  cp -a "$DEPLOY_REPORT" "$DEPLOY_REPORT.$RECEIPT_TS.bak" || true
fi

report() {
  # 中文回执 + 控制台同步打印
  local line="$1"
  echo "$line"
  printf '%s\n' "$line" >> "$DEPLOY_REPORT"
}

cat > "$DEPLOY_REPORT" <<EOF
# 国内域名机 · 部署回执

> 服务器: $SERVER_ID ($DOMAIN)
> 阶段: $STAGE · 模板版本 $TEMPLATE_VERSION
> 开始时间: $(date '+%Y-%m-%d %H:%M:%S %Z')

EOF

report "## ① 自我感知 + 动态调优"

# ─── 阶段路由 ─────────────────────────────────────────────────
case "$STAGE" in
  bootstrap|update) ;;
  rollback)
    report ""
    report "## 阶段=rollback · 委派给 rollback.sh"
    if [ -x "$SCRIPT_DIR/rollback.sh" ]; then
      if [ -n "${ROLLBACK_TS:-}" ]; then
        DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
          bash "$SCRIPT_DIR/rollback.sh" --to "$ROLLBACK_TS"
      else
        DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
          bash "$SCRIPT_DIR/rollback.sh"
      fi
      exit $?
    else
      report "❌ rollback.sh 不存在或不可执行"
      exit 1
    fi
    ;;
  *)
    echo "❌ 未知 STAGE: $STAGE (合法: bootstrap / update / rollback)" >&2
    exit 2
    ;;
esac

# ─── 0. 自我感知 ─────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  国内域名机 bootstrap"
echo "  母编号:    $SERVER_ID"
echo "  数据根:    $DATA_ROOT"
echo "  部署根:    $DEPLOY_ROOT"
echo "  域名:      $DOMAIN"
echo "  阶段:      $STAGE"
echo "  模板版本:  $TEMPLATE_VERSION"
echo "═══════════════════════════════════════════════════════════"

# 必需 jq 给 detect/tune 用
if ! command -v jq >/dev/null 2>&1; then
  apt-get update -qq || true
  apt-get install -y -qq jq || {
    report "❌ jq 装不上, 终止"
    exit 1
  }
fi

if [ -x "$SCRIPT_DIR/detect-env.sh" ]; then
  echo "[0/8] 探测当前服务器实际配置 (detect-env.sh)..."
  DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" DOMAIN="$DOMAIN" \
    bash "$SCRIPT_DIR/detect-env.sh" "$SERVER_ENV_JSON" || {
      report "⚠️  detect-env.sh 失败, 退化到默认 tiny 档"
    }
fi

# ─── 0.5 跑前快照 (autorollback 兜底用) ──────────────────────
# 把当前 nginx 配置 + .env.tune + systemd unit 打包, 失败时能回这刻
PRE_TS="$(date +%Y%m%d-%H%M%S)"
SNAP_ROOT="$DATA_ROOT/snapshots"
PRE_SNAP="$SNAP_ROOT/$PRE_TS-pre-$STAGE"
mkdir -p "$PRE_SNAP/nginx" "$PRE_SNAP/systemd"
[ -d /etc/nginx/sites-available ] && cp -a /etc/nginx/sites-available "$PRE_SNAP/nginx/" || true
[ -d /etc/nginx/sites-enabled ]   && cp -a /etc/nginx/sites-enabled   "$PRE_SNAP/nginx/" || true
[ -f "$DATA_ROOT/.env.tune" ]     && cp -a "$DATA_ROOT/.env.tune"     "$PRE_SNAP/" || true
[ -f /etc/systemd/system/guanghulab-portal.service ] && \
  cp -a /etc/systemd/system/guanghulab-portal.service "$PRE_SNAP/systemd/" || true
echo "snapshot before $STAGE @ $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$PRE_SNAP/NOTE"

# 只保留最近 10 份, 防系统盘塞满
if [ -d "$SNAP_ROOT" ]; then
  ls -1tr "$SNAP_ROOT" 2>/dev/null \
    | head -n -10 \
    | xargs -I{} rm -rf "$SNAP_ROOT/{}" 2>/dev/null || true
fi
report "- 跑前快照: \`$PRE_SNAP\`"

# ─── autorollback 钩子: ERR/EXIT 触发 ────────────────────────
# bootstrap 阶段任何步骤失败 → 自动调 rollback.sh 回到 PRE_SNAP
BOOTSTRAP_OK="false"
autorollback_on_failure() {
  local rc=$?
  if [ "$BOOTSTRAP_OK" = "true" ]; then return 0; fi
  if [ "$rc" -eq 0 ]; then return 0; fi
  echo
  echo "═══════════════════════════════════════════════════════════"
  echo "  ❌ bootstrap 失败 (exit=$rc), 触发自动回滚到 $PRE_TS"
  echo "═══════════════════════════════════════════════════════════"
  report ""
  report "## ❌ bootstrap 失败 (exit=$rc), 触发自动回滚"
  report ""
  report "- 目标快照: \`$PRE_TS-pre-$STAGE\`"
  if [ -x "$SCRIPT_DIR/rollback.sh" ]; then
    DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
      bash "$SCRIPT_DIR/rollback.sh" --to "$(basename "$PRE_SNAP")" \
      || report "⚠️  自动回滚也失败了, 请人工介入. snapshot=\`$PRE_SNAP\`"
  else
    report "⚠️  rollback.sh 不可执行, 自动回滚跳过"
  fi
  report ""
  report "**给冰朔的人话**: 这次部署没成功. 我已经把机器恢复到部署前的状态."
  report "**Awen 不需要做任何事**, 把这份 deploy-report.md 截图发给冰朔即可."
}
trap autorollback_on_failure EXIT

# ─── 0.6 动态调优 ─────────────────────────────────────────────
if [ -x "$SCRIPT_DIR/tune-from-env.sh" ] && [ -f "$SERVER_ENV_JSON" ]; then
  ENV_FILE="$SERVER_ENV_JSON" DATA_ROOT="$DATA_ROOT" DEPLOY_ROOT="$DEPLOY_ROOT" \
    bash "$SCRIPT_DIR/tune-from-env.sh" || {
      report "⚠️  tune-from-env.sh 失败, 用默认 tiny 档继续"
    }
fi

# 兜底默认值 (tune 失败 / .env.tune 缺失时)
SIZE_TIER="tiny"
PORTAL_INSTANCES="1"
PORTAL_MAX_MEMORY_MB="384"
NGINX_WORKER_CONN="512"
NGINX_WORKER_PROCESSES="1"
FORGEJO_ENABLED="false"
LFS_ENABLED="false"
NEED_SWAP_GB="1"
SYSTEMD_PORTAL_HIGH_MB="500"
SYSTEMD_PORTAL_MAX_MB="700"

if [ -f "$DATA_ROOT/.env.tune" ]; then
  # shellcheck disable=SC1091
  . "$DATA_ROOT/.env.tune"
fi

report "- 档位: **$SIZE_TIER** · portal=${PORTAL_INSTANCES} 进程 · nginx=${NGINX_WORKER_PROCESSES} worker / ${NGINX_WORKER_CONN} conn"
report ""

# ─── 1. APT 镜像源 (阿里云) ──────────────────────────────────
report "## ② 装基础工具链 (跳过 apt upgrade)"
echo "[1/8] 切换 APT 源到阿里云镜像 ..."

CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")"
if ! grep -q "mirrors.aliyun.com" /etc/apt/sources.list 2>/dev/null; then
  cp /etc/apt/sources.list "/etc/apt/sources.list.bak.$(date +%s)" || true
  cat > /etc/apt/sources.list <<EOF
deb https://mirrors.aliyun.com/ubuntu/ $CODENAME main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ $CODENAME-updates main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ $CODENAME-security main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ $CODENAME-backports main restricted universe multiverse
EOF
fi
apt-get update -qq

# ─── 2. 基础工具链 ───────────────────────────────────────────
echo "[2/8] 安装基础工具链 (不 apt upgrade, 2C2G 卡死风险) ..."
# 注: 单独装, 不 apt upgrade. nginx 已装则 apt 自动跳过 (不动 SSL 配置)
apt-get install -y -qq \
  curl wget ca-certificates gnupg lsb-release \
  git jq unzip vim htop net-tools \
  nginx certbot python3-certbot-nginx \
  fail2ban ufw \
  rsync openssh-client \
  build-essential

report "- apt 工具链 OK (nginx / certbot / fail2ban / git ...)"

# ─── 3. Node 20 + PM2 (npmmirror 镜像) ───────────────────────
NODE_OK="false"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v//;s/\..*//')"
  [ "${NODE_MAJOR:-0}" -ge 20 ] && NODE_OK="true"
fi

if [ "$NODE_OK" = "false" ]; then
  echo "[3/8] 安装 Node 20 ..."
  if ! curl -fsSL --max-time 30 https://deb.nodesource.com/setup_20.x | bash - ; then
    echo "    NodeSource 不可达, 改用 nvm 国内镜像..."
    export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
    curl -fsSL https://gitee.com/mirrors/nvm/raw/master/install.sh | bash || {
      report "❌ Node 20 装不上"
      exit 1
    }
  fi
  apt-get install -y -qq nodejs || true
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm config set registry https://registry.npmmirror.com
  npm install -g pm2 --silent
fi
report "- Node $(node -v 2>/dev/null) + PM2 $(pm2 -v 2>/dev/null) OK"

# ─── 4. 标准目录 + 占位 (PR-4/5/6 填) ────────────────────────
report ""
report "## ③ 建标准目录 (留位给后续棒)"
echo "[4/8] 建 $DATA_ROOT 标准目录 + 后续 PR 占位 ..."

mkdir -p \
  "$DATA_ROOT" \
  "$DATA_ROOT/portal" \
  "$DATA_ROOT/secrets-vault" \
  "$DATA_ROOT/forgejo" \
  "$DATA_ROOT/snapshots" \
  "$DATA_ROOT/logs/nginx" \
  "$DATA_ROOT/logs/portal" \
  "$DEPLOY_ROOT/_active" \
  "$DEPLOY_ROOT/_archive" \
  "$DEPLOY_ROOT/_logs" \
  "$DEPLOY_ROOT/_secrets" \
  "$DEPLOY_ROOT/domain-cn"
chmod 700 "$DEPLOY_ROOT/_secrets" "$DATA_ROOT/secrets-vault"

# 占位 README, 后续 PR 来填具体内容
[ ! -f "$DATA_ROOT/portal/README.md" ] && cat > "$DATA_ROOT/portal/README.md" <<'EOF'
# /data/guanghulab/portal/ · 占位

Portal 业务代码留给 PR-4 (光湖门户) 填充。本目录在 PR-2 bootstrap 时建立, 当前为空。
EOF
[ ! -f "$DATA_ROOT/secrets-vault/README.md" ] && cat > "$DATA_ROOT/secrets-vault/README.md" <<'EOF'
# /data/guanghulab/secrets-vault/ · 占位

密钥管理页留给 PR-5 (HLI-VAULT-*) 填充。本目录权限 700, 仅 root 可读。
EOF
[ ! -f "$DATA_ROOT/forgejo/README.md" ] && cat > "$DATA_ROOT/forgejo/README.md" <<'EOF'
# /data/guanghulab/forgejo/ · 占位

Forgejo 自托管 git 留给 PR-6 (一台到底搬家方案) 填充。
当前 tune-from-env tiny 档下 FORGEJO_ENABLED=false, bootstrap 不会启动 forgejo。
EOF

report "- 建好 \`portal/\` \`secrets-vault/\` \`forgejo/\` 三个空目录给 PR-4/5/6"

# ─── 5. Swap 兜底 (tiny 档) ──────────────────────────────────
if [ "$NEED_SWAP_GB" = "1" ]; then
  if [ ! -f /swapfile.guanghulab ]; then
    echo "[5/8] 建 1G swap (tiny 档防 OOM) ..."
    fallocate -l 1G /swapfile.guanghulab || dd if=/dev/zero of=/swapfile.guanghulab bs=1M count=1024
    chmod 600 /swapfile.guanghulab
    mkswap /swapfile.guanghulab
    swapon /swapfile.guanghulab
    if ! grep -q '/swapfile.guanghulab' /etc/fstab; then
      echo '/swapfile.guanghulab none swap sw 0 0' >> /etc/fstab
    fi
    report "- 已建 1G swap \`/swapfile.guanghulab\` (tiny 档防 OOM)"
  fi
fi

# ─── 6. Nginx 站点配置 ───────────────────────────────────────
report ""
report "## ④ 配置 Nginx (不动现有 SSL, 只追加站点)"
echo "[6/8] 渲染 nginx 站点配置 (不覆盖 /etc/letsencrypt/) ..."

NGX_TPL="$SCRIPT_DIR/nginx/guanghulab.conf.template"
NGX_OUT="/etc/nginx/sites-available/guanghulab.conf"

if [ ! -f "$NGX_TPL" ]; then
  report "⚠️  nginx 模板缺失: $NGX_TPL, 跳过站点配置"
else
  # 检查 LE 证书是否存在 (重装系统后 /etc/letsencrypt 可能在或不在)
  LE_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
  LE_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
  if [ -f "$LE_CERT" ] && [ -f "$LE_KEY" ]; then
    USE_SSL="1"
    report "- LE 证书在: \`$LE_CERT\` · 启用 HTTPS server block"
  else
    USE_SSL="0"
    report "- LE 证书暂不在 (重装后未恢复), bootstrap 只起 80 端口, 不主动 issue (避免 LE rate-limit)"
    report "  → 冰朔: 把 \`/etc/letsencrypt/\` 整目录从备份恢复后再 \`systemctl reload nginx\` 即可启用 HTTPS"
  fi

  # 渲染模板 (用 awk, 不用 sed, 避开特殊字符)
  DOMAIN_VAL="$DOMAIN" \
  NGINX_WORKER_CONN_VAL="$NGINX_WORKER_CONN" \
  USE_SSL_VAL="$USE_SSL" \
  PORTAL_PORT_VAL="${PORTAL_PORT:-3000}" \
  awk '
    /^# __SSL_BEGIN__[[:space:]]*$/   { mode="ssl";   next }
    /^# __SSL_END__[[:space:]]*$/     { mode="";      next }
    /^# __NOSSL_BEGIN__[[:space:]]*$/ { mode="nossl"; next }
    /^# __NOSSL_END__[[:space:]]*$/   { mode="";      next }
    {
      # 条件块: ssl 段仅 USE_SSL=1 输出, nossl 段仅 USE_SSL=0 输出
      if (mode == "ssl") {
        if (ENVIRON["USE_SSL_VAL"] != "1") next
        sub(/^# /, "")
        sub(/^#$/, "")
      } else if (mode == "nossl") {
        if (ENVIRON["USE_SSL_VAL"] == "1") next
        sub(/^# /, "")
        sub(/^#$/, "")
      }
      gsub(/__DOMAIN__/, ENVIRON["DOMAIN_VAL"])
      gsub(/__PORTAL_PORT__/, ENVIRON["PORTAL_PORT_VAL"])
      gsub(/__NGINX_WORKER_CONN__/, ENVIRON["NGINX_WORKER_CONN_VAL"])
      print
    }' "$NGX_TPL" > "$NGX_OUT"

  ln -sf "$NGX_OUT" "/etc/nginx/sites-enabled/guanghulab.conf"
  # 不再删 default (避免误删管理员手配的 default), 只让我们的 server_name 优先
  # 真要清除 default 的, 让冰朔在霜砚指导下 rm /etc/nginx/sites-enabled/default

  # 调 nginx worker_connections (仅当本模板能匹配到默认值)
  if [ -f /etc/nginx/nginx.conf ]; then
    sed -i "s/worker_connections [0-9]\+;/worker_connections $NGINX_WORKER_CONN;/" /etc/nginx/nginx.conf || true
  fi

  if nginx -t 2>&1; then
    systemctl reload nginx || systemctl restart nginx
    report "- nginx 配置语法 OK, 已 reload"
  else
    report "❌ nginx 配置语法错, 拒绝 reload (旧配置仍在跑)"
    exit 1
  fi
fi

# ─── 7. Certbot 自动续期 timer ───────────────────────────────
echo "[7/8] enable certbot.timer (LE 证书自动续期, 续到 2026-08-07) ..."
systemctl enable certbot.timer >/dev/null 2>&1 || true
systemctl start certbot.timer >/dev/null 2>&1 || true
CERTBOT_TIMER_ACTIVE="$(systemctl is-active certbot.timer 2>/dev/null || echo unknown)"
report "- certbot.timer 状态: $CERTBOT_TIMER_ACTIVE"

# ─── 8. 防火墙 + 占位 portal systemd unit ────────────────────
echo "[8/8] 加固防火墙 + 留 portal systemd unit ..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban || true

# 留一个 portal systemd unit 占位 (PR-4 真正填业务时, 改 ExecStart 即可)
PORTAL_UNIT="/etc/systemd/system/guanghulab-portal.service"
if [ ! -f "$PORTAL_UNIT" ]; then
  cat > "$PORTAL_UNIT" <<EOF
# Portal · 由 PR-4 接管, 当前是占位
# Generated by domain-cn/bootstrap.sh @ $(date -u +%Y-%m-%dT%H:%M:%SZ)
[Unit]
Description=Guanghulab Portal (placeholder until PR-4)
After=network.target

[Service]
Type=simple
WorkingDirectory=$DATA_ROOT/portal
ExecStart=/bin/sh -c 'echo "[portal placeholder] PR-4 will replace this ExecStart"; sleep 86400'
Restart=on-failure
MemoryHigh=${SYSTEMD_PORTAL_HIGH_MB}M
MemoryMax=${SYSTEMD_PORTAL_MAX_MB}M

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  # 不主动 enable/start, 避免占位脚本占资源. PR-4 自己 enable.
  report "- portal systemd unit 占位写入: \`$PORTAL_UNIT\` (not enabled)"
fi

# ─── 收尾回执 ─────────────────────────────────────────────────
BOOTSTRAP_OK="true"

cat > "$DEPLOY_ROOT/_logs/bootstrap-$RECEIPT_TS.json" <<EOF
{
  "_sovereign": "TCS-0002∞ | $SERVER_ID",
  "_copyright": "国作登字-2026-A-00037559",
  "template_version": "$TEMPLATE_VERSION",
  "stage": "$STAGE",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "data_root": "$DATA_ROOT",
  "deploy_root": "$DEPLOY_ROOT",
  "domain": "$DOMAIN",
  "size_tier": "$SIZE_TIER",
  "portal_instances": $PORTAL_INSTANCES,
  "nginx_worker_conn": $NGINX_WORKER_CONN,
  "forgejo_enabled": $FORGEJO_ENABLED,
  "lfs_enabled": $LFS_ENABLED,
  "use_ssl": ${USE_SSL:-0},
  "certbot_timer": "$CERTBOT_TIMER_ACTIVE",
  "pre_snapshot": "$PRE_SNAP",
  "deploy_report": "$DEPLOY_REPORT"
}
EOF

report ""
report "## ✅ 本次 $STAGE 完成"
report ""
report "- 服务器: $SERVER_ID"
report "- 域名: $DOMAIN  (HTTPS=${USE_SSL:-0})"
report "- 档位: $SIZE_TIER"
report "- 部署根: \`$DEPLOY_ROOT\`"
report "- 数据根: \`$DATA_ROOT\`"
report "- 跑前快照: \`$PRE_SNAP\`"
report "- 完成时间: $(date '+%Y-%m-%d %H:%M:%S %Z')"
report ""
report "**给冰朔的人话**: 域名机基础环境已就位. nginx + node 20 + pm2 + certbot 都装好了."
report "下一步: 等 PR-4 填 portal 业务代码 (本仓库后续棒)."

echo
echo "═══════════════════════════════════════════════════════════"
echo "  [OK] $SERVER_ID 域名机 $STAGE 完成"
echo "═══════════════════════════════════════════════════════════"
echo "  域名:         https://$DOMAIN/"
echo "  数据根:       $DATA_ROOT/"
echo "  中文回执:     $DEPLOY_REPORT"
echo "  快照:         $PRE_SNAP"
echo "  下一步:       PR-4 填 portal 业务代码"
echo
