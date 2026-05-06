#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
// 光湖搬家 · snapshot-to-cos
// Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
// 守护: 铸渊 · ICE-GL-ZY001
//
// 把当前仓库整体打包推到 COS, 供国内灯塔 restore-from-cos 拉回.
//
// 用法 (本地或 GitHub Actions 里跑):
//   node scripts/migration/snapshot-to-cos.js \
//     --bucket guanghulab-migration-1317346199 \
//     --region ap-guangzhou \
//     [--prefix snapshots/]
//
// 环境变量 (二选一):
//   COS_SECRET_ID / COS_SECRET_KEY        本地直接用
//   ZY_COS_SECRET_ID / ZY_COS_SECRET_KEY  GitHub Actions 习惯
//
// 输出三个包到 cos://<bucket>/<prefix>YYYYMMDD-HHmmss/:
//   - guanghulab-snapshot.tar.gz   (源代码 + .git, 排除大目录)
//   - mcp-tools-bundle.tar.gz      (mcp-servers/ 单独包)
//   - workflows-bundle.tar.gz      (.github/workflows/ 单独包)
//   - secrets-template.json        (只导 key 名, 不导值)
//   - manifest.json                (校验和清单)
// ════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// ─── 解析命令行 ────────────────────────────────────────────
function parseArgs(argv) {
  const args = { prefix: 'snapshots/' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--bucket') args.bucket = argv[++i];
    else if (a === '--region') args.region = argv[++i];
    else if (a === '--prefix') args.prefix = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 35).join('\n'));
      process.exit(0);
    }
  }
  return args;
}

const args = parseArgs(process.argv);
if (!args.bucket || !args.region) {
  console.error('❌ 必填: --bucket <name> --region <region>');
  process.exit(1);
}

const SECRET_ID = process.env.COS_SECRET_ID || process.env.ZY_COS_SECRET_ID;
const SECRET_KEY = process.env.COS_SECRET_KEY || process.env.ZY_COS_SECRET_KEY;
if (!args.dryRun && (!SECRET_ID || !SECRET_KEY)) {
  console.error('❌ 缺 COS_SECRET_ID / COS_SECRET_KEY (或 ZY_ 前缀变体)');
  process.exit(1);
}

