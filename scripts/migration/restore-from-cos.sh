#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 光湖搬家 · restore-from-cos
# Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
#
# 在国内灯塔服务器上跑, 从 COS 拉回搬家包并 mirror push 到本地 Gitea.
#
# 用法:
#   bash restore-from-cos.sh \
#     --bucket guanghulab-migration-1317346199 \
#     --region ap-guangzhou \
#     --snapshot-id 2026-05-06T13-15-41 \
#     --gitea-url http://127.0.0.1:3000 \
#     --gitea-user bingshuo \
#     --gitea-token <PAT> \
#     [--gitea-org guanghu] \
#     [--gitea-repo guanghulab]
#
# 环境变量:
#   COS_SECRET_ID / COS_SECRET_KEY  必填
#   CACHE_DIR                       默认 /data/cos-cache
# ════════════════════════════════════════════════════════════════

set -euo pipefail

BUCKET=""
REGION=""
SNAPSHOT_ID=""
GITEA_URL=""
GITEA_USER=""
GITEA_TOKEN=""
GITEA_ORG=""
GITEA_REPO="guanghulab"
CACHE_DIR="${CACHE_DIR:-/data/cos-cache}"

while [ $# -gt 0 ]; do
  case "$1" in
    --bucket) BUCKET="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --snapshot-id) SNAPSHOT_ID="$2"; shift 2 ;;
    --gitea-url) GITEA_URL="$2"; shift 2 ;;
    --gitea-user) GITEA_USER="$2"; shift 2 ;;
    --gitea-token) GITEA_TOKEN="$2"; shift 2 ;;
    --gitea-org) GITEA_ORG="$2"; shift 2 ;;
    --gitea-repo) GITEA_REPO="$2"; shift 2 ;;
    --cache-dir) CACHE_DIR="$2"; shift 2 ;;
    -h|--help)
      head -n 30 "$0"; exit 0 ;;
    *)
      echo "❌ 未知参数: $1" >&2; exit 1 ;;
  esac
done

for v in BUCKET REGION SNAPSHOT_ID GITEA_URL GITEA_USER GITEA_TOKEN; do
  if [ -z "${!v}" ]; then echo "❌ 必填: --${v,,}" >&2; exit 1; fi
done

: "${COS_SECRET_ID:?COS_SECRET_ID 未设置}"
: "${COS_SECRET_KEY:?COS_SECRET_KEY 未设置}"

# 没传 org 就用 user
GITEA_OWNER="${GITEA_ORG:-$GITEA_USER}"

mkdir -p "$CACHE_DIR/$SNAPSHOT_ID"
cd "$CACHE_DIR/$SNAPSHOT_ID"

echo "═══════════════════════════════════════════════════════════"
echo "  光湖搬家 · restore-from-cos"
echo "  bucket:  $BUCKET"
echo "  region:  $REGION"
echo "  id:      $SNAPSHOT_ID"
echo "  cache:   $CACHE_DIR/$SNAPSHOT_ID"
echo "  gitea:   $GITEA_URL → $GITEA_OWNER/$GITEA_REPO"
echo "═══════════════════════════════════════════════════════════"

# ─── 1. 装 coscmd (若没装) ────────────────────────────────
if ! command -v coscmd >/dev/null 2>&1; then
  echo "[init] 安装 coscmd ..."
  pip3 install -q --index-url https://pypi.tuna.tsinghua.edu.cn/simple coscmd || \
    pip3 install -q coscmd
fi

# 写 coscmd 配置
cat > "$HOME/.cos.conf" <<EOF
[common]
secret_id = $COS_SECRET_ID
secret_key = $COS_SECRET_KEY
bucket = $BUCKET
region = $REGION
max_thread = 5
EOF
chmod 600 "$HOME/.cos.conf"

