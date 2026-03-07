#!/usr/bin/env node
/**
 * 铸渊 · 仓库模块盘点扫描器
 * 扫描所有模块目录，生成 repo-inventory.json
 *
 * 用法: node scripts/scan-repo-inventory.js
 * 输出: .github/persona-brain/repo-inventory.json
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, '.github/persona-brain/repo-inventory.json');

const MODULES = [
  { directory: 'backend', owner_dev: 'DEV-001' },
  { directory: 'src', owner_dev: 'DEV-001' },
  { directory: 'frontend', owner_dev: 'DEV-002' },
  { directory: 'persona-selector', owner_dev: 'DEV-002' },
  { directory: 'chat-bubble', owner_dev: 'DEV-002' },
  { directory: 'settings', owner_dev: 'DEV-003' },
  { directory: 'cloud-drive', owner_dev: 'DEV-003' },
  { directory: 'dingtalk-bot', owner_dev: 'DEV-004' },
  { directory: 'status-board', owner_dev: 'DEV-005' },
  { directory: 'user-center', owner_dev: 'DEV-009' },
  { directory: 'ticket-system', owner_dev: 'DEV-010' },
  { directory: 'data-stats', owner_dev: 'DEV-010' },
  { directory: 'dynamic-comic', owner_dev: 'DEV-010' },
  { directory: 'writing-workspace', owner_dev: 'DEV-011' },
  { directory: 'notification-center', owner_dev: 'DEV-012' },
  { directory: 'app', owner_dev: '公共' }
];

const EXCLUDED_BASENAMES = new Set([
  'README.md', 'LATEST-BROADCAST.md', '.gitkeep', '.DS_Store'
]);

function getCodeFiles(dir) {
  const absDir = path.join(ROOT, dir);
  try {
    const output = execSync(
      `find "${absDir}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"`,
      { encoding: 'utf8', cwd: ROOT }
    ).trim();
    if (!output) return [];
    return output.split('\n').filter(f => {
      const base = path.basename(f);
      return !EXCLUDED_BASENAMES.has(base);
    }).map(f => path.relative(absDir, f));
  } catch {
    return [];
  }
}

function getLastCommit(dir) {
  try {
    const output = execSync(
      `git log -1 --format="%aI|%an" -- "${dir}"`,
      { encoding: 'utf8', cwd: ROOT }
    ).trim();
    if (!output) return { time: null, author: null };
    const parts = output.split('|');
    return { time: parts[0], author: parts.slice(1).join('|') };
  } catch {
    return { time: null, author: null };
  }
}

function scanModules() {
  const modules = [];
  let existsCount = 0;
  let hasCodeCount = 0;
  let deployReadyCount = 0;
  const emptyDirs = [];

  for (const mod of MODULES) {
    const absDir = path.join(ROOT, mod.directory);
    const exists = fs.existsSync(absDir);
    const codeFiles = exists ? getCodeFiles(mod.directory) : [];
    const hasCode = codeFiles.length > 0;
    const lastCommit = exists ? getLastCommit(mod.directory) : { time: null, author: null };

    const hasEntryPoint = codeFiles.some(f => {
      const base = path.basename(f);
      return ['index.html', 'page.tsx', 'index.js', 'server.js'].includes(base);
    });
    const deployReady = hasCode && hasEntryPoint;

    if (exists) existsCount++;
    if (hasCode) hasCodeCount++;
    if (deployReady) deployReadyCount++;
    if (!exists || !hasCode) emptyDirs.push(mod.directory);

    const mainFiles = codeFiles
      .filter(f => !f.endsWith('.zip') && !f.endsWith('.bak') && !f.endsWith('.bak2') && !f.includes('_副本'))
      .slice(0, 5);

    modules.push({
      directory: mod.directory,
      exists,
      has_code: hasCode,
      code_file_count: codeFiles.length,
      main_files: mainFiles,
      last_commit: lastCommit.time,
      last_author: lastCommit.author,
      owner_dev: mod.owner_dev,
      deploy_ready: deployReady
    });
  }

  return {
    scan_time: new Date().toISOString(),
    scanned_by: '铸渊',
    modules,
    summary: {
      total_dirs: MODULES.length,
      exists_count: existsCount,
      has_code_count: hasCodeCount,
      deploy_ready_count: deployReadyCount,
      empty_dirs: emptyDirs
    },
    deploy_config: {
      primary_site: {
        source: 'docs/',
        target: 'guanghulab.com',
        method: 'GitHub Pages (deploy-pages.yml)',
        note: 'docs/index.html → guanghulab.com 首页'
      },
      modules: {
        'status-board': {
          source: 'status-board/',
          target: '/var/www/guanghulab/status-board',
          method: 'rsync (deploy-to-server.yml)',
          deploy_ready: true
        },
        backend: {
          source: 'backend/',
          target: 'server-side (PM2)',
          method: 'rsync (deploy-to-server.yml)',
          deploy_ready: true
        },
        app: {
          source: 'app/',
          target: 'Next.js app (待配置)',
          method: '需另配部署流程',
          deploy_ready: false
        }
      },
      current_cd_root_detection: 'app/ → dist/ → public/ → ./',
      recommendation: '首页由 docs/ 通过 GitHub Pages 部署；status-board 通过 rsync 独立部署；其余模块开发完成后按需配置独立部署路径'
    }
  };
}

// Run scan
const report = scanModules();

// Write output
const outputDir = path.dirname(OUTPUT);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n');

console.log('📦 铸渊模块盘点完成');
console.log(`  扫描时间: ${report.scan_time}`);
console.log(`  存在目录: ${report.summary.exists_count}/${report.summary.total_dirs}`);
console.log(`  有实际代码: ${report.summary.has_code_count}/${report.summary.total_dirs}`);
console.log(`  可部署模块: ${report.summary.deploy_ready_count}`);
console.log(`  空目录: [${report.summary.empty_dirs.join(', ')}]`);
