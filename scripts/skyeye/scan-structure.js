// scripts/skyeye/scan-structure.js
// 天眼·扫描模块B · 仓库结构完整性扫描
//
// 扫描内容：
//   ① 核心目录是否存在
//   ② 开发者沙盒目录（对照 routing-map.json）
//   ③ 孤儿文件检测
//   ④ 根目录是否干净
//   ⑤ README.md 完整性
//   ⑥ package.json 依赖一致性
//
// 输出：JSON → stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const now = new Date();

// ━━━ 核心目录列表 ━━━
const CORE_DIRS = [
  '.github/persona-brain',
  '.github/workflows',
  'scripts',
  'data',
  'core',
  'core/brain-wake',
  'connectors',
  'brain',
  'docs',
  'src'
];

// ━━━ 预期的根目录文件/目录 ━━━
const EXPECTED_ROOT_ITEMS = [
  '.github', '.git', '.gitignore', '.env',
  'README.md', 'package.json', 'package-lock.json',
  'node_modules',
  'brain', 'core', 'connectors', 'scripts', 'data', 'docs', 'src',
  'backend', 'frontend', 'modules', 'persona-studio', 'dingtalk-bot',
  'persona-brain-db', 'openclaw',
  'broadcasts', 'broadcasts-outbox', 'bulletin-board',
  'syslog', 'syslog-processed', 'signal-log', 'collaboration-logs',
  'reports', 'notification', 'dashboard', 'cloud-drive',
  'config.js', 'config.json', 'routing-map.json', 'dev-status.json',
  'broadcast-generator.js', 'server.js',
  'dev', 'm10-cloud',
  'guanghulab-main'
];

// ━━━ README Markers ━━━
const README_MARKERS = [
  'BINGSHUO_BULLETIN_START', 'BINGSHUO_BULLETIN_END',
  'BINGSHUO_ALERT_START', 'BINGSHUO_ALERT_END',
  'COLLABORATOR_BULLETIN_START', 'COLLABORATOR_BULLETIN_END',
  'COLLABORATOR_ALERT_START', 'COLLABORATOR_ALERT_END'
];

// ━━━ 检查核心目录 ━━━
function checkCoreDirs() {
  const results = [];
  let allOk = true;

  for (const dir of CORE_DIRS) {
    const dirPath = path.join(ROOT, dir);
    const exists = fs.existsSync(dirPath);
    if (!exists) allOk = false;
    results.push({ path: dir, exists });
  }

  return { all_ok: allOk, dirs: results };
}

// ━━━ 检查根目录是否干净 ━━━
function checkRootCleanliness() {
  const orphans = [];
  try {
    const items = fs.readdirSync(ROOT);
    for (const item of items) {
      if (item.startsWith('.') && !EXPECTED_ROOT_ITEMS.includes(item) && item !== '.github' && item !== '.git' && item !== '.gitignore' && item !== '.env') {
        orphans.push(item);
      } else if (!item.startsWith('.') && !EXPECTED_ROOT_ITEMS.includes(item)) {
        orphans.push(item);
      }
    }
  } catch (e) {
    return { clean: false, orphans: [], error: e.message };
  }

  return { clean: orphans.length === 0, orphans };
}

// ━━━ 检查 README.md 完整性 ━━━
function checkReadme() {
  const readmePath = path.join(ROOT, 'README.md');
  try {
    if (!fs.existsSync(readmePath)) {
      return { exists: false, markers_ok: false, missing_markers: README_MARKERS };
    }

    const content = fs.readFileSync(readmePath, 'utf8');
    const missingMarkers = [];
    for (const marker of README_MARKERS) {
      if (!content.includes(marker)) {
        missingMarkers.push(marker);
      }
    }

    return {
      exists: true,
      size: content.length,
      markers_ok: missingMarkers.length === 0,
      missing_markers: missingMarkers
    };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

// ━━━ 检查 package.json ━━━
function checkPackageJson() {
  const pkgPath = path.join(ROOT, 'package.json');
  try {
    if (!fs.existsSync(pkgPath)) {
      return { exists: false };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const hasNodeModules = fs.existsSync(path.join(ROOT, 'node_modules'));

    return {
      exists: true,
      name: pkg.name,
      version: pkg.version,
      dep_count: Object.keys(pkg.dependencies || {}).length,
      dev_dep_count: Object.keys(pkg.devDependencies || {}).length,
      node_modules_exists: hasNodeModules,
      has_scripts: Object.keys(pkg.scripts || {}).length > 0
    };
  } catch (e) {
    return { exists: true, parse_error: e.message };
  }
}

// ━━━ 检查开发者沙盒目录 ━━━
function checkDevSandboxes() {
  const devDir = path.join(ROOT, 'dev');
  const results = [];

  if (!fs.existsSync(devDir)) {
    return { dev_dir_exists: false, sandboxes: [] };
  }

  try {
    const items = fs.readdirSync(devDir);
    for (const item of items) {
      const itemPath = path.join(devDir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        const files = fs.readdirSync(itemPath);
        results.push({
          name: item,
          file_count: files.length,
          has_readme: files.includes('README.md')
        });
      }
    }
  } catch (e) {
    return { dev_dir_exists: true, error: e.message };
  }

  return { dev_dir_exists: true, sandboxes: results };
}

// ━━━ 主扫描 ━━━
function scanStructure() {
  const result = {
    scan_time: new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    core_dirs: checkCoreDirs(),
    root_cleanliness: checkRootCleanliness(),
    readme: checkReadme(),
    package_json: checkPackageJson(),
    dev_sandboxes: checkDevSandboxes(),
    // Summary
    core_dirs_ok: true,
    orphan_files: 0,
    missing_dirs: [],
    readme_ok: true
  };

  // Compute summary
  result.core_dirs_ok = result.core_dirs.all_ok;
  result.missing_dirs = result.core_dirs.dirs.filter(d => !d.exists).map(d => d.path);
  result.orphan_files = result.root_cleanliness.orphans ? result.root_cleanliness.orphans.length : 0;
  result.readme_ok = result.readme.exists && result.readme.markers_ok;

  console.log(JSON.stringify(result, null, 2));
}

scanStructure();
