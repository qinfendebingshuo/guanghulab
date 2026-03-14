/**
 * core/context-loader — 上下文加载器
 *
 * 职责：
 *   - 在执行任务前加载系统上下文
 *   - 提供系统状态、执行层结构、当前任务、任务来源等信息
 *
 * 加载内容：
 *   - 系统状态（brain/system-health.json）
 *   - 执行层结构（core/ 模块状态）
 *   - 当前任务队列
 *   - 任务来源标识
 *
 * 执行流程：
 *   context-loader → 加载系统认知 → 加载任务上下文 → 返回上下文对象
 *
 * 调用方式：
 *   node core/context-loader
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/**
 * 加载系统状态
 */
function loadSystemHealth() {
  const healthPath = path.join(ROOT, 'brain/system-health.json');
  if (!fs.existsSync(healthPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(healthPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 加载执行层模块结构
 */
function loadModuleStructure() {
  const modules = [
    { name: 'broadcast-listener', path: 'core/broadcast-listener/index.js' },
    { name: 'task-queue', path: 'core/task-queue/index.js' },
    { name: 'system-check', path: 'core/system-check/index.js' },
    { name: 'execution-sync', path: 'core/execution-sync/index.js' },
    { name: 'context-loader', path: 'core/context-loader/index.js' }
  ];

  const connectors = [
    { name: 'notion-sync', path: 'connectors/notion-sync/index.js' },
    { name: 'model-router', path: 'connectors/model-router/index.js' }
  ];

  return {
    core: modules.map(m => ({
      ...m,
      status: fs.existsSync(path.join(ROOT, m.path)) ? 'active' : 'missing'
    })),
    connectors: connectors.map(c => ({
      ...c,
      status: fs.existsSync(path.join(ROOT, c.path)) ? 'active' : 'missing'
    }))
  };
}

/**
 * 加载当前任务队列概况
 */
function loadQueueSummary() {
  const queuePath = path.join(ROOT, 'core/task-queue/queue.json');
  if (!fs.existsSync(queuePath)) {
    return { total: 0, pending: 0, running: 0 };
  }

  try {
    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
    const tasks = queue.tasks || [];
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length
    };
  } catch {
    return { total: 0, pending: 0, running: 0 };
  }
}

/**
 * 加载铸渊身份认知
 */
function loadIdentity() {
  return {
    name: '铸渊',
    role: '仓库执行人格体',
    responsibilities: [
      '执行系统广播任务',
      '维护执行层结构',
      '同步执行状态',
      '运行自动化流程',
      '自动开发循环'
    ],
    principles: [
      'Notion 负责系统认知',
      '仓库负责执行与运行',
      '不修改主脑规则',
      '不改变编号体系',
      '不破坏现有自动化'
    ]
  };
}

/**
 * 加载完整系统上下文
 */
function loadContext() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19) + '+08:00';

  const context = {
    loaded_at: beijingTime,
    identity: loadIdentity(),
    system_health: loadSystemHealth(),
    module_structure: loadModuleStructure(),
    queue_summary: loadQueueSummary()
  };

  return context;
}

// CLI 入口
if (require.main === module) {
  console.log('🧠 铸渊上下文加载器 v5.1');
  console.log('═'.repeat(40));

  const ctx = loadContext();

  console.log(`\n⏰ 加载时间: ${ctx.loaded_at}`);

  console.log(`\n👤 身份: ${ctx.identity.name} — ${ctx.identity.role}`);

  const health = ctx.system_health;
  if (health) {
    console.log(`\n💚 系统版本: v${health.version}`);
    console.log(`   状态: ${health.system_health}`);
    console.log(`   执行层: ${health.execution_layer_status}`);
  } else {
    console.log('\n⚠️  系统状态未加载');
  }

  const mods = ctx.module_structure;
  const activeCore = mods.core.filter(m => m.status === 'active').length;
  const activeConn = mods.connectors.filter(c => c.status === 'active').length;
  console.log(`\n🔧 核心模块: ${activeCore}/${mods.core.length}`);
  console.log(`🔌 连接器: ${activeConn}/${mods.connectors.length}`);

  const q = ctx.queue_summary;
  console.log(`\n📋 任务队列: ${q.total} 总 / ${q.pending} 待处理 / ${q.running} 执行中`);

  console.log('\n✅ 上下文加载完成');
}

module.exports = { loadContext, loadSystemHealth, loadModuleStructure, loadQueueSummary, loadIdentity };
