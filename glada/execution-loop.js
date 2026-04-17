/**
 * GLADA · 主执行循环 · execution-loop.js
 *
 * 核心闭环：
 *   取任务 → 加载上下文 → 逐步执行 → 记录 → Git 提交 → 通知
 *
 * 这是 GLADA 的心脏。它不断从任务队列中取出任务，
 * 按步骤逐一执行，每一步都经过：
 *   1. 深度上下文构建
 *   2. LLM 代码生成
 *   3. 回归防护
 *   4. 自动测试
 *   5. Git 提交
 *   6. 开发记录
 *
 * 任务来源（双通道）：
 *   A. core/task-queue 中央任务队列（type: 'glada-task'）
 *   B. CAB pending 目录 + GLADA 本地队列（兼容）
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');

const taskReceiver = require('./task-receiver');
const contextBuilder = require('./context-builder');
const stepExecutor = require('./step-executor');
const gitOperator = require('./git-operator');
const notifier = require('./notifier');

const ROOT = path.resolve(__dirname, '..');
const EXECUTION_LOG_DIR = path.join(ROOT, 'glada', 'logs', 'executions');

// 尝试加载中央任务队列（容错：如果不存在则跳过）
let taskQueue = null;
try {
  taskQueue = require('../core/task-queue');
} catch {
  console.warn('[GLADA] ⚠️ core/task-queue 加载失败，仅使用本地队列');
}

/**
 * 执行单个 GLADA 任务（完整的步骤循环）
 * @param {Object} gladaTask - GLADA 任务对象
 * @param {Object} [options] - 执行选项
 * @returns {Promise<Object>} 执行结果
 */
