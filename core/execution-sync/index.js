/**
 * core/execution-sync — 执行层状态同步模块
 *
 * 职责：
 *   - 扫描仓库结构，采集执行层状态
 *   - 生成执行层状态报告（docs/execution-status.md）
 *   - 同步执行状态到 Notion 主脑
 *
 * 执行逻辑：
 *   扫描仓库 → 生成状态报告 → 同步到 Notion
 *
 * 调用方式：
 *   node core/execution-sync [report|sync|status]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/**
 * 采集核心模块状态
 */
function collectCoreModules() {
  const modules = [
    { name: 'broadcast-listener', path: 'core/broadcast-listener/index.js' },
    { name: 'task-queue', path: 'core/task-queue/index.js' },
    { name: 'system-check', path: 'core/system-check/index.js' },
    { name: 'execution-sync', path: 'core/execution-sync/index.js' },
    { name: 'context-loader', path: 'core/context-loader/index.js' }
  ];

  return modules.map(m => ({
    ...m,
    status: fs.existsSync(path.join(ROOT, m.path)) ? 'enabled' : 'missing'
  }));
}

/**
 * 采集连接器状态
 */
function collectConnectors() {
  const connectors = [
    { name: 'notion-sync', path: 'connectors/notion-sync/index.js' },
    { name: 'model-router', path: 'connectors/model-router/index.js' }
  ];

  return connectors.map(c => ({
    ...c,
    status: fs.existsSync(path.join(ROOT, c.path)) ? 'enabled' : 'missing'
  }));
}

/**
 * 采集自动化工作流状态
 */
function collectWorkflows() {
  const workflowDir = path.join(ROOT, '.github/workflows');
  if (!fs.existsSync(workflowDir)) return { count: 0, files: [] };

  const files = fs.readdirSync(workflowDir).filter(
    f => f.endsWith('.yml') || f.endsWith('.yaml')
  );
  return { count: files.length, files };
}

/**
 * 采集任务队列状态
 */
function collectQueueStatus() {
  const queuePath = path.join(ROOT, 'core/task-queue/queue.json');
  if (!fs.existsSync(queuePath)) {
    return { total: 0, pending: 0, running: 0, completed: 0, failed: 0 };
  }

  try {
    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
    const tasks = queue.tasks || [];
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    };
  } catch {
    return { total: 0, pending: 0, running: 0, completed: 0, failed: 0 };
  }
}

/**
 * 读取系统版本
 */
function getSystemVersion() {
  const healthPath = path.join(ROOT, 'brain/system-health.json');
  if (!fs.existsSync(healthPath)) return 'unknown';

  try {
    const health = JSON.parse(fs.readFileSync(healthPath, 'utf-8'));
    return health.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * 生成完整的执行层状态快照
 */
function collectStatus() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19) + '+08:00';

  return {
    timestamp: beijingTime,
    version: getSystemVersion(),
    core_modules: collectCoreModules(),
    connectors: collectConnectors(),
    workflows: collectWorkflows(),
    task_queue: collectQueueStatus(),
    execution_layer_status: 'stable',
    notion_bridge: 'active',
    execution_sync: 'enabled'
  };
}

/**
 * 生成 Markdown 状态报告
 */
function generateReport(statusData) {
  const s = statusData || collectStatus();

  const coreTable = s.core_modules.map(m =>
    `| ${m.name} | \`${m.path}\` | ${m.status === 'enabled' ? '✅ Enabled' : '❌ Missing'} |`
  ).join('\n');

  const connTable = s.connectors.map(c =>
    `| ${c.name} | \`${c.path}\` | ${c.status === 'enabled' ? '✅ Enabled' : '❌ Missing'} |`
  ).join('\n');

  const q = s.task_queue;

  const md = `# 执行层状态报告 — execution-status.md

> 铸渊执行层自动生成 · TCS-0002∞  
> 更新时间：${s.timestamp}

---

## 系统概览

| 指标 | 状态 |
|------|------|
| 系统版本 | v${s.version} |
| 执行层状态 | ${s.execution_layer_status === 'stable' ? '✅ Stable' : '⚠️ ' + s.execution_layer_status} |
| Notion 桥接 | ${s.notion_bridge === 'active' ? '✅ Active' : '❌ Inactive'} |
| 执行同步 | ${s.execution_sync === 'enabled' ? '✅ Enabled' : '❌ Disabled'} |
| 工作流数量 | ${s.workflows.count} |

---

## 核心模块状态

| 模块 | 路径 | 状态 |
|------|------|------|
${coreTable}

---

## 连接器状态

| 连接器 | 路径 | 状态 |
|--------|------|------|
${connTable}

---

## 任务队列状态

| 指标 | 数量 |
|------|------|
| 总计 | ${q.total} |
| 待处理 | ${q.pending} |
| 执行中 | ${q.running} |
| 已完成 | ${q.completed} |
| 失败 | ${q.failed} |

---

## 执行闭环

\`\`\`
context-loader → system-check → execution-sync → 状态报告
        ↓
broadcast-listener → task-queue → 任务执行
        ↓
notion-sync → Notion 主脑更新
\`\`\`
`;

  return md;
}

/**
 * 写入状态报告文件
 */
function writeReport() {
  const statusData = collectStatus();
  const md = generateReport(statusData);
  const reportPath = path.join(ROOT, 'docs/execution-status.md');
  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`📝 执行状态报告已生成: docs/execution-status.md`);
  return statusData;
}

/**
 * 同步执行状态到 Notion
 */
async function syncToNotion(statusData) {
  let notionSync;
  try {
    notionSync = require('../../connectors/notion-sync');
  } catch {
    console.log('⚠️  connectors/notion-sync 模块未找到，跳过 Notion 同步');
    return;
  }

  console.log('📡 同步执行状态到 Notion...');
  await notionSync.syncExecutionStatus(statusData);
}

// CLI 入口
if (require.main === module) {
  const cmd = process.argv[2] || 'report';

  switch (cmd) {
    case 'report': {
      writeReport();
      break;
    }
    case 'sync': {
      const statusData = writeReport();
      syncToNotion(statusData).catch(err => {
        console.error(`❌ Notion 同步失败: ${err.message}`);
      });
      break;
    }
    case 'status': {
      const s = collectStatus();
      console.log('📊 执行层状态:');
      console.log(`  版本: v${s.version}`);
      console.log(`  执行层: ${s.execution_layer_status}`);
      console.log(`  Notion 桥接: ${s.notion_bridge}`);
      console.log(`  执行同步: ${s.execution_sync}`);
      console.log(`  核心模块: ${s.core_modules.filter(m => m.status === 'enabled').length}/${s.core_modules.length}`);
      console.log(`  连接器: ${s.connectors.filter(c => c.status === 'enabled').length}/${s.connectors.length}`);
      console.log(`  工作流: ${s.workflows.count}`);
      console.log(`  任务队列: ${s.task_queue.total} 总 / ${s.task_queue.pending} 待处理`);
      break;
    }
    default:
      console.log('用法: node core/execution-sync [report|sync|status]');
  }
}

module.exports = { collectStatus, generateReport, writeReport, syncToNotion };
