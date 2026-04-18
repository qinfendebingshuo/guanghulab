/**
 * GLADA · 任务接收器 · task-receiver.js
 *
 * 负责：
 *   1. 监听任务队列中的 glada-task 类型任务
 *   2. 解析 CAB 任务规格（bridge/chat-to-agent/pending/）
 *   3. 验证任务格式和授权
 *   4. 将合法任务传递给执行循环
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PENDING_DIR = path.join(ROOT, 'bridge', 'chat-to-agent', 'pending');
const COMPLETED_DIR = path.join(ROOT, 'bridge', 'chat-to-agent', 'completed');
const GLADA_QUEUE_DIR = path.join(ROOT, 'glada', 'queue');

/**
 * 扫描 pending 目录，获取所有待执行的任务规格
 * @returns {Object[]} 任务规格列表
 */
function scanPendingTasks() {
  const tasks = [];

  if (!fs.existsSync(PENDING_DIR)) {
    return tasks;
  }

  const files = fs.readdirSync(PENDING_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of files) {
    try {
      const filePath = path.join(PENDING_DIR, file);
      const spec = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      tasks.push({ file, filePath, spec });
    } catch (err) {
      console.error(`[GLADA-Receiver] ⚠️ 无法解析任务文件: ${file} - ${err.message}`);
    }
  }

  return tasks;
}

/**
 * 扫描 GLADA 本地队列
 * @returns {Object[]} 本地队列中的任务
 */