async function executeTask(gladaTask, options = {}) {
  const taskId = gladaTask.glada_task_id;
  const startTime = Date.now();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[GLADA] 🚀 开始执行任务: ${taskId}`);
  console.log(`[GLADA] 📋 标题: ${gladaTask.plan.title}`);
  console.log(`[GLADA] 📊 步骤数: ${gladaTask.plan.steps.length}`);
  console.log(`${'═'.repeat(60)}\n`);

  // 更新任务状态为 running
  gladaTask.status = 'running';
  taskReceiver.updateTask(taskId, { status: 'running' });

  // 通知任务开始
  await notifier.notify(gladaTask, 'started');

  // 记录原始分支
  let originalBranch;
  try {
    originalBranch = gitOperator.getCurrentBranch();
  } catch {
    originalBranch = 'main';
  }

  // 创建任务分支
  let taskBranch;
  try {
    taskBranch = gitOperator.createTaskBranch(taskId);
    gladaTask.completion.git_branch = taskBranch;
  } catch (err) {
    console.error(`[GLADA] ⚠️ 创建 Git 分支失败: ${err.message}`);
    taskBranch = null;
  }

  const executionResult = {
    task_id: taskId,
    status: 'running',
    steps_completed: 0,
    steps_failed: 0,
    total_files_changed: [],
    git_commits: [],
    errors: [],
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: 0
  };

  // 逐步执行
  for (const step of gladaTask.plan.steps) {
    // 跳过已完成的步骤（支持断点续传）
    if (step.status === 'completed') {
      console.log(`[GLADA] ⏭️ 跳过已完成步骤 ${step.step_id}`);
      executionResult.steps_completed++;
      continue;
    }

    console.log(`\n${'─'.repeat(40)}`);
    console.log(`[GLADA] 📌 步骤 ${step.step_id}/${gladaTask.plan.steps.length}: ${step.description}`);
    console.log(`${'─'.repeat(40)}`);

    // 1. 构建深度上下文
    const context = contextBuilder.buildContext(gladaTask);
    const systemPrompt = contextBuilder.contextToSystemPrompt(context);

    // 2. 执行步骤
    step.status = 'running';
    step.started_at = new Date().toISOString();

    const stepResult = await stepExecutor.executeStep(step, systemPrompt, gladaTask, {
      model: options.model || 'deepseek-chat',
      maxTokens: options.maxTokens || 8192,
      skipTests: options.skipTests
    });

    // 3. 记录执行日志
    const logEntry = {
      step_id: step.step_id,
      action: step.description,
      status: stepResult.status,
      reasoning: stepResult.reasoning,
      files_changed: stepResult.files_changed,
      error: stepResult.error,
      duration_ms: stepResult.duration_ms,
      timestamp: new Date().toISOString()
    };

    gladaTask.execution_log.push(logEntry);
    writeExecutionLog(taskId, logEntry);

    // 4. 更新步骤状态
    if (stepResult.status === 'completed') {
      step.status = 'completed';
      step.completed_at = stepResult.completed_at;
      step.result = stepResult.summary;
      step.files_changed = stepResult.files_changed;
      step.reasoning = stepResult.reasoning;

      executionResult.steps_completed++;
      executionResult.total_files_changed.push(...stepResult.files_changed);

      // 5. Git 提交
      if (taskBranch && stepResult.files_changed.length > 0) {
        try {
          const commitHash = gitOperator.commitStep(
            taskId,
            step.step_id,
            stepResult.summary || step.description,
            stepResult.files_changed
          );
          if (commitHash) {
            executionResult.git_commits.push(`${commitHash}: 步骤${step.step_id} - ${step.description}`);
          }
        } catch (err) {
          console.warn(`[GLADA] ⚠️ Git 提交失败: ${err.message}`);
        }
      }
    } else {
      step.status = stepResult.status === 'rolled_back' ? 'rolled_back' : 'failed';
      step.error = stepResult.error;
      executionResult.steps_failed++;
      executionResult.errors.push(`步骤${step.step_id}: ${stepResult.error}`);

      // 如果设置了失败即停止
      if (options.stopOnFailure !== false) {
        console.warn(`[GLADA] ⛔ 步骤 ${step.step_id} 失败，停止执行`);
        break;
      }
    }

    // 保存任务状态
    taskReceiver.updateTask(taskId, {
      plan: gladaTask.plan,
      execution_log: gladaTask.execution_log
    });

    // 步骤间通知
    await notifier.notify(gladaTask, 'step_completed');
  }

  // 推送到远程
  if (taskBranch) {
    gitOperator.pushBranch(taskBranch);
  }

  // 最终状态
  const allCompleted = gladaTask.plan.steps.every(s => s.status === 'completed');
  executionResult.status = allCompleted ? 'completed' : 'partial';
  executionResult.completed_at = new Date().toISOString();
  executionResult.duration_ms = Date.now() - startTime;

  // 去重文件列表
  executionResult.total_files_changed = [...new Set(executionResult.total_files_changed)];

  // 更新任务完成信息
  gladaTask.status = allCompleted ? 'completed' : 'failed';
  gladaTask.completion = {
    ...gladaTask.completion,
    completed_at: executionResult.completed_at,
    total_files_changed: executionResult.total_files_changed,
    git_branch: taskBranch,
    git_commits: executionResult.git_commits,
    notification_sent: false
  };

  // 保存最终状态
  taskReceiver.updateTask(taskId, {
    status: gladaTask.status,
    plan: gladaTask.plan,
    completion: gladaTask.completion,
    execution_log: gladaTask.execution_log
  });

  // 发送完成通知
  const eventType = allCompleted ? 'completed' : 'failed';
  await notifier.notify(gladaTask, eventType);
  gladaTask.completion.notification_sent = true;
  taskReceiver.updateTask(taskId, { completion: gladaTask.completion });

  // 如果全部完成，归档
  if (allCompleted) {
    taskReceiver.archiveTask(taskId, gladaTask.completion);
  }

  // 切回原始分支
  if (originalBranch && taskBranch) {
    try {
      gitOperator.checkoutBranch(originalBranch);
    } catch {
      // 忽略
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[GLADA] ${allCompleted ? '✅' : '⚠️'} 任务执行${allCompleted ? '完成' : '部分完成'}: ${taskId}`);
  console.log(`[GLADA] 📊 完成: ${executionResult.steps_completed}, 失败: ${executionResult.steps_failed}`);
  console.log(`[GLADA] ⏱️ 耗时: ${Math.round(executionResult.duration_ms / 1000)}s`);
  console.log(`${'═'.repeat(60)}\n`);

  return executionResult;
}

/**
 * 写入执行日志
 * @param {string} taskId - 任务 ID
 * @param {Object} entry - 日志条目
 */
