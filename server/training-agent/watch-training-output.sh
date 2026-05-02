#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# 训练输出解析器 · watch-training-output.sh
# ═══════════════════════════════════════════════════════════
# 签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
#
# 把 train.py 的 stdout 流式解析，每识别到一行
#   ZY_PROGRESS step=N total=M loss=X lr=Y epoch=E total_epochs=TE
# 就调用 progress-reporter.sh 上报。
#
# 同时把所有原文透传到 stdout（保留训练日志）。
#
# 用法:
#   python train.py | watch-training-output.sh
# ═══════════════════════════════════════════════════════════

set -uo pipefail

ROOT="${ZY_TRAIN_ROOT:-/opt/guanghu/training}"
REPORTER="$ROOT/progress-reporter.sh"
ENV_FILE="$ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

REPORT_INTERVAL_STEPS="${ZY_REPORT_EVERY_STEPS:-10}"
LAST_REPORT_STEP=-1
START_TS=$(date -u +%s)

while IFS= read -r line; do
  # 透传
  printf '%s\n' "$line"

  # 只解析 ZY_PROGRESS 标记行
  if [[ "$line" != *"ZY_PROGRESS"* ]]; then
    continue
  fi

  # 提取 key=value
  STEP=$(echo "$line"  | grep -oE 'step=[0-9]+'   | head -1 | cut -d= -f2 || true)
  TOTAL=$(echo "$line" | grep -oE 'total=[0-9]+'  | head -1 | cut -d= -f2 || true)
  LOSS=$(echo "$line"  | grep -oE 'loss=[0-9.eE+\-]+' | head -1 | cut -d= -f2 || true)
  LR=$(echo "$line"    | grep -oE 'lr=[0-9.eE+\-]+'   | head -1 | cut -d= -f2 || true)
  EPOCH=$(echo "$line" | grep -oE 'epoch=[0-9]+' | head -1 | cut -d= -f2 || true)
  TE=$(echo "$line"    | grep -oE 'total_epochs=[0-9]+' | head -1 | cut -d= -f2 || true)
  THR=$(echo "$line"   | grep -oE 'thr=[0-9.eE+\-]+'   | head -1 | cut -d= -f2 || true)

  STEP=${STEP:-0}; TOTAL=${TOTAL:-0}; EPOCH=${EPOCH:-0}; TE=${TE:-0}
  LOSS=${LOSS:-null}; LR=${LR:-null}; THR=${THR:-null}

  # 节流：每 N 步上报一次（最后一步=训练完成必报；首步必报）
  IS_LAST=0
  if [[ "$TOTAL" -gt 0 && "$STEP" -ge "$TOTAL" ]]; then
    IS_LAST=1
  fi
  if (( IS_LAST == 0 )) && (( LAST_REPORT_STEP >= 0 )) && (( STEP - LAST_REPORT_STEP < REPORT_INTERVAL_STEPS )); then
    continue
  fi
  LAST_REPORT_STEP=$STEP

  NOW=$(date -u +%s)
  ELAPSED=$(( NOW - START_TS ))
  ETA="null"
  if [[ "$STEP" -gt 0 && "$TOTAL" -gt 0 && "$STEP" -lt "$TOTAL" ]]; then
    PER=$(awk "BEGIN{print $ELAPSED/$STEP}")
    LEFT=$(( TOTAL - STEP ))
    ETA=$(awk "BEGIN{printf \"%d\",$PER*$LEFT}")
  fi

  PROG=$(printf '{"step":%s,"total_steps":%s,"epoch":%s,"total_epochs":%s,"loss":%s,"learning_rate":%s,"throughput_samples_per_sec":%s,"eta_seconds":%s,"elapsed_seconds":%s}' \
    "$STEP" "$TOTAL" "$EPOCH" "$TE" "$LOSS" "$LR" "$THR" "$ETA" "$ELAPSED")

  LABEL="训练第 ${STEP}/${TOTAL} 步"
  MSG="step=${STEP}/${TOTAL} loss=${LOSS} lr=${LR}"

  "$REPORTER" "training" "$LABEL" "$PROG" "$MSG" >/dev/null 2>&1 || true
done

# 训练循环结束 → done
"$REPORTER" "done" "训练完成" "" "train.py exited cleanly on $(hostname)" || true
echo "done" > "$ROOT/.phase" 2>/dev/null || true
