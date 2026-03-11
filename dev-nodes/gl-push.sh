#!/bin/bash
# gl-push.sh — 光湖智能上传脚本 · 三层网络降级方案
# 用法: bash gl-push.sh "提交信息"
# 要求: git 已配置，PAT token 已通过 git config credential.helper store 存储

set -euo pipefail

REPO_URL="https://github.com/qinfendebingshuo/guanghulab.git"
PROXY_URL="https://ghproxy.com/https://github.com/qinfendebingshuo/guanghulab.git"
MSG="${1:-"📤 开发者上传 $(date +%Y-%m-%dT%H:%M)"}"

echo "🐙 光湖代码上传中..."
git add .
git commit -m "$MSG" 2>/dev/null || echo "  ℹ️  无新提交，直接推送"

# ── 层级1：直连 HTTPS ──────────────────────────────────────────────────────
echo "🔗 [层级1] 尝试直连 GitHub..."
if git push origin main 2>/dev/null; then
  echo "✅ 直连上传成功！铸渊已接收。"
  exit 0
fi

# ── 层级2：ghproxy 镜像加速 ───────────────────────────────────────────────
echo "⚠️  直连失败，切换镜像通道..."
git remote set-url origin "$PROXY_URL"
if git push origin main 2>/dev/null; then
  echo "✅ 镜像通道上传成功！铸渊已接收。"
  git remote set-url origin "$REPO_URL"
  exit 0
fi
git remote set-url origin "$REPO_URL"

# ── 层级3：SSH ────────────────────────────────────────────────────────────
echo "⚠️  镜像也失败，尝试 SSH 通道..."
SSH_URL="git@github.com:qinfendebingshuo/guanghulab.git"
git remote set-url origin "$SSH_URL"
if git push origin main; then
  echo "✅ SSH 通道上传成功！铸渊已接收。"
  git remote set-url origin "$REPO_URL"
  exit 0
fi
git remote set-url origin "$REPO_URL"

# ── 全部失败 ──────────────────────────────────────────────────────────────
echo "❌ 三层网络均不通，请联系知秋处理。"
echo "   可尝试手动命令: git push git@github.com:qinfendebingshuo/guanghulab.git main"
exit 1
