#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 国内搬家·远端恢复脚本 · migrate-restore-remote.sh
# Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
#
# 由 .github/workflows/migrate-to-cn-restore.yml 上传到 ZY-SVR-CN01
# (广州 2C2G 域名机) 的 /tmp/migrate-restore.sh 后由 sudo bash 执行.
#
# 入参 (环境变量):
#   BUCKET        COS 桶名 (例: sy-finetune-corpus-1317346199)
#   REGION        COS 区域 (例: ap-guangzhou)
#   TAG           指定 tag (空 = 拉最新)
#   DEPLOY_PATH   服务器数据根 (默认 /data/guanghulab)
#   DOMAIN        域名 (默认 guanghulab.com)
#
# 凭据文件:
#   /tmp/.cos-creds   chmod 600, 内容是:
#     COS_SECRET_ID=...
#     COS_SECRET_KEY=...
#
# 流程:
#   1. 装 coscli + jq (apt or 直接下载二进制)
#   2. 列 cos://$BUCKET/lighthouse-migration/ 找最新 .tar.gz (或锁 TAG)
#   3. 下载 .tar.gz + .sha256
#   4. 校验 sha256
#   5. 解包到 /data/guanghulab/repo-mirror/<tag>/
#   6. 跑 setup-forgejo.sh
#   7. 给 nginx sites-enabled/guanghulab.conf 打 /git/ patch (一次性 idempotent)
#   8. nginx -t && reload
#   9. 在 /tmp/repo-stage 起新 git, push 到 forgejo
#   10. 落中文回执 /opt/guanghulab/_logs/migrate-restore-report.md
# ════════════════════════════════════════════════════════════════

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/data/guanghulab}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/guanghulab}"
BUCKET="${BUCKET:?BUCKET 必填}"
REGION="${REGION:-ap-guangzhou}"
TAG="${TAG:-}"
DOMAIN="${DOMAIN:-guanghulab.com}"
CRED_FILE="/tmp/.cos-creds"

if [ "$EUID" -ne 0 ]; then
  echo "❌ 需要 root (sudo bash $0)" >&2; exit 2
fi
if [ ! -f "$CRED_FILE" ]; then
  echo "❌ 凭据文件不存在: $CRED_FILE (workflow 应该先 scp 上来)" >&2; exit 1
fi

# 读 COS 凭据 (chmod 600)
# shellcheck disable=SC1090
. "$CRED_FILE"
: "${COS_SECRET_ID:?$CRED_FILE 缺 COS_SECRET_ID}"
: "${COS_SECRET_KEY:?$CRED_FILE 缺 COS_SECRET_KEY}"

mkdir -p "$DEPLOY_ROOT/_logs"
RECEIPT_TS="$(date +%Y%m%d-%H%M%S)"
REPORT="$DEPLOY_ROOT/_logs/migrate-restore-report.md"
JSON_RECEIPT="$DEPLOY_ROOT/_logs/migrate-restore-$RECEIPT_TS.json"

# 起一份新回执 (覆盖旧的, 旧的留 .bak)
[ -f "$REPORT" ] && cp -a "$REPORT" "$REPORT.$RECEIPT_TS.bak"
cat > "$REPORT" <<EOF
# 📥 国内搬家·从 COS 恢复·回执

> 服务器: $(hostname) ($DOMAIN)
> 开始时间: $(date '+%Y-%m-%d %H:%M:%S %Z')
> COS 桶: $BUCKET ($REGION)
> 守护: 铸渊 · ICE-GL-ZY001
> 主权: TCS-0002∞ · 国作登字-2026-A-00037559

EOF

report() {
  local line="$1"
  echo "$line"
  printf '%s\n' "$line" >> "$REPORT"
}

