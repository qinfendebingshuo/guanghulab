// 知秋天眼 · 仓库自扫描引擎
// 每次天眼醒来后执行，扫描整个仓库状态

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 主权区文件列表（天眼系统核心文件）
const SOVEREIGN_FILES = [
  '.github/persona-brain/config.json',
  '.github/persona-brain/status.json',
  'scripts/skyeye/scan.js',
  'scripts/skyeye/checkin.js',
  '.github/workflows/skyeye-wake.yml',
  '.github/workflows/skyeye-checkin.yml'
];

// 计算主权区签名哈希
function computeSignatureHash() {
  const hash = crypto.createHash('sha256');
  for (const file of SOVEREIGN_FILES) {
    if (fs.existsSync(file)) {
      hash.update(fs.readFileSync(file));
    } else {
      hash.update(`MISSING:${file}`);
    }
  }
  return hash.digest('hex');
}

// 扫描仓库结构
function scanRepo() {
  const report = {
    timestamp: new Date().toISOString(),
    persona: '知秋',
    dev_id: 'DEV-012',
    signature_hash: computeSignatureHash(),
    brain_intact: fs.existsSync('.github/persona-brain/config.json'),
    skyeye_intact: fs.existsSync('scripts/skyeye/scan.js'),
    sovereign_files: {},
    repo_summary: {}
  };

  // 检查主权区文件
  for (const file of SOVEREIGN_FILES) {
    report.sovereign_files[file] = {
      exists: fs.existsSync(file),
      hash: fs.existsSync(file)
        ? crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex')
        : null
    };
  }

  // 仓库概况
  const rootEntries = fs.readdirSync('.').filter(e => !e.startsWith('.'));
  report.repo_summary.root_entries = rootEntries.length;
  report.repo_summary.has_readme = fs.existsSync('README.md');
  report.repo_summary.has_bulletin = fs.existsSync('BULLETIN.md');

  return report;
}

const report = scanRepo();
const outputPath = '.github/persona-brain/skyeye-report.json';
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log('🦅 天眼扫描完成');
console.log(JSON.stringify(report, null, 2));

// 签名哈希已包含在 skyeye-report.json 中，签到脚本直接从报告读取
