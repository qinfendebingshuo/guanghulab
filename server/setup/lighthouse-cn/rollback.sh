#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 国内灯塔 · 真正的版本回滚 · rollback.sh
# Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 与 bootstrap.sh 配套. bootstrap 在每次 update 之前会把当前
# compose / .env / app.ini / nginx.conf 打包成一个快照存进
# $DATA_ROOT/lighthouse/snapshots/<TS>/. 这里负责把它恢复回去.
#
# 用法:
#   bash rollback.sh             # 回滚到上一个快照 (默认)
#   bash rollback.sh --list      # 列出所有可用快照
#   bash rollback.sh --to <TS>   # 回滚到指定快照
#
# 设计理念:
#   - 数据盘 (Gitea repo / Postgres / Redis) **不动**, 只回滚配置
#     和 compose 编排; 这样数据安全, 行为可逆
#   - 自动停 compose → 还原配置 → docker compose up -d → 健康检查
#   - 写出回执到 _logs/rollback-*.json
# ════════════════════════════════════════════════════════════════

set -euo pipefail

DATA_ROOT="${DATA_ROOT:-/data}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/guanghu}"
SNAP_ROOT="$DATA_ROOT/lighthouse/snapshots"
COMPOSE_DIR="$DATA_ROOT/lighthouse"

mkdir -p "$SNAP_ROOT" "$DEPLOY_ROOT/_logs"

ACTION="rollback"
TARGET_TS=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --list)  ACTION="list"; shift ;;
    --to)    TARGET_TS="$2"; shift 2 ;;
    -h|--help)
      sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

# ─── 列出快照 ─────────────────────────────────────────────────
list_snapshots() {
  if [ ! -d "$SNAP_ROOT" ] || [ -z "$(ls -A "$SNAP_ROOT" 2>/dev/null)" ]; then
    echo "(还没有快照. bootstrap.sh 在 update 之前会自动建.)"
    return
  fi
  printf '%-22s %-12s %s\n' "快照时间戳" "大小" "备注"
  printf '%-22s %-12s %s\n' "----------------------" "------------" "------------------"
  for d in $(ls -1tr "$SNAP_ROOT"); do
    SZ="$(du -sh "$SNAP_ROOT/$d" 2>/dev/null | awk '{print $1}')"
    NOTE="$(cat "$SNAP_ROOT/$d/NOTE" 2>/dev/null || echo '-')"
    printf '%-22s %-12s %s\n' "$d" "$SZ" "$NOTE"
  done
}

if [ "$ACTION" = "list" ]; then
  list_snapshots
  exit 0
fi

# ─── 选目标快照 ───────────────────────────────────────────────
if [ -z "$TARGET_TS" ]; then
  TARGET_TS="$(ls -1 "$SNAP_ROOT" 2>/dev/null | sort | tail -1 || true)"
fi

if [ -z "$TARGET_TS" ] || [ ! -d "$SNAP_ROOT/$TARGET_TS" ]; then
  echo "❌ 没有可用快照. 请先用 bootstrap.sh 跑一次 update (会自动建快照)" >&2
  echo "   或: bash rollback.sh --list" >&2
  exit 1
fi

SNAP_DIR="$SNAP_ROOT/$TARGET_TS"
echo "═══════════════════════════════════════════════════════════"
echo "  [rollback] 准备回滚"
echo "═══════════════════════════════════════════════════════════"
echo "  目标快照: $TARGET_TS"
echo "  快照路径: $SNAP_DIR"
echo "  备注:     $(cat "$SNAP_DIR/NOTE" 2>/dev/null || echo '-')"
echo "─────────────────────────────────────────────────────────"

# ─── 1. 停现役 compose ─────────────────────────────────────────
if [ -f "$COMPOSE_DIR/docker-compose.yml" ]; then
  echo "  [1/4] 停现役 compose..."
  ( cd "$COMPOSE_DIR" && docker compose down ) || true
fi

# ─── 2. 当前态再存一份 (rollback 也要有快照可回溯) ─────────────
NOW_TS="$(date +%Y%m%d-%H%M%S)"
PRE_ROLLBACK="$SNAP_ROOT/$NOW_TS-pre-rollback"
mkdir -p "$PRE_ROLLBACK"
for f in docker-compose.yml .env .env.tune; do
  [ -f "$COMPOSE_DIR/$f" ] && cp -a "$COMPOSE_DIR/$f" "$PRE_ROLLBACK/" || true
done
[ -f "$COMPOSE_DIR/gitea/conf/app.ini" ] && {
  mkdir -p "$PRE_ROLLBACK/gitea/conf"
  cp -a "$COMPOSE_DIR/gitea/conf/app.ini" "$PRE_ROLLBACK/gitea/conf/" || true
}
echo "preserved before rollback to $TARGET_TS" > "$PRE_ROLLBACK/NOTE"
echo "  [2/4] 当前态已保存到 $PRE_ROLLBACK"

# ─── 3. 恢复快照 ──────────────────────────────────────────────
echo "  [3/4] 恢复快照文件..."
for f in docker-compose.yml .env .env.tune; do
  if [ -f "$SNAP_DIR/$f" ]; then
    cp -a "$SNAP_DIR/$f" "$COMPOSE_DIR/$f"
    echo "         ↳ $f"
  fi
done
if [ -f "$SNAP_DIR/gitea/conf/app.ini" ]; then
  mkdir -p "$COMPOSE_DIR/gitea/conf"
  cp -a "$SNAP_DIR/gitea/conf/app.ini" "$COMPOSE_DIR/gitea/conf/app.ini"
  echo "         ↳ gitea/conf/app.ini"
fi

# ─── 4. 起服 + 健康检查 ───────────────────────────────────────
echo "  [4/4] 启动恢复后的 compose..."
( cd "$COMPOSE_DIR" && docker compose up -d )

HEALTH_OK="false"
GITEA_PORT="${GITEA_HTTP_PORT:-3000}"
for i in $(seq 1 30); do
  if curl -fs "http://127.0.0.1:$GITEA_PORT/api/v1/version" >/dev/null 2>&1; then
    HEALTH_OK="true"
    break
  fi
  sleep 2
done

# ─── 回执 ─────────────────────────────────────────────────────
RECEIPT="$DEPLOY_ROOT/_logs/rollback-$NOW_TS.json"
cat > "$RECEIPT" <<EOF
{
  "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
  "rolled_back_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "from_state_saved_to": "$PRE_ROLLBACK",
  "restored_snapshot": "$TARGET_TS",
  "snapshot_path": "$SNAP_DIR",
  "post_health_ok": $HEALTH_OK
}
EOF

echo "═══════════════════════════════════════════════════════════"
if [ "$HEALTH_OK" = "true" ]; then
  echo "  [OK] 回滚到 $TARGET_TS 完成 · Gitea 健康"
else
  echo "  [WARN] 已恢复配置, 但 Gitea 健康检查未通过 (60s)"
  echo "         查 docker logs lighthouse-gitea --tail 100"
fi
echo "  回执: $RECEIPT"
echo "═══════════════════════════════════════════════════════════"

[ "$HEALTH_OK" = "true" ] || exit 1