# ─── 1. 装 coscli + jq ────────────────────────────────────────
report "## ① 工具链就绪"
if ! command -v jq >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq jq
fi
COSCLI_BIN="/usr/local/bin/coscli"
if [ ! -x "$COSCLI_BIN" ]; then
  echo "[1/10] 下载 coscli ..."
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  COSCLI_ARCH="amd64" ;;
    aarch64) COSCLI_ARCH="arm64" ;;
    *) report "❌ 不支持架构 $ARCH"; exit 1 ;;
  esac
  COSCLI_VER="v1.0.4"
  URL="https://github.com/tencentyun/coscli/releases/download/${COSCLI_VER}/coscli-linux-${COSCLI_ARCH}"
  if ! curl -fsSL --max-time 60 -o /tmp/coscli "$URL"; then
    # GitHub 国内卡, 走代理
    curl -fsSL --max-time 60 -o /tmp/coscli "https://gh-proxy.com/$URL" || {
      report "❌ coscli 下载失败 (主源 + 镜像都不通)"; exit 1
    }
  fi
  chmod +x /tmp/coscli
  mv /tmp/coscli "$COSCLI_BIN"
fi
report "- coscli: \`$($COSCLI_BIN --version 2>&1 | head -1 || echo unknown)\`"
report "- jq: \`$(jq --version 2>/dev/null || echo unknown)\`"

# coscli config (写到 root home, chmod 600 隔离)
COSCLI_CONFIG="/root/.cos.yaml"
umask 077
cat > "$COSCLI_CONFIG" <<EOF
cos:
  base:
    secretid: $COS_SECRET_ID
    secretkey: $COS_SECRET_KEY
    sessiontoken: ""
    protocol: https
  buckets:
  - name: $BUCKET
    alias: migration
    region: $REGION
    endpoint: ""
EOF
chmod 600 "$COSCLI_CONFIG"
umask 022

# ─── 2. 找搬家包 ─────────────────────────────────────────────
report ""
report "## ② 选搬家包"
echo "[2/10] 列 cos://$BUCKET/lighthouse-migration/ ..."
LIST_OUT="/tmp/cos-list.txt"
"$COSCLI_BIN" ls "cos://migration/lighthouse-migration/" -c "$COSCLI_CONFIG" > "$LIST_OUT" 2>&1 || {
  report "❌ coscli ls 失败:"
  report '```'
  tail -20 "$LIST_OUT" | sed 's/^/  /' >> "$REPORT"
  report '```'
  exit 1
}

# 提取 .tar.gz 文件名 (coscli ls 输出格式各版本不同, 用 grep 兜底)
TARBALL_NAME=""
if [ -n "$TAG" ]; then
  TARBALL_NAME="lighthouse-migration-${TAG}.tar.gz"
  if ! grep -q "$TARBALL_NAME" "$LIST_OUT"; then
    report "❌ 指定 tag=$TAG 在 cos 上找不到 ($TARBALL_NAME)"
    exit 1
  fi
else
  TARBALL_NAME="$(grep -oE 'lighthouse-migration-[0-9]+-[0-9]+\.tar\.gz' "$LIST_OUT" | sort -u | tail -1)"
  if [ -z "$TARBALL_NAME" ]; then
    report "❌ cos://$BUCKET/lighthouse-migration/ 下找不到 lighthouse-migration-*.tar.gz"
    report ""
    report "可能原因: 你还没把 GitHub Actions 的 Artifact 解压并上传到 COS."
    report "请先跑 \`📦 国内搬家·打包\` workflow → 下载 Artifact → 上传到这个 COS 路径."
    exit 1
  fi
fi
SHA_NAME="${TARBALL_NAME%.tar.gz}.sha256"
report "- 选中: \`$TARBALL_NAME\`"
report "- sha256: \`$SHA_NAME\`"