function scanLocalQueue() {
  const tasks = [];

  if (!fs.existsSync(GLADA_QUEUE_DIR)) {
    fs.mkdirSync(GLADA_QUEUE_DIR, { recursive: true });
    return tasks;
  }

  const files = fs.readdirSync(GLADA_QUEUE_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  for (const file of files) {
    try {
      const filePath = path.join(GLADA_QUEUE_DIR, file);
      const task = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (task.status === 'pending') {
        tasks.push({ file, filePath, ...task });
      }
    } catch (err) {
      console.error(`[GLADA-Receiver] ⚠️ 无法解析本地队列文件: ${file} - ${err.message}`);
    }
  }

  return tasks;
}

/**
 * 验证任务规格
 * @param {Object} spec - CAB 任务规格
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTaskSpec(spec) {
  const errors = [];

  if (!spec.task_id) {
    errors.push('缺少 task_id');
  }

  if (!spec.authorization || spec.authorization.sovereign !== '冰朔 · TCS-0002∞') {
    errors.push('授权不合法：sovereignty 必须为 "冰朔 · TCS-0002∞"');
  }

  if (!spec.development_plan || !spec.development_plan.title) {
    errors.push('缺少开发计划标题 (development_plan.title)');
  }

  if (!spec.development_plan || !Array.isArray(spec.development_plan.steps) || spec.development_plan.steps.length === 0) {
    errors.push('开发步骤为空 (development_plan.steps)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 将 CAB 任务规格转换为 GLADA 执行任务
 * @param {Object} spec - CAB 任务规格
 * @returns {Object} GLADA 执行任务
 */
function convertToGladaTask(spec) {
  const now = new Date().toISOString();

  return {
    glada_task_id: `GLADA-${spec.task_id}`,
    source_task_id: spec.task_id,
    status: 'pending',
    created_at: now,
    updated_at: now,

    // 开发计划
    plan: {
      title: spec.development_plan.title,
      description: spec.development_plan.description || '',
      steps: spec.development_plan.steps.map((step, i) => ({
        step_id: i + 1,
        description: typeof step === 'string' ? step : step.description || step.title || `步骤 ${i + 1}`,
        status: 'pending',
        started_at: null,
        completed_at: null,
        result: null,
        files_changed: [],
        reasoning: null
      })),
      priority: spec.development_plan.priority || 'normal'
    },

    // 架构上下文
    architecture: spec.architecture || {},

    // 约束
    constraints: spec.constraints || {
      no_touch_files: [],
      required_tests: true,
      deploy_after: false,
      max_files_changed: 20
    },

    // 推理上下文
    reasoning_context: spec.reasoning_context || {},

    // 执行记录
    execution_log: [],

    // 完成信息
    completion: {
      completed_at: null,
      total_files_changed: [],
      test_results: null,
      git_branch: null,
      git_commits: [],
      notification_sent: false
    }
  };
}

/**
 * 接收下一个待执行任务
 * 优先级：本地队列 > CAB pending 目录
 * @returns {Object|null} GLADA 执行任务或 null
 */
function receiveNextTask() {
  // 1. 先检查本地队列
  const localTasks = scanLocalQueue();
  if (localTasks.length > 0) {
    const task = localTasks[0];
    console.log(`[GLADA-Receiver] 📥 从本地队列取出任务: ${task.glada_task_id}`);
    return task;
  }

  // 2. 再检查 CAB pending 目录
  const pendingTasks = scanPendingTasks();
  if (pendingTasks.length > 0) {
    const { file, filePath, spec } = pendingTasks[0];

    // 验证
    const validation = validateTaskSpec(spec);
    if (!validation.valid) {
      console.error(`[GLADA-Receiver] ❌ 任务 ${file} 验证失败:`, validation.errors);
      return null;
    }

    // 转换为 GLADA 任务
    const gladaTask = convertToGladaTask(spec);

    // 保存到本地队列
    fs.mkdirSync(GLADA_QUEUE_DIR, { recursive: true });
    const queueFile = path.join(GLADA_QUEUE_DIR, `${gladaTask.glada_task_id}.json`);
    fs.writeFileSync(queueFile, JSON.stringify(gladaTask, null, 2), 'utf-8');

    console.log(`[GLADA-Receiver] 📥 接收CAB任务: ${spec.task_id} → ${gladaTask.glada_task_id}`);
    return gladaTask;
  }

  return null;
}

/**
 * 更新任务状态
 * @param {string} gladaTaskId - GLADA 任务 ID
 * @param {Object} updates - 要更新的字段
 */
function updateTask(gladaTaskId, updates) {
  const filePath = path.join(GLADA_QUEUE_DIR, `${gladaTaskId}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`[GLADA-Receiver] ⚠️ 任务文件不存在: ${gladaTaskId}`);
    return false;
  }

  const task = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  Object.assign(task, updates, { updated_at: new Date().toISOString() });
  fs.writeFileSync(filePath, JSON.stringify(task, null, 2), 'utf-8');
  return true;
}

/**
 * 将任务标记为已完成并归档
 * @param {string} gladaTaskId - GLADA 任务 ID
 * @param {Object} completionData - 完成数据
 */
function archiveTask(gladaTaskId, completionData) {
  const filePath = path.join(GLADA_QUEUE_DIR, `${gladaTaskId}.json`);
  if (!fs.existsSync(filePath)) return false;

  const task = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  task.status = 'completed';
  task.completion = {
    ...task.completion,
    ...completionData,
    completed_at: new Date().toISOString()
  };

  // 归档到完成目录
  const archiveDir = path.join(GLADA_QUEUE_DIR, 'completed');
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(
    path.join(archiveDir, `${gladaTaskId}.json`),
    JSON.stringify(task, null, 2),
    'utf-8'
  );

  // 从队列移除
  fs.unlinkSync(filePath);

  // 同时归档 CAB 源文件
  if (task.source_task_id) {
    const cabPendingFile = path.join(PENDING_DIR, `${task.source_task_id}.json`);
    if (fs.existsSync(cabPendingFile)) {
      fs.mkdirSync(COMPLETED_DIR, { recursive: true });
      fs.renameSync(cabPendingFile, path.join(COMPLETED_DIR, `${task.source_task_id}.json`));
    }
  }

  console.log(`[GLADA-Receiver] ✅ 任务已归档: ${gladaTaskId}`);
  return true;
}

module.exports = {
  scanPendingTasks,
  scanLocalQueue,
  validateTaskSpec,
  convertToGladaTask,
  receiveNextTask,
  updateTask,
  archiveTask,
  GLADA_QUEUE_DIR
};
