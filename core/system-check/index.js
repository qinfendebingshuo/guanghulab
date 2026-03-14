/**
 * core/system-check — 仓库自检系统
 *
 * 功能：
 *   - 扫描仓库结构完整性
 *   - 检查自动化工作流状态
 *   - 检测配置错误
 *   - 更新系统索引
 *
 * 执行周期：daily cron（通过 daily-maintenance 工作流触发）
 *
 * 调用方式：
 *   node core/system-check
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/**
 * 必需目录列表
 */
const REQUIRED_DIRS = [
  'brain',
  'src',
  'scripts',
  'core/broadcast-listener',
  'core/task-queue',
  'core/system-check',
  'core/execution-sync',
  'core/context-loader',
  'connectors/notion-sync',
  'connectors/model-router',
  '.github/workflows',
  'docs'
];

/**
 * 必需文件列表
 */
const REQUIRED_FILES = [
  'brain/master-brain.md',
  'brain/read-order.md',
  'brain/repo-map.json',
  'brain/system-health.json',
  'brain/id-map.json',
  'package.json',
  'ecosystem.config.js',
  'docs/repo-structure-map.md',
  'docs/notion-bridge-map.md'
];

/**
 * 检查目录是否存在
 */
function checkDirectories() {
  console.log('\n📂 目录结构检查:');
  const results = [];

  for (const dir of REQUIRED_DIRS) {
    const fullPath = path.join(ROOT, dir);
    const exists = fs.existsSync(fullPath);
    const icon = exists ? '✅' : '❌';
    console.log(`  ${icon} ${dir}`);
    results.push({ path: dir, exists, type: 'directory' });
  }

  return results;
}

/**
 * 检查必需文件
 */
function checkFiles() {
  console.log('\n📄 必需文件检查:');
  const results = [];

  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(ROOT, file);
    const exists = fs.existsSync(fullPath);
    const icon = exists ? '✅' : '❌';
    console.log(`  ${icon} ${file}`);
    results.push({ path: file, exists, type: 'file' });
  }

  return results;
}

/**
 * 检查工作流数量
 */
function checkWorkflows() {
  console.log('\n⚙️  工作流检查:');
  const workflowDir = path.join(ROOT, '.github/workflows');

  if (!fs.existsSync(workflowDir)) {
    console.log('  ❌ 工作流目录不存在');
    return { count: 0, files: [] };
  }

  const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  console.log(`  ✅ 发现 ${files.length} 个工作流文件`);

  return { count: files.length, files };
}

/**
 * 检查核心模块状态
 */
function checkCoreModules() {
  console.log('\n🔧 核心模块检查:');
  const modules = [
    { name: 'broadcast-listener', path: 'core/broadcast-listener/index.js' },
    { name: 'task-queue', path: 'core/task-queue/index.js' },
    { name: 'system-check', path: 'core/system-check/index.js' },
    { name: 'execution-sync', path: 'core/execution-sync/index.js' },
    { name: 'context-loader', path: 'core/context-loader/index.js' },
    { name: 'notion-sync', path: 'connectors/notion-sync/index.js' },
    { name: 'model-router', path: 'connectors/model-router/index.js' }
  ];

  const results = [];
  for (const mod of modules) {
    const fullPath = path.join(ROOT, mod.path);
    const exists = fs.existsSync(fullPath);
    const icon = exists ? '✅' : '❌';
    console.log(`  ${icon} ${mod.name} → ${mod.path}`);
    results.push({ ...mod, exists });
  }

  return results;
}

/**
 * 检查 JSON 文件完整性
 */
