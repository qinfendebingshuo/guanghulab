/**
 * core/broadcast-listener — 广播监听模块
 *
 * 职责：
 *   - 监听 Notion 广播（通过 connectors/notion-sync）
 *   - 解析广播内容为可执行任务
 *   - 推入任务队列（core/task-queue）
 *
 * 数据流：
 *   Notion 广播 → broadcast-listener → 任务解析 → task-queue
 *
 * 调用方式：
 *   node core/broadcast-listener [--source notion|local]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BROADCASTS_DIR = path.join(ROOT, '.github/broadcasts');
const MEMORY_PATH = path.join(ROOT, 'memory.json');

/**
 * 扫描本地广播目录
 */
function scanLocalBroadcasts() {
  if (!fs.existsSync(BROADCASTS_DIR)) {
    console.log('⏭️  广播目录不存在，跳过本地扫描');
    return [];
  }

  const files = fs.readdirSync(BROADCASTS_DIR).filter(
    f => f.endsWith('.json') || f.endsWith('.md')
  );

  return files.map(f => {
    const filePath = path.join(BROADCASTS_DIR, f);
    const content = fs.readFileSync(filePath, 'utf-8');
    const isJson = f.endsWith('.json');

    let parsed = null;
    if (isJson) {
      try {
        parsed = JSON.parse(content);
      } catch {
        console.warn(`⚠️  JSON 解析失败: ${f}`);
      }
    }

    return {
      filename: f,
      type: isJson ? 'json' : 'markdown',
      path: filePath,
      data: parsed,
      raw: content,
      timestamp: new Date().toISOString()
    };
  });
}

/**
 * 将广播解析为任务结构
 */
function parseToTask(broadcast) {
  const task = {
    task_id: `TASK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source: 'broadcast',
    source_file: broadcast.filename,
    priority: 'normal',
    status: 'pending',
    executor: 'zhuyuan',
    created_at: broadcast.timestamp,
    payload: null
  };

  if (broadcast.type === 'json' && broadcast.data) {
    task.payload = broadcast.data;
    if (broadcast.data.priority) {
      task.priority = broadcast.data.priority;
    }
    if (broadcast.data.broadcast_id) {
      task.task_id = broadcast.data.broadcast_id;
    }
  } else {
    task.payload = { content: broadcast.raw };
  }

  return task;
}

/**
 * 检查广播是否已在 memory 中处理
 */
function isDuplicate(broadcastId) {
  if (!fs.existsSync(MEMORY_PATH)) return false;

  try {
    const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8'));
    const events = memory.events || [];
    return events.some(e =>
      e.broadcast_id === broadcastId ||
      (e.type === 'broadcast' && e.description === broadcastId)
    );
  } catch {
    return false;
  }
}

/**
 * 主执行函数：监听并解析广播
 */
function listen(options = {}) {
  const source = options.source || 'local';
  console.log(`📡 广播监听启动 [来源: ${source}]`);

  if (source === 'local') {
    const broadcasts = scanLocalBroadcasts();

    if (broadcasts.length === 0) {
      console.log('✅ 无待处理广播');
      return [];
    }

    console.log(`📬 发现 ${broadcasts.length} 条广播`);

    const tasks = [];
    for (const b of broadcasts) {
      const taskId = b.data?.broadcast_id || b.filename;
      if (isDuplicate(taskId)) {
        console.log(`⏭️  跳过已处理: ${taskId}`);
        continue;
      }
      const task = parseToTask(b);
      tasks.push(task);
      console.log(`📋 解析任务: ${task.task_id} [${task.priority}]`);
    }

    console.log(`✅ 共生成 ${tasks.length} 个待执行任务`);
    return tasks;
  }

  console.log('⚠️  Notion 源需通过 connectors/notion-sync 接入');
  return [];
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const source = args.includes('--source') ?
    args[args.indexOf('--source') + 1] : 'local';
  const tasks = listen({ source });
  if (tasks.length > 0) {
    console.log('\n📋 任务列表:');
    tasks.forEach(t => {
      console.log(`  ${t.task_id} | ${t.priority} | ${t.status}`);
    });
  }
}

module.exports = { listen, scanLocalBroadcasts, parseToTask, isDuplicate };
