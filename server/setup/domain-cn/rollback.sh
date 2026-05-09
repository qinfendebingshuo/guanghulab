#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# 国内域名机 · 真正的版本回滚 · rollback.sh
# Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
# 守护: 铸渊 · ICE-GL-ZY001
# ════════════════════════════════════════════════════════════════
#
# 与 bootstrap.sh 配套. bootstrap 在每次 update 之前会把当前
# nginx 配置 + .env.tune + portal systemd unit 打包成快照存进
# $DATA_ROOT/snapshots/<TS>-pre-<stage>/. 这里负责把它恢复回去.
#
# 用法:
#   bash rollback.sh             # 回到上一个快照 (默认)
#   bash rollback.sh --list      # 列出所有可用快照
#   bash rollback.sh --to <TS>   # 回到指定快照
#
# 设计理念 (cc-004 强制自主):
#   - 数据 (portal 代码 / forgejo repo) **不动**, 只回滚配置层
#     (nginx sites-available / .env.tune / systemd unit)
#   - 自动 reload nginx + 健康检查
#   - 写出回执到 _logs/rollback-*.json + 追加 deploy-report.md
# ════════════════════════════════════════════════════════════════

set -euo pipefail

DATA_ROOT="${DATA_ROOT:-/data/guanghulab}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/guanghulab}"
DOMAIN="${DOMAIN:-guanghulab.com}"
SNAP_ROOT="$DATA_ROOT/snapshots"

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
    echo "(还没有快照. bootstrap.sh 在每次跑之前会自动建.)"
    return
  fi
  printf '%-32s %-12s %s\n' "快照时间戳" "大小" "备注"
  printf '%-32s %-12s %s\n' "--------------------------------" "------------" "------------------"
  for d in $(ls -1tr "$SNAP_ROOT"); do
    SZ="$(du -sh "$SNAP_ROOT/$d" 2>/dev/null | awk '{print $1}')"
    NOTE="$(cat "$SNAP_ROOT/$d/NOTE" 2>/dev/null || echo '-')"
    printf '%-32s %-12s %s\n' "$d" "$SZ" "$NOTE"
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
  echo "❌ 没有可用快照. 请先用 bootstrap.sh 跑一次 (会自动建快照)" >&2
  echo "   或: bash rollback.sh --list" >&2
  exit 1
fi

SNAP_DIR="$SNAP_ROOT/$TARGET_TS"
echo "═══════════════════════════════════════════════════════════"
echo "  [rollback · domain-cn] 准备回滚"
echo "═══════════════════════════════════════════════════════════"
echo "  目标快照: $TARGET_TS"
echo "  快照路径: $SNAP_DIR"
echo "  备注:     $(cat "$SNAP_DIR/NOTE" 2>/dev/null || echo '-')"
echo "─────────────────────────────────────────────────────────"

# ─── 1. 当前态再存一份 (回滚也要可逆) ─────────────────────────
NOW_TS="$(date +%Y%m%d-%H%M%S)"
PRE_ROLLBACK="$SNAP_ROOT/$NOW_TS-pre-rollback"
mkdir -p "$PRE_ROLLBACK/nginx" "$PRE_ROLLBACK/systemd"
[ -d /etc/nginx/sites-available ] && cp -a /etc/nginx/sites-available "$PRE_ROLLBACK/nginx/" || true
[ -d /etc/nginx/sites-enabled ]   && cp -a /etc/nginx/sites-enabled   "$PRE_ROLLBACK/nginx/" || true
[ -f "$DATA_ROOT/.env.tune" ]     && cp -a "$DATA_ROOT/.env.tune"     "$PRE_ROLLBACK/" || true
[ -f /etc/systemd/system/guanghulab-portal.service ] && \
  cp -a /etc/systemd/system/guanghulab-portal.service "$PRE_ROLLBACK/systemd/" || true
echo "preserved before rollback to $TARGET_TS" > "$PRE_ROLLBACK/NOTE"
echo "  [1/4] 当前态已保存到 $PRE_ROLLBACK"

# ─── 2. 恢复 nginx 配置 ───────────────────────────────────────
if [ -d "$SNAP_DIR/nginx/sites-available" ]; then
  echo "  [2/4] 恢复 nginx sites-available ..."
  # 先清掉新装的 (避免残留), 再 cp 回快照里的
  if [ -d /etc/nginx/sites-available ]; then
    find /etc/nginx/sites-available -type f -delete
  fi
  cp -a "$SNAP_DIR/nginx/sites-available/." /etc/nginx/sites-available/ || true
