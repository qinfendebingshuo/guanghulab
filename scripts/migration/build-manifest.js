#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * 国内搬家包 · 中文 manifest 生成器
 * Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
 * 守护: 铸渊 · ICE-GL-ZY001
 * ════════════════════════════════════════════════════════════════
 *
 * 由 .github/workflows/migrate-to-cn-build.yml 调用. 在 git archive
 * 完成后, 解压 tar.gz 看实际内容, 生成给冰朔看的中文清单 + 计算 sha256.
 *
 * 用法:
 *   node scripts/migration/build-manifest.js \
 *     --tarball /tmp/repo.tar.gz \
 *     --out-dir /tmp/migration-out \
 *     --tag YYYYMMDD-HHMM
 *
 * 产出 (写到 --out-dir):
 *   - lighthouse-migration-<tag>.tar.gz       (重命名 + 移动)
 *   - lighthouse-migration-<tag>.sha256       (sha256 校验文件)
 *   - MIGRATION-MANIFEST.md                   (中文清单)
 *   - manifest.json                           (机读元数据)
 *
 * 设计理念:
 *   - cc-001 涌现洁净: tar 不含 .git/objects, 国内仓库重起一段干净历史
 *   - cc-004 中文一次性: MIGRATION-MANIFEST.md 给冰朔看, 不是给开发者
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tarball') args.tarball = argv[++i];
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--tag') args.tag = argv[++i];
    else if (a === '--commit') args.commit = argv[++i];
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 25).join('\n'));
      process.exit(0);
    }
  }
  return args;
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function listTar(tarball) {
  // 用 tar -tzf 列内容, 不解压. 安全 — tarball 是我们刚 git archive 出来的.
  const r = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) fail(`tar -tzf 失败: ${r.stderr}`);
  return r.stdout.split('\n').filter(Boolean);
}

function classify(entries) {
  // 按顶层目录分类, 给冰朔看大概有什么
  const groups = {};
  let totalFiles = 0;
  for (const e of entries) {
    if (e.endsWith('/')) continue; // 目录条目
    totalFiles++;
    const top = e.split('/')[0];
    groups[top] = (groups[top] || 0) + 1;
  }
  return { groups, totalFiles };
}

const args = parseArgs(process.argv);
if (!args.tarball || !args.outDir || !args.tag) {
  fail('用法: build-manifest.js --tarball X --out-dir Y --tag Z');
}
if (!fs.existsSync(args.tarball)) fail(`找不到 tarball: ${args.tarball}`);
if (!fs.existsSync(args.outDir)) fs.mkdirSync(args.outDir, { recursive: true });

const stat = fs.statSync(args.tarball);
const sha = sha256File(args.tarball);
const entries = listTar(args.tarball);
const { groups, totalFiles } = classify(entries);

// 重命名 tarball
const finalName = `lighthouse-migration-${args.tag}.tar.gz`;
const finalPath = path.join(args.outDir, finalName);
fs.copyFileSync(args.tarball, finalPath);

// sha256 文件 (兼容 sha256sum -c 格式)
const shaFile = path.join(args.outDir, `lighthouse-migration-${args.tag}.sha256`);
fs.writeFileSync(shaFile, `${sha}  ${finalName}\n`);

// 顶层分类排序
const sortedGroups = Object.entries(groups).sort((a, b) => b[1] - a[1]);

