#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
# 📜 Copyright: 国作登字-2026-A-00037559
# ═══════════════════════════════════════════════
# deploy-pending-workflows.sh
# 指令: SY-CMD-WFFIX-006
#
# 功能: 通过 GitHub API 将 brain/pending-workflows/ 中的
#        workflow 文件部署到 .github/workflows/
#
# 使用方法:
#   export GITHUB_TOKEN=<your-token>
#   bash scripts/deploy-pending-workflows.sh [--dry-run]
#
# 前置条件:
#   - GITHUB_TOKEN 环境变量已设置（需要 repo 权限）
#   - 已安装 gh CLI 或 curl
#   - 从仓库根目录运行

set -euo pipefail

REPO="qinfendebingshuo/guanghulab"
MANIFEST="brain/pending-workflows/manifest.json"
DRY_RUN=false
BRANCH="main"

# 解析参数
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --branch=*) BRANCH="${arg#*=}" ;;
  esac
done

echo "═══════════════════════════════════════════════"
echo "🔧 铸渊 · Workflow 部署工具"
echo "📜 Copyright: 国作登字-2026-A-00037559"
echo "═══════════════════════════════════════════════"
echo ""

# 检查 token
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "❌ GITHUB_TOKEN 未设置"
  echo "用法: export GITHUB_TOKEN=<your-token>"
  exit 1
fi

# 检查 manifest
if [ ! -f "$MANIFEST" ]; then
  echo "❌ 未找到 $MANIFEST"
  exit 1
fi

echo "📋 读取 manifest..."
echo ""

# 使用 Node.js 解析 manifest 并执行部署
node -e "
const fs = require('fs');
const { execSync } = require('child_process');

const manifest = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
const dryRun = '$DRY_RUN' === 'true';
const branch = '$BRANCH';

console.log('📦 待部署 workflow:', manifest.pending_workflows.length);
console.log('🎯 目标分支:', branch);
console.log('🏃 试运行:', dryRun ? '是' : '否');
console.log('');

const order = manifest.deploy_order || manifest.pending_workflows.map(w => w.filename);
let deployed = 0;
let failed = 0;

for (const filename of order) {
  const entry = manifest.pending_workflows.find(w => w.filename === filename);
  if (!entry) {
    console.log('⏭️  跳过:', filename, '(不在 manifest 中)');
    continue;
  }

  const srcPath = 'brain/pending-workflows/' + entry.filename;
  const targetPath = entry.target;

  // 安全检查
  if (!targetPath.startsWith('.github/workflows/')) {
    console.log('🚫 阻止:', filename, '(目标路径不合法:', targetPath, ')');
    failed++;
    continue;
  }

  if (!fs.existsSync(srcPath)) {
    console.log('⏭️  跳过:', filename, '(源文件不存在)');
    continue;
  }

  console.log('📤 部署:', filename, '→', targetPath);

  if (dryRun) {
    console.log('   [试运行] 跳过实际部署');
    continue;
  }

  try {
    const content = fs.readFileSync(srcPath, 'utf8');
    const contentBase64 = Buffer.from(content).toString('base64');

    // 获取文件当前 SHA（如果存在）
    let sha = '';
    try {
      const result = execSync(
        'gh api repos/' + process.env.REPO || '$REPO' + '/contents/' + targetPath + ' --jq .sha 2>/dev/null',
        { encoding: 'utf8', env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN } }
      ).trim();
      sha = result;
    } catch (e) {
      // 文件不存在，正常
    }

    // 通过 GitHub API 创建/更新文件
    const apiData = {
      message: '🔧 [WFFIX-006] 部署 ' + filename + ' · GH006 修复 · git push → PR 模式',
      content: contentBase64,
      branch: branch
    };
    if (sha) {
      apiData.sha = sha;
    }

    const tmpFile = '/tmp/gh-api-body-' + filename.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
    fs.writeFileSync(tmpFile, JSON.stringify(apiData));

    execSync(
      'gh api repos/$REPO/contents/' + targetPath + ' -X PUT --input ' + tmpFile,
      { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN } }
    );

    console.log('   ✅ 已部署');
    deployed++;
    fs.unlinkSync(tmpFile);
  } catch (e) {
    console.error('   ❌ 部署失败:', e.message);
    failed++;
  }
}

console.log('');
console.log('═══════════════════════════════════════════════');
console.log('📊 部署结果: ✅', deployed, '成功 · ❌', failed, '失败');
console.log('═══════════════════════════════════════════════');

if (!dryRun && deployed > 0) {
  manifest.status = 'deployed';
  manifest.deployed_at = new Date().toISOString();
  manifest.deployed_by = 'deploy-pending-workflows.sh';
  fs.writeFileSync('$MANIFEST', JSON.stringify(manifest, null, 2) + '\n');
  console.log('📋 Manifest 状态已更新为 deployed');
}
" 2>&1

echo ""
echo "✅ 部署完成"
