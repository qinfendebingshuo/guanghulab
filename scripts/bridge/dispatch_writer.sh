#!/bin/bash
# M-BRIDGE-AUTO · dispatch_writer.sh (极简稳定版)
# 功能：读取inbox中的SYSLOG，生成调度单到queue
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INBOX_DIR="$SCRIPT_DIR/inbox"
QUEUE_DIR="$SCRIPT_DIR/queue"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/dispatch_$(date +%Y%m%d).log"

mkdir -p "$QUEUE_DIR" "$ARCHIVE_DIR" "$LOG_DIR"

echo "========== Dispatch Writer 启动 ==========" >> "$LOG_FILE"

INBOX_FILES=$(ls "$INBOX_DIR"/syslog_*.json 2>/dev/null || true)

if [ -z "$INBOX_FILES" ]; then
    echo "inbox为空，没有待处理的SYSLOG"
    exit 0
fi

COUNT=0
for SYSLOG_FILE in $INBOX_FILES; do
    FILENAME=$(basename "$SYSLOG_FILE")
    echo "处理: $FILENAME" >> "$LOG_FILE"

    DISPATCH=$(python3 << PYEOF
import json, sys
from datetime import datetime

with open('$SYSLOG_FILE', 'r') as f:
    data = json.load(f)

header = data.get('header', {})
dispatch = {
    'dispatch_id': f"DISPATCH-{header.get('dev_id', 'UNK')}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
    'source_file': '$FILENAME',
    'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    'status': 'pending',
    'header': header,
    'execution_priority': data.get('execution_priority', []),
    'agent_backfill': data.get('agent_backfill', [])
}
print(json.dumps(dispatch, indent=2))
PYEOF
)

    DISPATCH_FILENAME="dispatch_$(date +%Y%m%d_%H%M%S)_${COUNT}.json"
    echo "$DISPATCH" > "$QUEUE_DIR/$DISPATCH_FILENAME"
    echo "调度单已生成：$DISPATCH_FILENAME" >> "$LOG_FILE"

    mv "$SYSLOG_FILE" "$ARCHIVE_DIR/"
    echo "已归档：$FILENAME" >> "$LOG_FILE"

    COUNT=$((COUNT + 1))
done

echo "处理数量：$COUNT 条SYSLOG"
echo "========== Dispatch Writer 完成 ==========" >> "$LOG_FILE"