// ─── 排除目录 (大文件 / 不该搬走的) ────────────────────────
const EXCLUDES = [
  'node_modules',
  '.next',
  '.cache',
  'corpus/output',
  'corpus/raw',
  'data/training/checkpoints',
  '.venv',
  '__pycache__',
  '*.pyc',
  '.DS_Store',
  '.env',
  '.env.local',
  '.env.production',
  // 排除 broadcasts 历史归档, 太多了
  'broadcasts-outbox/archive',
  // 临时
  'tmp',
  'dist',
  'build',
  'coverage',
];

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT_DIR = args.outDir || path.join(REPO_ROOT, 'tmp', `snapshot-${ts}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('═══════════════════════════════════════════════════════');
console.log('  光湖搬家 · snapshot-to-cos');
console.log('───────────────────────────────────────────────────────');
console.log(`  bucket : ${args.bucket}`);
console.log(`  region : ${args.region}`);
console.log(`  prefix : ${args.prefix}${ts}/`);
console.log(`  out    : ${OUT_DIR}`);
console.log(`  dryRun : ${args.dryRun ? 'YES' : 'no'}`);
console.log('═══════════════════════════════════════════════════════');

// ─── tar 调用安全封装 (不走 shell, 用 spawnSync + 数组参数) ─
function tarCreate(outFile, repoRoot, paths, excludes = []) {
  const args = ['czf', outFile];
  for (const e of excludes) {
    args.push('--exclude', e);
  }
  args.push('-C', repoRoot, ...paths);
  const r = spawnSync('tar', args, { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`tar failed (exit ${r.status})`);
  }
}

// ─── 1. 主仓库快照 ─────────────────────────────────────────
const SNAPSHOT_FILE = path.join(OUT_DIR, 'guanghulab-snapshot.tar.gz');
function makeSnapshot() {
  console.log('[1/4] 打包主仓库 (含 .git, 排除大目录) ...');
  // 不走 shell, EXCLUDES 与 REPO_ROOT 作为参数数组传入
  tarCreate(SNAPSHOT_FILE, REPO_ROOT, ['.'], EXCLUDES);
  const size = fs.statSync(SNAPSHOT_FILE).size;
  console.log(`    ✅ ${SNAPSHOT_FILE} (${(size / 1024 / 1024).toFixed(2)} MiB)`);
  return SNAPSHOT_FILE;
}

// ─── 2. MCP 工具单独包 ─────────────────────────────────────
const MCP_FILE = path.join(OUT_DIR, 'mcp-tools-bundle.tar.gz');
function makeMcpBundle() {
  console.log('[2/4] 打包 mcp-servers/ ...');
  const mcpDir = path.join(REPO_ROOT, 'mcp-servers');
  if (!fs.existsSync(mcpDir)) {
    console.log('    (skip: mcp-servers/ 不存在)');
    return null;
  }
  tarCreate(MCP_FILE, REPO_ROOT, ['mcp-servers']);
  console.log(`    ✅ ${MCP_FILE}`);
  return MCP_FILE;
}

// ─── 3. workflows 单独包 ───────────────────────────────────
const WF_FILE = path.join(OUT_DIR, 'workflows-bundle.tar.gz');
function makeWorkflowsBundle() {
  console.log('[3/4] 打包 .github/workflows/ ...');
  const wfDir = path.join(REPO_ROOT, '.github', 'workflows');
  if (!fs.existsSync(wfDir)) {
    console.log('    (skip)');
    return null;
  }
  tarCreate(WF_FILE, REPO_ROOT, ['.github/workflows']);
  console.log(`    ✅ ${WF_FILE}`);
  return WF_FILE;
}

// ─── 4. secrets 模板 (只导 key 名) ─────────────────────────
const SECRETS_FILE = path.join(OUT_DIR, 'secrets-template.json');
function makeSecretsTemplate() {
  console.log('[4/4] 扫描 .github/workflows/ 提取 secrets key 名 ...');
  const wfDir = path.join(REPO_ROOT, '.github', 'workflows');
  const keys = new Set();
  if (fs.existsSync(wfDir)) {
    for (const f of fs.readdirSync(wfDir)) {
      if (!f.endsWith('.yml') && !f.endsWith('.yaml')) continue;
      const txt = fs.readFileSync(path.join(wfDir, f), 'utf8');
      const re = /secrets\.([A-Z_0-9]+)/g;
      let m;
      while ((m = re.exec(txt)) !== null) keys.add(m[1]);
    }
  }
  const tpl = {
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559',
    _description: '从 .github/workflows/ 自动提取的 secrets key 名清单. 不含值.',
    generated_at: new Date().toISOString(),
    count: keys.size,
    keys: [...keys].sort(),
  };
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(tpl, null, 2));
  console.log(`    ✅ ${SECRETS_FILE} (${keys.size} keys)`);
}

// ─── manifest (校验和) ─────────────────────────────────────
function sha256(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

function makeManifest(files) {
  const manifest = {
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559',
    snapshot_id: ts,
    bucket: args.bucket,
    region: args.region,
    prefix: `${args.prefix}${ts}/`,
    generated_at: new Date().toISOString(),
    files: files.filter(Boolean).map((f) => ({
      name: path.basename(f),
      size: fs.statSync(f).size,
      sha256: sha256(f),
    })),
  };
  const file = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  console.log(`    ✅ manifest.json`);
  return file;
}

// ─── COS 上传 (用 coscmd / cos-cli, 或回退 curl) ───────────
function uploadToCos(localFile, key) {
  if (args.dryRun) {
    console.log(`    [dry-run] would upload ${localFile} → cos://${args.bucket}/${key}`);
    return;
  }
  const cmd = which('coscmd');
  if (cmd) {
    // 配置 coscmd
    const cfgDir = path.join(process.env.HOME || '/root', '.cos.conf.d');
    fs.mkdirSync(cfgDir, { recursive: true, mode: 0o700 });
    const cfgFile = path.join(process.env.HOME || '/root', '.cos.conf');
    fs.writeFileSync(
      cfgFile,
      `[common]\nsecret_id = ${SECRET_ID}\nsecret_key = ${SECRET_KEY}\nbucket = ${args.bucket}\nregion = ${args.region}\nmax_thread = 5\n`,
      { mode: 0o600 }
    );
    const r = spawnSync('coscmd', ['upload', localFile, key], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`coscmd upload failed: ${localFile}`);
    return;
  }
  console.error('❌ 未安装 coscmd. 请: pip install coscmd');
  console.error('   或者把 OUT_DIR 内容手动上传到 COS:');
  console.error(`   ${OUT_DIR}`);
  process.exit(2);
}

function which(bin) {
  try {
    const r = spawnSync('which', [bin], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  } catch { return null; }
}

// ─── 主流程 ────────────────────────────────────────────────
const files = [];
files.push(makeSnapshot());
files.push(makeMcpBundle());
files.push(makeWorkflowsBundle());
makeSecretsTemplate();
files.push(SECRETS_FILE);
const manifestFile = makeManifest(files);
files.push(manifestFile);

console.log('\n上传到 COS ...');
const remotePrefix = `${args.prefix}${ts}/`;
for (const f of files.filter(Boolean)) {
  const key = remotePrefix + path.basename(f);
  console.log(`  → ${key}`);
  uploadToCos(f, key);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`  ✅ 完成. 远端前缀: cos://${args.bucket}/${remotePrefix}`);
console.log('     国内灯塔上跑:');
console.log(`     bash restore-from-cos.sh --bucket ${args.bucket} --region ${args.region} --snapshot-id ${ts}`);
console.log('═══════════════════════════════════════════════════════');