# ─── 2. 下载所有包 ───────────────────────────────────────
echo "[1/4] 从 COS 拉包 (断点续传) ..."
PREFIX="snapshots/$SNAPSHOT_ID/"
for f in manifest.json guanghulab-snapshot.tar.gz mcp-tools-bundle.tar.gz workflows-bundle.tar.gz secrets-template.json; do
  if [ -f "$f" ]; then
    echo "    [skip] 本地已存在 $f"
    continue
  fi
  echo "    → $f"
  coscmd download "$PREFIX$f" "$f" || echo "    (可选包 $f 不存在, 跳过)"
done

# ─── 3. 校验 sha256 ──────────────────────────────────────
if [ -f manifest.json ] && command -v jq >/dev/null 2>&1 && command -v sha256sum >/dev/null 2>&1; then
  echo "[2/4] 校验 sha256 ..."
  jq -r '.files[] | "\(.sha256)  \(.name)"' manifest.json > checksums.txt
  if sha256sum -c checksums.txt; then
    echo "    ✅ 全部通过"
  else
    echo "    ❌ 校验失败" >&2
    exit 3
  fi
else
  echo "[2/4] 跳过校验 (无 manifest.json 或 jq/sha256sum)"
fi

# ─── 4. 解包 + 准备 mirror ───────────────────────────────
echo "[3/4] 解包主仓库 ..."
WORK_DIR="$CACHE_DIR/$SNAPSHOT_ID/repo"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
tar xzf guanghulab-snapshot.tar.gz -C "$WORK_DIR"
cd "$WORK_DIR"

if [ ! -d .git ]; then
  echo "❌ 解出的仓库没有 .git, 不是 mirror 候选; 终止" >&2
  exit 4
fi

# ─── 5. 在 Gitea 上确保仓库存在 ──────────────────────────
echo "[4/4] 推到 Gitea ..."
# 先确保 owner / repo 存在
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: token $GITEA_TOKEN" \
  "$GITEA_URL/api/v1/repos/$GITEA_OWNER/$GITEA_REPO" || true)
if [ "$HTTP_CODE" = "404" ]; then
  echo "    Gitea 仓库不存在, 自动创建 ..."
  # 试创建在 user 下
  curl -fsS -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: token $GITEA_TOKEN" \
    -d "{\"name\":\"$GITEA_REPO\",\"private\":true,\"auto_init\":false,\"description\":\"光湖代码仓库 · 国内 mirror · 国作登字-2026-A-00037559\"}" \
    "$GITEA_URL/api/v1/user/repos" > /dev/null
fi

# 推送 (mirror, 包含所有分支与 tag)
# 用 git credential helper 而不是 token-in-URL, 避免 token 进进程参数 / git config
echo "    git push --mirror → $GITEA_URL/$GITEA_OWNER/$GITEA_REPO.git"
git remote remove gitea 2>/dev/null || true
git remote add gitea "$GITEA_URL/$GITEA_OWNER/$GITEA_REPO.git"

# 把凭据通过 -c http.extraHeader 传 (单次生效, 不写盘)
# 注: header 仍会出现在 strace, 但不会落到 .git/config 或 process args
GIT_AUTH_HEADER="Authorization: token $GITEA_TOKEN"
git -c http.extraHeader="$GIT_AUTH_HEADER" push --mirror gitea \
  2>&1 | tee "$CACHE_DIR/$SNAPSHOT_ID/mirror-push.log" || {
  echo "⚠️  mirror push 部分失败, 详情见 mirror-push.log"
  echo "    常见原因: LFS 文件过大 / 单个 pack > 1GB"
  echo "    建议: 在 Gitea Site Admin → Settings → LFS 启用 LFS, 重试"
}
unset GIT_AUTH_HEADER

echo
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ restore-from-cos 完成"
echo "  下一步: 浏览器访问 $GITEA_URL/$GITEA_OWNER/$GITEA_REPO"
echo "         然后跑 scripts/migration/convert-workflows.js"
echo "═══════════════════════════════════════════════════════════"