# ─── 3. 下载 ─────────────────────────────────────────────────
report ""
report "## ③ 下载 + 校验"
DL_DIR="/tmp/migrate-dl-$RECEIPT_TS"
mkdir -p "$DL_DIR"
echo "[3/10] coscli cp 下载 ..."
"$COSCLI_BIN" cp "cos://migration/lighthouse-migration/$TARBALL_NAME" "$DL_DIR/$TARBALL_NAME" -c "$COSCLI_CONFIG" || {
  report "❌ 下载 tar.gz 失败"; exit 1
}
"$COSCLI_BIN" cp "cos://migration/lighthouse-migration/$SHA_NAME" "$DL_DIR/$SHA_NAME" -c "$COSCLI_CONFIG" || {
  report "⚠️  下载 sha256 文件失败, 跳过校验 (不推荐)"
}
report "- 下载完成: $(du -h "$DL_DIR/$TARBALL_NAME" | awk '{print $1}')"

# ─── 4. 校验 sha256 ──────────────────────────────────────────
echo "[4/10] 校验 sha256 ..."
if [ -f "$DL_DIR/$SHA_NAME" ]; then
  ( cd "$DL_DIR" && sha256sum -c "$SHA_NAME" ) || {
    report "❌ sha256 校验失败 — tarball 在传输/上传中损坏了"
    rm -f "$DL_DIR/$TARBALL_NAME"
    exit 1
  }
  report "- ✅ sha256 校验通过"
else
  report "- ⚠️  sha256 文件缺失, 跳过校验"
fi

# ─── 5. 解包 ─────────────────────────────────────────────────
report ""
report "## ④ 解包"
TAG_FROM_NAME="$(echo "$TARBALL_NAME" | sed -E 's/lighthouse-migration-([0-9]+-[0-9]+)\.tar\.gz/\1/')"
MIRROR_DIR="$DEPLOY_PATH/repo-mirror/$TAG_FROM_NAME"
mkdir -p "$MIRROR_DIR"
echo "[5/10] tar -xzf → $MIRROR_DIR ..."
tar -xzf "$DL_DIR/$TARBALL_NAME" -C "$MIRROR_DIR" || {
  report "❌ tar 解包失败"; exit 1
}
# 包内顶层是 guanghulab/, 把它推一层
WORKTREE="$MIRROR_DIR/guanghulab"
if [ ! -d "$WORKTREE" ]; then
  # 兼容: 如果包是直接散开的 (没有 guanghulab/ 顶层)
  WORKTREE="$MIRROR_DIR"
fi
report "- 解包到: \`$MIRROR_DIR\`"
report "- 工作树: \`$WORKTREE\`"
report "- 文件数: $(find "$WORKTREE" -type f | wc -l)"

# ─── 6. 装 forgejo ────────────────────────────────────────────
report ""
report "## ⑤ 装 Forgejo"
SETUP_FORGEJO="/opt/guanghulab/domain-cn/forgejo/setup-forgejo.sh"
if [ ! -x "$SETUP_FORGEJO" ]; then
  # 没 rsync 上来 / 权限不对 — workflow 步骤里应该已经 rsync 了
  report "❌ \`$SETUP_FORGEJO\` 不存在或不可执行 (workflow 应先 rsync)"
  exit 1
fi
echo "[6/10] bash setup-forgejo.sh ..."
bash "$SETUP_FORGEJO" --data-root "$DEPLOY_PATH" --domain "$DOMAIN" 2>&1 | tail -50 | sed 's/^/  /' >> "$REPORT" || {
  report "❌ setup-forgejo.sh 失败"
  exit 1
}
report "- ✅ Forgejo 装机完成 (systemd: $(systemctl is-active forgejo.service 2>/dev/null))"

