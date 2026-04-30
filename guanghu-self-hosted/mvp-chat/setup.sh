#!/bin/bash
# ==========================================
# 光湖 MVP Chat · 交互式配置脚本
# 引导用户填写 .env 文件
# 工单: YD-A05-20260430-MVP
# ==========================================

set -e

echo ""
echo "🌊 光湖 MVP Chat · 环境配置向导"
echo "================================"
echo ""

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    echo "⚠️  .env 文件已存在"
    read -p "是否覆盖? (y/N): " OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        echo "已跳过 · 使用现有 .env"
        exit 0
    fi
fi

cp .env.template "$ENV_FILE"

echo "📋 请依次填写以下配置（按 Enter 使用默认值）:"
echo ""

# 百炼API
read -p "百炼API密钥 (DASHSCOPE_API_KEY): " DASHSCOPE_KEY
if [ -n "$DASHSCOPE_KEY" ]; then
    sed -i "s|^DASHSCOPE_API_KEY=.*|DASHSCOPE_API_KEY=$DASHSCOPE_KEY|" "$ENV_FILE"
fi

# Notion Token
read -p "系统Notion Token (ZY_NOTION_TOKEN): " NOTION_TOKEN
if [ -n "$NOTION_TOKEN" ]; then
    sed -i "s|^ZY_NOTION_TOKEN=.*|ZY_NOTION_TOKEN=$NOTION_TOKEN|" "$ENV_FILE"
fi

# 数据库密码
read -p "PostgreSQL密码 (DB_PASSWORD): " DB_PASS
if [ -n "$DB_PASS" ]; then
    sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASS|" "$ENV_FILE"
fi

# 可选: DeepSeek
read -p "DeepSeek API密钥 (可选，按Enter跳过): " DS_KEY
if [ -n "$DS_KEY" ]; then
    sed -i "s|^DEEPSEEK_API_KEY=.*|DEEPSEEK_API_KEY=$DS_KEY|" "$ENV_FILE"
fi

# 可选: Qwen
read -p "通义千问API密钥 (可选，按Enter跳过): " QWEN_KEY
if [ -n "$QWEN_KEY" ]; then
    sed -i "s|^QWEN_API_KEY=.*|QWEN_API_KEY=$QWEN_KEY|" "$ENV_FILE"
fi

echo ""
echo "✅ 配置完成! .env 文件已生成"
echo ""
echo "🚀 启动命令:"
echo "   docker-compose up -d"
echo ""
echo "🌐 访问地址:"
echo "   http://localhost:3000"
echo ""
echo "❤️  健康检查:"
echo "   http://localhost:3000/health"
echo ""
