#!/bin/bash
# ═══════════════════════════════════════════════════════════
# COSCLI 安装脚本
# ═══════════════════════════════════════════════════════════

# 下载COSCLI
COSCLI_URL="https://github.com/tencentyun/coscli/releases/download/v0.13.0-beta/coscli-linux"
wget -O /usr/local/bin/coscli "$COSCLI_URL"
chmod +x /usr/local/bin/coscli

# 创建配置文件
mkdir -p /etc/coscli
echo "[base]
secretid = $ZY_COS_SECRET_ID
secretkey = $ZY_COS_SECRET_KEY
region = ap-singapore
" > /etc/coscli/config.yaml

chmod 600 /etc/coscli/config.yaml