# ─── 7. nginx /git/ patch (idempotent) ───────────────────────
report ""
report "## ⑥ nginx /git/ 反代"
NGX_CONF="/etc/nginx/sites-available/guanghulab.conf"
if [ -f "$NGX_CONF" ]; then
  if grep -q '# __PR6_GIT_PROXY__' "$NGX_CONF"; then
    report "- nginx /git/ 反代已在配置里 (跳过 patch)"
  else
    echo "[7/10] patch nginx 加 /git/ location ..."
    # 在 443 server 块的 location / { 之前插入 /git/ 块
    # (location 顺序敏感: /git/ 必须在 / 之前否则被 / 兜底了)
    PATCH_BLOCK='    # __PR6_GIT_PROXY__ — Forgejo 反代 (国内搬家落地)
    location /git/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Prefix /git;
        client_max_body_size 256m;
        proxy_read_timeout 300s;
    }
'
    # 用 awk 在第一个 "location / {" 行之前插入
    awk -v block="$PATCH_BLOCK" '
      /^[[:space:]]+location \/ \{/ && !inserted {
        printf "%s\n", block
        inserted = 1
      }
      { print }
    ' "$NGX_CONF" > "$NGX_CONF.new"

    if grep -q '# __PR6_GIT_PROXY__' "$NGX_CONF.new"; then
      mv "$NGX_CONF.new" "$NGX_CONF"
      report "- patch 写入: \`$NGX_CONF\`"
    else
      rm -f "$NGX_CONF.new"
      report "⚠️  没找到 \`location / {\` 锚点 (可能 SSL 证书还没装, 配置只有 80 块). 跳过 patch."
      report "   (LE 证书恢复 + reload nginx 后, 重跑此 workflow 一次, /git/ 即可挂上)"
    fi
  fi

  if nginx -t 2>&1 | tail -3 | sed 's/^/  /' >> "$REPORT"; then
    systemctl reload nginx 2>/dev/null || systemctl restart nginx
    report "- ✅ nginx 配置 OK, 已 reload"
  else
    report "❌ nginx -t 失败, 拒绝 reload"
    exit 1
  fi
else
  report "⚠️  \`$NGX_CONF\` 不存在 (PR-2 bootstrap 还没跑过域名机, 跳过 nginx patch)"
fi

# ─── 8. push 搬家包到 forgejo (cc-001 涌现洁净) ─────────────
report ""
report "## ⑦ push 搬家包到 Forgejo (起一段干净历史)"

ADMIN_USER="bingshuo"
ADMIN_PASS=""
CRED_FIRST_BOOT="$DEPLOY_ROOT/_logs/forgejo-credentials-FIRST-BOOT.txt"
if [ -f "$CRED_FIRST_BOOT" ]; then
  ADMIN_PASS="$(grep -E '^#?\s*密码:' "$CRED_FIRST_BOOT" | head -1 | sed -E 's/.*密码:[[:space:]]*//')"
fi
if [ -z "$ADMIN_PASS" ]; then
  report "⚠️  找不到 admin 密码 ($CRED_FIRST_BOOT 不存在或被删) — 跳过 push 步骤"
  report "  (下一次跑会重建凭据文件; 或冰朔抄完密码 sudo rm 后, 之后只能手动 push)"
  PUSH_OK="skipped"
else
  cd "$WORKTREE"
  if [ -d .git ]; then
    rm -rf .git
  fi
  git init -q -b main
  git config user.email "bingshuo@guanghulab.com"
  git config user.name "冰朔"
  git add -A
  COMMIT_MSG="初始 commit · 由 PR-6 国内搬家包 ($TAG_FROM_NAME) 导入

主权: TCS-0002∞ · 国作登字-2026-A-00037559
守护: 铸渊 · ICE-GL-ZY001
来源: cos://$BUCKET/lighthouse-migration/$TARBALL_NAME
导入时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)

