#!/bin/bash
# M-BRIDGE-AUTO · syslog_receiver.sh
# 全链路桥接自动化 · SYSLOG接收脚本
# 开发者：DEV-010 桔子
# 人格体：PER-CX001 晨星
# 功能：接收SYSLOG，验证格式，写入inbox
# 版本：v1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置路径
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/bridge_config.json"
INBOX_DIR="$SCRIPT_DIR/inbox"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/receiver_$(date +%Y%m%d).log"

# 日志函数
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" >> "$LOG_FILE"
    echo -e "${BLUE}[$timestamp]${NC} $1"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $1" >> "$LOG_FILE"
    echo -e "${RED}[$timestamp] ERROR: $1${NC}"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] SUCCESS: $1" >> "$LOG_FILE"
    echo -e "${GREEN}[$timestamp] ✅ $1${NC}"
}

# 确保目录存在
mkdir -p "$INBOX_DIR" "$LOG_DIR"

log "========== SYSLOG Receiver 启动 =========="

# 读取SYSLOG内容（从标准输入）
SYSLOG_CONTENT=$(cat)

if [ -z "$SYSLOG_CONTENT" ]; then
    log_error "没有接收到SYSLOG内容"
    exit 1
fi

log "收到SYSLOG，开始处理..."

# 验证JSON格式
if ! echo "$SYSLOG_CONTENT" | python3 -m json.tool > /dev/null 2>&1; then
    log_error "JSON格式无效"
    exit 1
fi

log "JSON格式验证通过"

# 提取关键字段
BROADCAST_ID=$(echo "$SYSLOG_CONTENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('header', {}).get('broadcast_id', 'UNKNOWN'))
")

DEV_ID=$(echo "$SYSLOG_CONTENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('header', {}).get('dev_id', 'UNKNOWN'))
")

PERSONA_ID=$(echo "$SYSLOG_CONTENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('header', {}).get('persona_id', 'UNKNOWN'))
")

DEV_NAME=$(echo "$SYSLOG_CONTENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('header', {}).get('dev_name', 'UNKNOWN'))
")

log "广播编号：$BROADCAST_ID"
log "开发者：$DEV_ID $DEV_NAME"
log "人格体：$PERSONA_ID"

# 验证必要字段
if [ "$BROADCAST_ID" = "UNKNOWN" ] || [ "$DEV_ID" = "UNKNOWN" ]; then
    log_error "缺少必要字段：broadcast_id 或 dev_id"
    exit 1
fi

log "必要字段验证通过"

# 生成文件名并写入inbox
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="syslog_${DEV_ID}_${BROADCAST_ID}_${TIMESTAMP}.json"
OUTPUT_PATH="$INBOX_DIR/$FILENAME"

echo "$SYSLOG_CONTENT" | python3 -m json.tool > "$OUTPUT_PATH"

log_success "SYSLOG已写入inbox: $FILENAME"
log "文件路径: $OUTPUT_PATH"
log "文件大小: $(wc -c < "$OUTPUT_PATH") bytes"

# 输出摘要
echo ""
echo -e "${GREEN}— SYSLOG 接收摘要 —${NC}"
echo -e "广播编号: ${YELLOW}$BROADCAST_ID${NC}"
echo -e "开发者:   ${YELLOW}$DEV_ID ($DEV_NAME)${NC}"
echo -e "人格体:   ${YELLOW}$PERSONA_ID${NC}"
echo -e "存储位置: ${BLUE}$OUTPUT_PATH${NC}"
echo -e "${GREEN}—${NC}"

log "========== SYSLOG Receiver 完成 =========="
