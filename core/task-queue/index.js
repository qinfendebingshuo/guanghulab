/**
 * core/task-queue — 任务队列系统
 *
 * 任务结构：
 *   task_id    — 唯一任务标识
 *   source     — 来源（broadcast / maintenance / dev / auto）
 *   type       — 类型（system-task / dev-task / maintenance-task / auto-task）
 *   priority   — 优先级（high / normal / low）
 *   status     — 状态（pending / running / completed / failed）
 *   executor   — 执行者（zhuyuan）
 *
 * 任务类型：
 *   system-task      — 系统级任务（广播、状态同步）
 *   dev-task         — 开发任务（代码变更、功能开发）
 *   maintenance-task — 维护任务（结构修复、文档更新）
 *   auto-task        — 自动生成任务（自检发现的问题）
 *
 * 任务来源：
 *   - Notion 广播
 *   - 系统维护任务
 *   - 开发任务
 *   - 自动开发循环生成
 *
 * 执行流程：
 *   任务进入队列 → 按优先级去重 → 执行器运行 → 执行结果写回
 *
 * 调用方式：
 *   node core/task-queue [status|run|cleanup]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const QUEUE_PATH = path.join(ROOT, 'core/task-queue/queue.json');

/**
 * 加载当前队列
 */
function loadQueue() {
  if (!fs.existsSync(QUEUE_PATH)) {
    return { version: '5.1', tasks: [], last_updated: null };
  }
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  } catch {
    return { version: '5.1', tasks: [], last_updated: null };
  }
}

/**
 * 保存队列
 */
function saveQueue(queue) {
  queue.last_updated = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf-8');
}

/**
 * 添加任务到队列
 */
function enqueue(task) {
  const queue = loadQueue();

  // 去重：相同 task_id 只保留最新
  const existing = queue.tasks.findIndex(t => t.task_id === task.task_id);
  if (existing !== -1) {
    const original = queue.tasks[existing];
    queue.tasks[existing] = {
      ...original,
      ...task,
      queued_at: original.queued_at,
      updated_at: new Date().toISOString()
    };
    console.log(`🔄 更新已有任务: ${task.task_id}`);
  } else {
    queue.tasks.push({
      ...task,
      queued_at: new Date().toISOString()
    });
    console.log(`➕ 新增任务: ${task.task_id}`);
  }

  saveQueue(queue);
  return task;
}

/**
 * 批量入队
 */
function enqueueBatch(tasks) {
  return tasks.map(t => enqueue(t));
}

/**
 * 获取下一个待执行任务（按优先级）
 */
function dequeue() {
  const queue = loadQueue();
  const priorityOrder = { high: 0, normal: 1, low: 2 };

  const pending = queue.tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));

  if (pending.length === 0) return null;

  const task = pending[0];
  task.status = 'running';
  task.started_at = new Date().toISOString();
  saveQueue(queue);

  return task;
}

/**
 * 标记任务完成
 */
function complete(taskId, result = null) {
  const queue = loadQueue();
  const task = queue.tasks.find(t => t.task_id === taskId);

  if (!task) {
    console.warn(`⚠️  任务不存在: ${taskId}`);
    return null;
  }

  task.status = 'completed';
  task.completed_at = new Date().toISOString();
  if (result) task.result = result;

  saveQueue(queue);
  console.log(`✅ 任务完成: ${taskId}`);
  return task;
}

/**
 * 标记任务失败
 */
function fail(taskId, error = null) {
  const queue = loadQueue();
  const task = queue.tasks.find(t => t.task_id === taskId);

  if (!task) {
    console.warn(`⚠️  任务不存在: ${taskId}`);
    return null;
  }

  task.status = 'failed';
  task.failed_at = new Date().toISOString();
  if (error) task.error = String(error);

  saveQueue(queue);
  console.log(`❌ 任务失败: ${taskId}`);
  return task;
}

/**
 * 获取队列状态
 */
function status() {
  const queue = loadQueue();
  const tasks = queue.tasks;

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    last_updated: queue.last_updated,
    by_type: {
      'system-task': tasks.filter(t => t.type === 'system-task').length,
      'dev-task': tasks.filter(t => t.type === 'dev-task').length,
      'maintenance-task': tasks.filter(t => t.type === 'maintenance-task').length,
      'auto-task': tasks.filter(t => t.type === 'auto-task').length
    }
  };

  return stats;
}

/**
 * 清理已完成任务（保留最近 50 条）
 */
function cleanup() {
  const queue = loadQueue();
  const completed = queue.tasks.filter(t =>
    t.status === 'completed' || t.status === 'failed'
  );

  if (completed.length > 50) {
    const keep = completed
      .sort((a, b) => (b.completed_at || b.failed_at || '').localeCompare(a.completed_at || a.failed_at || ''))
      .slice(0, 50);
    const keepIds = new Set(keep.map(t => t.task_id));
    const active = queue.tasks.filter(t =>
      t.status === 'pending' || t.status === 'running'
    );
    queue.tasks = [...active, ...keep];
    saveQueue(queue);
    console.log(`🧹 清理完成，保留 ${queue.tasks.length} 条任务`);
  }
}

// CLI 入口
if (require.main === module) {
  const cmd = process.argv[2] || 'status';

  switch (cmd) {
    case 'status': {
      const s = status();
      console.log('📊 任务队列状态:');
      console.log(`  总计: ${s.total}`);
      console.log(`  待处理: ${s.pending}`);
      console.log(`  执行中: ${s.running}`);
      console.log(`  已完成: ${s.completed}`);
      console.log(`  失败: ${s.failed}`);
      console.log(`  更新时间: ${s.last_updated || '无'}`);
      if (s.total > 0) {
        console.log('  任务类型分布:');
        for (const [type, count] of Object.entries(s.by_type)) {
          if (count > 0) console.log(`    ${type}: ${count}`);
        }
      }
      break;
    }
    case 'run': {
      const task = dequeue();
      if (task) {
        console.log(`🚀 取出任务: ${task.task_id}`);
      } else {
        console.log('✅ 队列为空，无待执行任务');
      }
      break;
    }
    case 'cleanup': {
      cleanup();
      break;
    }
    default:
      console.log('用法: node core/task-queue [status|run|cleanup]');
  }
}

module.exports = { loadQueue, enqueue, enqueueBatch, dequeue, complete, fail, status, cleanup };