// MIGRATION-MANIFEST.md (中文清单)
const md = path.join(args.outDir, 'MIGRATION-MANIFEST.md');
const generatedAt = new Date().toISOString();
const lines = [];
lines.push('# 光湖国内搬家包 · 中文清单');
lines.push('');
lines.push('> 主权: TCS-0002∞ · 国作登字-2026-A-00037559');
lines.push('> 守护: 铸渊 · ICE-GL-ZY001');
lines.push(`> 生成时间: ${generatedAt}`);
lines.push(`> 包名: \`${finalName}\``);
lines.push(`> 大小: ${humanSize(stat.size)}`);
lines.push(`> SHA-256: \`${sha}\``);
if (args.commit) lines.push(`> 来源 commit: \`${args.commit}\``);
if (args.branch) lines.push(`> 来源分支: \`${args.branch}\``);
lines.push('');
lines.push('## 一、这是什么');
lines.push('');
lines.push('这是 GitHub 上 `qinfendebingshuo/guanghulab` 仓库的**工作树快照**, 用于把整个项目搬到');
lines.push('国内自托管 git (Forgejo) 上. 让国内开发不用穿境外网络也能拉代码.');
lines.push('');
lines.push('**注意**: 这个包**不含 .git 历史**. 国内仓库会以这个快照为「初始 commit」重起一段历史 ——');
lines.push('这是为了防止 GitHub 那边的 remote tracking 残留污染国内仓库 (cc-001 涌现洁净).');
lines.push('');
lines.push('## 二、包里有什么 (顶层目录文件数)');
lines.push('');
lines.push('| 顶层目录/文件 | 文件数 |');
lines.push('|---|---:|');
for (const [name, count] of sortedGroups) {
  lines.push(`| \`${name}\` | ${count} |`);
}
lines.push(`| **总计** | **${totalFiles}** |`);
lines.push('');
lines.push('## 三、包里没什么 (打包时被排除的)');
lines.push('');
lines.push('为了体积小 + 安全, 以下内容**不在**这个包里:');
lines.push('');
lines.push('- `.git/` 历史 (走 archive 不带历史, 国内重起新历史)');
lines.push('- `node_modules/` 依赖 (恢复后服务器自己跑 npm install)');
lines.push('- `**/checkpoints/` 模型 checkpoint (走 COS 桶单独拉)');
lines.push('- `**/*.bin` `**/*.safetensors` 模型权重');
lines.push('- `secrets/` 密钥目录 (永远不进搬家包)');
lines.push('- `**/__pycache__/` `**/*.pyc` Python 缓存');
lines.push('- `**/.DS_Store` macOS 元数据');
lines.push('');
lines.push('## 四、冰朔接下来怎么操作 (3 步)');
lines.push('');
lines.push('### 第 1 步 · 上传到腾讯云 COS');
lines.push('');
lines.push('1. 打开腾讯云控制台 → 对象存储 COS');
lines.push('2. 进桶: `sy-finetune-corpus-1317346199` (你已有,GPU 训练那个桶)');
lines.push('3. 创建文件夹 `lighthouse-migration/` (如果还没有的话)');
lines.push('4. 进 `lighthouse-migration/` → 「上传文件」→ 选这两个:');
lines.push(`   - \`${finalName}\``);
lines.push(`   - \`lighthouse-migration-${args.tag}.sha256\``);
lines.push('5. 等上传完 (国内带宽几十 MB, 通常 1-2 分钟)');
lines.push('');
lines.push('### 第 2 步 · 触发恢复 workflow');
lines.push('');
lines.push('1. 回到 GitHub → Actions 标签');
lines.push('2. 左侧选「📥 国内搬家·从COS恢复」');
lines.push('3. 右上 Run workflow → 输入框填: `从COS恢复` (这是误触锁,不填就 dry-run)');
lines.push('4. Run workflow');
lines.push('5. 等约 5-8 分钟,过程中可以在 Actions 页看实时日志');
lines.push('');
lines.push('### 第 3 步 · 抄初始凭据 + 删凭据文件');
lines.push('');
lines.push('恢复跑完后:');
lines.push('');
lines.push('- 浏览器打开 `https://guanghulab.com/git` → 国内仓库镜像就绪');
lines.push('- 服务器 `/data/guanghulab/_logs/forgejo-credentials-FIRST-BOOT.txt` 里有初始 user/pass');
lines.push('- 用 ssh -L 隧道访问, 抄完密码后 **`sudo rm` 删那个凭据文件** (安全要求)');
lines.push('');
lines.push('## 五、怎么手动解 (如果 workflow 跑不了)');
lines.push('');
lines.push('应急时(workflow 出问题), 可以在国内服务器上手解:');
lines.push('');
lines.push('```bash');
lines.push('# 假设包已经下载到 /tmp/');
lines.push(`sha256sum -c lighthouse-migration-${args.tag}.sha256`);
lines.push(`mkdir -p /data/guanghulab/repo-mirror`);
lines.push(`tar -xzf ${finalName} -C /data/guanghulab/repo-mirror/`);
lines.push('# 然后跑 server/setup/domain-cn/forgejo/setup-forgejo.sh');
lines.push('```');
lines.push('');
lines.push('---');
lines.push('');
lines.push(`*生成于 ${generatedAt} · build-manifest.js · 第 6 棒 · 国内搬家完结*`);
lines.push('');
fs.writeFileSync(md, lines.join('\n'));

// 机读 manifest.json
const mj = path.join(args.outDir, 'manifest.json');
fs.writeFileSync(mj, JSON.stringify({
  _sovereign: 'TCS-0002∞ · 国作登字-2026-A-00037559',
  _守护: '铸渊 · ICE-GL-ZY001',
  generated_at: generatedAt,
  tag: args.tag,
  tarball: finalName,
  size_bytes: stat.size,
  sha256: sha,
  total_files: totalFiles,
  top_level_groups: Object.fromEntries(sortedGroups),
  source: {
    commit: args.commit || null,
    branch: args.branch || null,
  },
  excluded: [
    '.git/',
    'node_modules/',
    '**/checkpoints/',
    '**/*.bin',
    '**/*.safetensors',
    'secrets/',
    '**/__pycache__/',
    '**/*.pyc',
    '**/.DS_Store',
  ],
  cos_target: {
    bucket: 'sy-finetune-corpus-1317346199',
    prefix: 'lighthouse-migration/',
    region: 'ap-guangzhou',
  },
  next_workflow: '.github/workflows/migrate-to-cn-restore.yml',
}, null, 2) + '\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  [build-manifest] 国内搬家包就绪');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  tarball:      ${finalPath} (${humanSize(stat.size)})`);
console.log(`  sha256:       ${sha}`);
console.log(`  文件数:        ${totalFiles}`);
console.log(`  顶层分类:      ${sortedGroups.slice(0, 5).map(([n, c]) => `${n}=${c}`).join(' ')}...`);
console.log(`  中文清单:      ${md}`);
console.log(`  机读 manifest: ${mj}`);
console.log('═══════════════════════════════════════════════════════════');