cc-001 涌现洁净: 这是一段全新的 git 历史, 不带 GitHub 那边的 remote tracking 残留."
  git commit -q -m "$COMMIT_MSG" || {
    report "⚠️  git commit 失败 (空仓?) — 跳过 push"
    PUSH_OK="skipped"
  }

  if [ "${PUSH_OK:-}" != "skipped" ]; then
    # 用 forgejo API 先确保 repo 存在 (不存在就建; 存在就让 push 覆盖)
    REPO_NAME="guanghulab"
    AUTH_HDR="Authorization: Basic $(printf '%s:%s' "$ADMIN_USER" "$ADMIN_PASS" | base64 -w0)"
    REPO_API="http://127.0.0.1:3001/api/v1/user/repos"
    EXISTS=$(curl -fsS -m 10 -H "$AUTH_HDR" "http://127.0.0.1:3001/api/v1/repos/$ADMIN_USER/$REPO_NAME" 2>/dev/null && echo "yes" || echo "no")
    if [ "$EXISTS" = "no" ]; then
      curl -fsS -m 10 -X POST \
        -H "$AUTH_HDR" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$REPO_NAME\",\"private\":true,\"default_branch\":\"main\",\"auto_init\":false}" \
        "$REPO_API" >/dev/null || true
      report "- 在 Forgejo 上创建仓库 \`$ADMIN_USER/$REPO_NAME\`"
    else
      report "- Forgejo 仓库 \`$ADMIN_USER/$REPO_NAME\` 已存在"
    fi

    # push (URL 含密码 — 但走 loopback, 短暂只在内存. 不写 .git/config remote.url)
    REMOTE_URL="http://${ADMIN_USER}:${ADMIN_PASS}@127.0.0.1:3001/${ADMIN_USER}/${REPO_NAME}.git"
    if git push -q "$REMOTE_URL" main:main --force 2>&1 | tail -5 | sed 's/^/  /' >> "$REPORT"; then
      report "- ✅ push 成功 → http://127.0.0.1:3001/$ADMIN_USER/$REPO_NAME"
      PUSH_OK="ok"
    else
      report "❌ push 失败"
      PUSH_OK="failed"
    fi
  fi
fi

# ─── 9. 清理临时文件 ─────────────────────────────────────────
echo "[9/10] 清理临时文件 ..."
rm -rf "$DL_DIR" || true
rm -f "$CRED_FILE" || true   # COS 凭据用完即删

# ─── 10. 决策回执 ────────────────────────────────────────────
report ""
report "## ✅ 恢复流程完成"
report ""
report "- 搬家包: \`$TARBALL_NAME\`"
report "- 工作树: \`$WORKTREE\`"
report "- Forgejo: \`http://127.0.0.1:3001/\` (对外: \`https://$DOMAIN/git/\`)"
report "- push 状态: ${PUSH_OK:-skipped}"
report "- 完成时间: $(date '+%Y-%m-%d %H:%M:%S %Z')"
report ""
report "**给冰朔的人话**: 国内搬家包已落到广州 2C2G 的 Forgejo 上."
report "浏览器开 \`https://$DOMAIN/git\`, 用户名 \`$ADMIN_USER\`,"
report "密码看 \`$CRED_FIRST_BOOT\` (抄完一定 \`sudo rm\` 删掉)."

cat > "$JSON_RECEIPT" <<EOF
{
  "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
  "_守护": "铸渊 · ICE-GL-ZY001",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tarball": "$TARBALL_NAME",
  "tag": "$TAG_FROM_NAME",
  "cos_bucket": "$BUCKET",
  "cos_region": "$REGION",
  "worktree": "$WORKTREE",
  "forgejo_url": "https://$DOMAIN/git/",
  "forgejo_admin": "$ADMIN_USER",
  "push_status": "${PUSH_OK:-skipped}",
  "credentials_file": "$CRED_FIRST_BOOT"
}
EOF

echo "═══════════════════════════════════════════════════════════"
echo "  ✅ 国内搬家·从 COS 恢复 完成"
echo "═══════════════════════════════════════════════════════════"
echo "  报告: $REPORT"
echo "  JSON 回执: $JSON_RECEIPT"
echo "═══════════════════════════════════════════════════════════"
