#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 光湖智库 · 数据备份脚本
# 项目编号: ZY-PROJ-006
# 守护:     铸渊 · ICE-GL-ZY001
# 版权:     国作登字-2026-A-00037559
# ═══════════════════════════════════════════════════════════

# 配置
DATA_DIR="/opt/zhiku/data"
BACKUP_DIR="/opt/zhiku/backups"
LOG_FILE="/var/log/zhiku/backup.log"
COS_BUCKET="$ZY_COS_BUCKET"
COS_REGION="ap-singapore"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
BACKUP_NAME="zhiku-data-$TIMESTAMP.tar.gz"

# 确保目录存在
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# 记录开始时间
echo "[$(date +"%Y-%m-%d %H:%M:%S")] 开始备份智库数据" >> "$LOG_FILE"

# 创建压缩包
if tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C "$DATA_DIR" .; then
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] 数据压缩成功: $BACKUP_NAME" >> "$LOG_FILE"
else
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] 错误: 数据压缩失败" >> "$LOG_FILE"
    exit 1
fi

# 上传到COS
if [ -n "$COS_BUCKET" ] && [ -n "$ZY_COS_SECRET_ID" ] && [ -n "$ZY_COS_SECRET_KEY" ]; then
    if ./coscli -c "$COS_REGION" cp "$BACKUP_DIR/$BACKUP_NAME" "cos://$COS_BUCKET/zhiku-backups/$BACKUP_NAME"; then
        echo "[$(date +"%Y-%m-%d %H:%M:%S")] 上传到COS成功: $BACKUP_NAME" >> "$LOG_FILE"
        # 删除本地备份以节省空间
        rm -f "$BACKUP_DIR/$BACKUP_NAME"
    else
        echo "[$(date +"%Y-%m-%d %H:%M:%S")] 错误: 上传到COS失败" >> "$LOG_FILE"
        exit 1
    fi
else
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] 警告: COS配置不完整，保留本地备份" >> "$LOG_FILE"
fi

echo "[$(date +"%Y-%m-%d %H:%M:%S")] 备份流程完成" >> "$LOG_FILE"