function writeExecutionLog(taskId, entry) {
  fs.mkdirSync(EXECUTION_LOG_DIR, { recursive: true });

  const logFile = path.join(EXECUTION_LOG_DIR, `${taskId}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');
}

/**
 * 从中央任务队列获取 glada-task 类型的任务
 * @returns {Object|null} GLADA 格式的任务，或 null
 */
function dequeueFromCentralQueue() {
  if (!taskQueue) return null;

  try {
    taskQueue.loadQueue();
    const queueTask = taskQueue.dequeue();

    if (!queueTask || queueTask.type !== 'glada-task') {
      return null;
    }

    // 标记为运行中
    // 将中央队列任务转换为 GLADA 执行格式
    console.log(`[GLADA] 📥 从中央任务队列取出: ${queueTask.task_id}`);

    // 如果任务有 cab_spec，用它转换；否则构建最小执行任务
    if (queueTask.cab_spec) {
      return taskReceiver.convertToGladaTask(queueTask.cab_spec);
    }

    // 最小格式转换
    return {
      glada_task_id: `GLADA-${queueTask.task_id}`,
      source_task_id: queueTask.task_id,
      source: 'central-queue',
      status: 'pending',
      created_at: queueTask.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      plan: {
        title: queueTask.description || queueTask.task_id,
        description: queueTask.description || '',
        steps: (queueTask.steps || [queueTask.description || 'Execute task']).map((step, i) => ({
          step_id: i + 1,
          description: typeof step === 'string' ? step : step.description || `步骤 ${i + 1}`,
          status: 'pending',
          started_at: null,
          completed_at: null,
          result: null,
          files_changed: [],
          reasoning: null
        })),
        priority: queueTask.priority || 'normal'
      },
      architecture: queueTask.architecture || {},
      constraints: queueTask.constraints || { no_touch_files: [], required_tests: true },
      reasoning_context: {},
      execution_log: [],
      completion: {
        completed_at: null,
        total_files_changed: [],
        git_branch: null,
        git_commits: [],
        notification_sent: false
      }
    };
  } catch (err) {
    console.error(`[GLADA] ⚠️ 中央队列读取失败: ${err.message}`);
    return null;
  }
}

/**
 * 主循环：持续监听并执行任务
 * 双通道获取任务：中央 task-queue → 本地 GLADA 队列
 * @param {Object} [options] - 循环选项
 * @param {number} [options.pollIntervalMs=30000] - 轮询间隔（毫秒）
 * @param {boolean} [options.singleRun=false] - 只执行一个任务就退出
 */
async function startLoop(options = {}) {
  const pollInterval = options.pollIntervalMs || 30000;
  const singleRun = options.singleRun || false;

  console.log(`[GLADA] 🔄 执行循环已启动 (轮询间隔: ${pollInterval / 1000}s)`);
  if (taskQueue) {
    console.log(`[GLADA] 📡 已连接中央任务队列 (core/task-queue)`);
  }

  const poll = async () => {
    try {
      // 双通道：先查中央队列，再查本地队列
      let task = dequeueFromCentralQueue();

      if (!task) {
        task = taskReceiver.receiveNextTask();
      }

      if (task) {
        // 如果来自中央队列，同时保存到本地以便断点续传
        if (task.source === 'central-queue') {
          const queueDir = taskReceiver.GLADA_QUEUE_DIR;
          fs.mkdirSync(queueDir, { recursive: true });
          fs.writeFileSync(
            path.join(queueDir, `${task.glada_task_id}.json`),
            JSON.stringify(task, null, 2),
            'utf-8'
          );
        }

        await executeTask(task, options);

        // 中央队列完成回写
        if (task.source === 'central-queue' && taskQueue) {
          try {
            const allCompleted = task.plan.steps.every(s => s.status === 'completed');
            if (allCompleted) {
              taskQueue.complete(task.source_task_id, { glada_task_id: task.glada_task_id });
            } else {
              taskQueue.fail(task.source_task_id, 'GLADA execution incomplete');
            }
          } catch {
            // 回写失败不阻塞主流程
          }
        }

        if (singleRun) {
          console.log('[GLADA] 单次运行模式，退出');
          return;
        }
      }
    } catch (err) {
      console.error(`[GLADA] ❌ 循环异常: ${err.message}`);
    }

    // 继续轮询
    if (!singleRun) {
      setTimeout(poll, pollInterval);
    }
  };

  await poll();
}

module.exports = {
  executeTask,
  writeExecutionLog,
  startLoop
};