function checkJsonIntegrity() {
  console.log('\n🔍 JSON 完整性检查:');
  const jsonFiles = [
    'brain/repo-map.json',
    'brain/system-health.json',
    'brain/id-map.json',
    'package.json'
  ];

  const results = [];
  for (const file of jsonFiles) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ⏭️  ${file} — 文件不存在`);
      results.push({ path: file, valid: false, reason: 'missing' });
      continue;
    }

    try {
      JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      console.log(`  ✅ ${file}`);
      results.push({ path: file, valid: true });
    } catch (e) {
      console.log(`  ❌ ${file} — JSON 解析错误`);
      results.push({ path: file, valid: false, reason: 'parse_error' });
    }
  }

  return results;
}

/**
 * 生成自检报告
 */
function generateReport(dirResults, fileResults, workflows, modules, jsonResults) {
  const totalChecks = dirResults.length + fileResults.length + modules.length + jsonResults.length;
  const passed = [
    ...dirResults.filter(r => r.exists),
    ...fileResults.filter(r => r.exists),
    ...modules.filter(r => r.exists),
    ...jsonResults.filter(r => r.valid)
  ].length;

  const report = {
    version: '5.1',
    checked_at: new Date().toISOString(),
    summary: {
      total_checks: totalChecks,
      passed: passed,
      failed: totalChecks - passed,
      health_score: Math.round((passed / totalChecks) * 100)
    },
    workflows: {
      count: workflows.count
    },
    directories: dirResults,
    files: fileResults,
    modules: modules,
    json_integrity: jsonResults
  };

  return report;
}

/**
 * 根据自检结果生成自动任务
 */
function generateAutoTasks(report) {
  const tasks = [];
  const timestamp = new Date().toISOString();

  // 检查目录缺失 → 生成修复任务
  const missingDirs = (report.directories || []).filter(d => !d.exists);
  for (const dir of missingDirs) {
    tasks.push({
      task_id: `auto-fix-dir-${dir.path.replace(/\//g, '-')}-${timestamp.slice(0, 10)}`,
      type: 'auto-task',
      source: 'system-check',
      priority: 'high',
      status: 'pending',
      executor: 'zhuyuan',
      description: `修复缺失目录: ${dir.path}`
    });
  }

  // 检查文件缺失 → 生成修复任务
  const missingFiles = (report.files || []).filter(f => !f.exists);
  for (const file of missingFiles) {
    tasks.push({
      task_id: `auto-fix-file-${file.path.replace(/\//g, '-')}-${timestamp.slice(0, 10)}`,
      type: 'auto-task',
      source: 'system-check',
      priority: 'high',
      status: 'pending',
      executor: 'zhuyuan',
      description: `修复缺失文件: ${file.path}`
    });
  }

  // 检查模块缺失 → 生成修复任务
  const missingModules = (report.modules || []).filter(m => !m.exists);
  for (const mod of missingModules) {
    tasks.push({
      task_id: `auto-fix-module-${mod.name}-${timestamp.slice(0, 10)}`,
      type: 'auto-task',
      source: 'system-check',
      priority: 'normal',
      status: 'pending',
      executor: 'zhuyuan',
      description: `修复缺失模块: ${mod.name}`
    });
  }

  // JSON 完整性失败 → 生成修复任务
  const invalidJson = (report.json_integrity || []).filter(j => !j.valid);
  for (const json of invalidJson) {
    tasks.push({
      task_id: `auto-fix-json-${json.path.replace(/\//g, '-')}-${timestamp.slice(0, 10)}`,
      type: 'auto-task',
      source: 'system-check',
      priority: 'high',
      status: 'pending',
      executor: 'zhuyuan',
      description: `修复 JSON 文件: ${json.path} (${json.reason})`
    });
  }

  // 健康分数低 → 生成结构优化任务
  if (report.summary && report.summary.health_score < 100) {
    tasks.push({
      task_id: `auto-optimize-structure-${timestamp.slice(0, 10)}`,
      type: 'maintenance-task',
      source: 'system-check',
      priority: 'low',
      status: 'pending',
      executor: 'zhuyuan',
      description: `结构优化: 健康分数 ${report.summary.health_score}%`
    });
  }

  return tasks;
}

/**
 * 主执行函数
 */
function run() {
  console.log('🏥 铸渊仓库自检系统 v5.1');
  console.log('═'.repeat(40));

  const dirResults = checkDirectories();
  const fileResults = checkFiles();
  const workflows = checkWorkflows();
  const modules = checkCoreModules();
  const jsonResults = checkJsonIntegrity();

  const report = generateReport(dirResults, fileResults, workflows, modules, jsonResults);

  console.log('\n═'.repeat(40));
  console.log(`📊 自检报告: ${report.summary.passed}/${report.summary.total_checks} 通过 (${report.summary.health_score}%)`);

  if (report.summary.failed > 0) {
    console.log(`⚠️  发现 ${report.summary.failed} 项问题`);
  } else {
    console.log('✅ 系统状态健康');
  }

  return report;
}

// CLI 入口
if (require.main === module) {
  const report = run();

  // 可选：输出 JSON 报告
  if (process.argv.includes('--json')) {
    const reportPath = path.join(ROOT, 'core/system-check/last-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n📝 报告已保存: ${reportPath}`);
  }

  // 可选：生成自动任务
  if (process.argv.includes('--auto-tasks')) {
    const autoTasks = generateAutoTasks(report);
    if (autoTasks.length > 0) {
      console.log(`\n🔄 生成 ${autoTasks.length} 个自动任务:`);
      autoTasks.forEach(t => console.log(`  📋 ${t.task_id}: ${t.description}`));
    } else {
      console.log('\n✅ 系统健康，无需生成自动任务');
    }
  }
}

module.exports = { run, generateAutoTasks, checkDirectories, checkFiles, checkWorkflows, checkCoreModules, checkJsonIntegrity };