fi
if [ -d "$SNAP_DIR/nginx/sites-enabled" ]; then
  # sites-enabled 通常是软链, 重建即可
  if [ -d /etc/nginx/sites-enabled ]; then
    find /etc/nginx/sites-enabled -mindepth 1 -delete
  fi
  cp -a "$SNAP_DIR/nginx/sites-enabled/." /etc/nginx/sites-enabled/ || true
fi

# ─── 3. 恢复 .env.tune + systemd unit ─────────────────────────
echo "  [3/4] 恢复配置 ..."
if [ -f "$SNAP_DIR/.env.tune" ]; then
  mkdir -p "$DATA_ROOT"
  cp -a "$SNAP_DIR/.env.tune" "$DATA_ROOT/.env.tune"
  echo "         ↳ .env.tune"
elif [ -f "$DATA_ROOT/.env.tune" ]; then
  # 快照里没有 .env.tune (旧机器无此文件), 删除当前的 (回到"无"状态)
  rm -f "$DATA_ROOT/.env.tune"
fi

if [ -f "$SNAP_DIR/systemd/guanghulab-portal.service" ]; then
  cp -a "$SNAP_DIR/systemd/guanghulab-portal.service" /etc/systemd/system/guanghulab-portal.service
  systemctl daemon-reload
  echo "         ↳ guanghulab-portal.service"
elif [ -f /etc/systemd/system/guanghulab-portal.service ]; then
  rm -f /etc/systemd/system/guanghulab-portal.service
  systemctl daemon-reload
fi

# ─── 4. reload nginx + 健康检查 ──────────────────────────────
echo "  [4/4] reload nginx + 健康检查 ..."
HEALTH_OK="false"
if nginx -t >/dev/null 2>&1; then
  systemctl reload nginx >/dev/null 2>&1 || systemctl restart nginx >/dev/null 2>&1 || true
  # 80 端口 ping 一下 (HTTPS 需证书可能不在, 用 HTTP)
  for i in $(seq 1 15); do
    if curl -fs --max-time 3 "http://127.0.0.1/" >/dev/null 2>&1 \
       || curl -fs --max-time 3 -k "https://127.0.0.1/" >/dev/null 2>&1 ; then
      HEALTH_OK="true"
      break
    fi
    sleep 1
  done
  # nginx 至少能响应 (即使是 default 404), 也算 OK
  if [ "$HEALTH_OK" = "false" ]; then
    if systemctl is-active nginx >/dev/null 2>&1; then
      HEALTH_OK="degraded"
    fi
  fi
else
  echo "         ⚠️  nginx 配置语法错, 不 reload (旧的还在跑)"
fi

# ─── 回执 ─────────────────────────────────────────────────────
RECEIPT="$DEPLOY_ROOT/_logs/rollback-$NOW_TS.json"
cat > "$RECEIPT" <<EOF
{
  "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
  "_purpose": "domain-cn rollback receipt",
  "rolled_back_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "from_state_saved_to": "$PRE_ROLLBACK",
  "restored_snapshot": "$TARGET_TS",
  "snapshot_path": "$SNAP_DIR",
  "post_health": "$HEALTH_OK"
}
EOF

# 中文回执补一段进 deploy-report.md
DEPLOY_REPORT="$DEPLOY_ROOT/_logs/deploy-report.md"
{
  echo ""
  echo "## ↩️ 回滚 @ $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo ""
  echo "- 目标快照: \`$TARGET_TS\`"
  echo "- 当前态已保存: \`$PRE_ROLLBACK\`"
  echo "- 健康检查: $HEALTH_OK"
  echo "- 回执: \`$RECEIPT\`"
} >> "$DEPLOY_REPORT" 2>/dev/null || true

echo "═══════════════════════════════════════════════════════════"
case "$HEALTH_OK" in
  true)     echo "  [OK] 回滚到 $TARGET_TS 完成 · nginx 健康响应" ;;
  degraded) echo "  [OK-DEGRADED] 已回滚 · nginx 在跑但 / 路由没配 (正常: portal 占位还没起)" ;;
  *)        echo "  [WARN] 已恢复配置, 但 nginx 健康检查未通过, 查 journalctl -u nginx" ;;
esac
echo "  回执: $RECEIPT"
echo "═══════════════════════════════════════════════════════════"

# degraded 也算成功 (域名机一开始没 portal 业务, 是预期的)
if [ "$HEALTH_OK" = "false" ]; then
  exit 1
fi
exit 0
