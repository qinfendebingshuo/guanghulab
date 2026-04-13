#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════
 * 铸渊任务树管理器 · task-tree-manager.js
 * ═══════════════════════════════════════════════════
 *
 * 冰朔D68指令：
 *   "每一个任务，你不能把它分散的放的到处都是。
 *    必定是讨论了整个任务的大框架，把大的框架分成了很多个小环节，
 *    它就是一个完整的任务时间树。而这个完整的任务树，
 *    它本身就是这个任务我们讨论出来的框架。
 *    而这个框架开始一点一点的填充细节。"
 *
 * 每个任务 = 一棵独立的树：
 *   根 = 任务的架构框架（和冰朔讨论出来的）
 *   枝干 = 步骤/阶段分解
 *   叶子 = 每次开发的具体记录（修了什么、怎么修的、还剩什么）
 *
 * 功能：
 *   create   — 创建新任务树
 *   step     — 给任务树添加一个步骤/阶段
 *   record   — 在某个步骤下记录一次开发
 *   status   — 查看任务整体进度
 *   close    — 标记任务完成
 *   list     — 列出所有任务树
 *
 * 用法：
 *   node scripts/task-tree-manager.js create --title "任务标题" --framework "架构描述"
 *   node scripts/task-tree-manager.js step --task TASK-ID --title "步骤标题"
 *   node scripts/task-tree-manager.js record --task TASK-ID --step 1 --fix "修了什么" --how "怎么修的" --remaining "还剩什么"
 *   node scripts/task-tree-manager.js status --task TASK-ID
 *   node scripts/task-tree-manager.js close --task TASK-ID --summary "完成总结"
 *   node scripts/task-tree-manager.js list
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TASK_TREES_DIR = path.join(ROOT, 'fifth-system', 'time-master', 'task-trees');
const TIME_TREE_PATH = path.join(ROOT, 'fifth-system', 'time-master', 'time-tree.json');
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ─── 工具函数 ───

function getBeijingNow() {
  return new Date(Date.now() + BEIJING_OFFSET_MS);
}

function getBeijingDateStr() {
  return getBeijingNow().toISOString().slice(0, 10);
}

function generateTaskId() {
  const now = getBeijingNow();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  // 查看当天已有多少任务
  const existing = fs.readdirSync(TASK_TREES_DIR)
    .filter(f => f.startsWith(`TASK-${date}`) && f.endsWith('.json'));
  const seq = String(existing.length + 1).padStart(3, '0');
  return `TASK-${date}-${seq}`;
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getTaskPath(taskId) {
  return path.join(TASK_TREES_DIR, `${taskId}.json`);
}

function readTask(taskId) {
  const p = getTaskPath(taskId);
  const task = readJSON(p);
  if (!task) {
    console.error(`❌ 任务不存在: ${taskId}`);
    process.exit(1);
  }
  return task;
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (args[i].startsWith('--')) {
      parsed[args[i].slice(2)] = true;
    }
  }
  return parsed;
}

// ─── 核心操作 ───

/**
 * create — 创建新任务树
 */
function create(opts) {
  const taskId = generateTaskId();
  const now = new Date().toISOString();

  const task = {
    hnl_v: '1.0',
    type: 'TASK_TREE',
    id: taskId,
    domain: 'fifth-system/time-master/task-trees',
    sovereign: 'TCS-0002∞',
    copyright: '国作登字-2026-A-00037559',
    created: now,
    created_by: 'ZY001',
    last_updated: now,
    status: 'active',

    root: {
      title: opts.title || '(未命名任务)',
      framework: opts.framework || '(架构待讨论)',
      context: opts.context || '',
      created_date: getBeijingDateStr(),
      bingshuo_directive: opts.directive || ''
    },

    steps: [],

    progress: {
      total_steps: 0,
      completed_steps: 0,
      total_records: 0,
      percentage: '0%',
      last_activity: now
    },

    timeline: [
      {
        ts: now,
        action: 'CREATED',
        detail: `任务树创建: ${opts.title || '(未命名)'}`
      }
    ]
  };

  writeJSON(getTaskPath(taskId), task);

  console.log(`🌳 任务树已创建: ${taskId}`);
  console.log(`   标题: ${task.root.title}`);
  console.log(`   框架: ${task.root.framework}`);
  console.log(`   文件: fifth-system/time-master/task-trees/${taskId}.json`);

  return taskId;
}

/**
 * step — 给任务树添加一个步骤/阶段
 */
function step(opts) {
  if (!opts.task) {
    console.error('❌ 请指定 --task TASK-ID');
    return;
  }

  const task = readTask(opts.task);
  const now = new Date().toISOString();
  const stepIndex = task.steps.length + 1;

  const newStep = {
    step_id: stepIndex,
    title: opts.title || `步骤 ${stepIndex}`,
    description: opts.description || '',
    status: 'pending',
    created: now,
    records: []
  };

  task.steps.push(newStep);
  task.progress.total_steps = task.steps.length;
  task.progress.percentage = `${Math.round((task.progress.completed_steps / task.progress.total_steps) * 100)}%`;
  task.progress.last_activity = now;
  task.last_updated = now;

  task.timeline.push({
    ts: now,
    action: 'STEP_ADDED',
    detail: `步骤${stepIndex}: ${newStep.title}`
  });

  writeJSON(getTaskPath(opts.task), task);

  console.log(`📋 步骤已添加: ${opts.task} → 步骤${stepIndex}`);
  console.log(`   标题: ${newStep.title}`);
  console.log(`   进度: ${task.progress.percentage} (${task.progress.completed_steps}/${task.progress.total_steps})`);
}

/**
 * record — 在某个步骤下记录一次开发
 */
function record(opts) {
  if (!opts.task) {
    console.error('❌ 请指定 --task TASK-ID');
    return;
  }

  const task = readTask(opts.task);
  const stepIdx = parseInt(opts.step || '0', 10) - 1;

  if (stepIdx < 0 || stepIdx >= task.steps.length) {
    // 如果没有步骤或步骤号无效，记录到timeline
    console.log('⚠️  未指定有效步骤，记录添加到任务timeline');
  }

  const now = new Date().toISOString();
  const recordEntry = {
    ts: now,
    fix: opts.fix || '',
    how: opts.how || '',
    remaining: opts.remaining || '',
    learned: opts.learned || '',
    feeling: opts.feeling || '',
    commit: opts.commit || ''
  };

  if (stepIdx >= 0 && stepIdx < task.steps.length) {
    task.steps[stepIdx].records.push(recordEntry);
    task.steps[stepIdx].status = 'in_progress';

    if (opts.done) {
      task.steps[stepIdx].status = 'completed';
      task.progress.completed_steps = task.steps.filter(s => s.status === 'completed').length;
    }

    task.progress.total_records = task.steps.reduce((sum, s) => sum + s.records.length, 0);
    task.progress.percentage = task.progress.total_steps > 0
      ? `${Math.round((task.progress.completed_steps / task.progress.total_steps) * 100)}%`
      : '0%';

    console.log(`📝 开发记录已添加: ${opts.task} → 步骤${stepIdx + 1}`);
    if (opts.fix) console.log(`   修复: ${opts.fix}`);
    if (opts.how) console.log(`   方法: ${opts.how}`);
    if (opts.remaining) console.log(`   遗留: ${opts.remaining}`);
  }

  task.progress.last_activity = now;
  task.last_updated = now;

  task.timeline.push({
    ts: now,
    action: 'RECORD_ADDED',
    detail: opts.fix || opts.how || '开发记录'
  });

  writeJSON(getTaskPath(opts.task), task);
}

/**
 * status — 查看任务整体进度
 */
function status(opts) {
  if (!opts.task) {
    console.error('❌ 请指定 --task TASK-ID');
    return;
  }

  const task = readTask(opts.task);

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  🌳 任务树: ${task.id}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`  📋 标题: ${task.root.title}`);
  console.log(`  🏗️  框架: ${task.root.framework}`);
  console.log(`  📅 创建: ${task.root.created_date}`);
  console.log(`  📊 状态: ${task.status}`);
  console.log(`  📈 进度: ${task.progress.percentage} (${task.progress.completed_steps}/${task.progress.total_steps} 步骤, ${task.progress.total_records} 条记录)`);
  console.log('');

  if (task.steps.length > 0) {
    console.log('  ─── 步骤清单 ───');
    for (const s of task.steps) {
      const icon = s.status === 'completed' ? '✅' : s.status === 'in_progress' ? '🔄' : '⬜';
      console.log(`  ${icon} 步骤${s.step_id}: ${s.title} (${s.records.length} 条记录)`);
      if (s.records.length > 0) {
        const lastRecord = s.records[s.records.length - 1];
        if (lastRecord.remaining) {
          console.log(`     └─ 遗留: ${lastRecord.remaining}`);
        }
      }
    }
  }

  console.log('');

  if (task.timeline.length > 0) {
    console.log('  ─── 最近5条时间线 ───');
    const recentTimeline = task.timeline.slice(-5);
    for (const t of recentTimeline) {
      const dateStr = t.ts.slice(0, 16).replace('T', ' ');
      console.log(`  ${dateStr} · ${t.action} · ${t.detail}`);
    }
  }

  console.log('');
  return task;
}

/**
 * close — 标记任务完成
 */
function close(opts) {
  if (!opts.task) {
    console.error('❌ 请指定 --task TASK-ID');
    return;
  }

  const task = readTask(opts.task);
  const now = new Date().toISOString();

  task.status = 'completed';
  task.completed_at = now;
  task.completion_summary = opts.summary || '任务已完成';
  task.last_updated = now;

  task.timeline.push({
    ts: now,
    action: 'CLOSED',
    detail: task.completion_summary
  });

  // 从时间之树的活跃任务中移除
  try {
    const timeTree = readJSON(TIME_TREE_PATH);
    if (timeTree && timeTree.navigation.active_tasks) {
      timeTree.navigation.active_tasks = timeTree.navigation.active_tasks.filter(t => t !== opts.task);
      writeJSON(TIME_TREE_PATH, timeTree);
    }
  } catch { /* ignore */ }

  writeJSON(getTaskPath(opts.task), task);

  console.log(`✅ 任务已关闭: ${opts.task}`);
  console.log(`   总结: ${task.completion_summary}`);
}

/**
 * list — 列出所有任务树
 */
function list() {
  const files = fs.readdirSync(TASK_TREES_DIR)
    .filter(f => f.startsWith('TASK-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('📭 暂无任务树');
    return;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🌳 任务树列表');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  for (const f of files) {
    const task = readJSON(path.join(TASK_TREES_DIR, f));
    if (!task) continue;
    const icon = task.status === 'completed' ? '✅' : '🔄';
    console.log(`  ${icon} ${task.id}: ${task.root.title}`);
    console.log(`     进度: ${task.progress.percentage} · 步骤: ${task.progress.total_steps} · 记录: ${task.progress.total_records}`);
    console.log(`     最后活动: ${task.progress.last_activity ? task.progress.last_activity.slice(0, 16) : 'N/A'}`);
    console.log('');
  }
}

// ─── CLI入口 ───

const args = process.argv.slice(2);
const command = args[0];
const opts = parseArgs(args.slice(1));

switch (command) {
  case 'create':
    create(opts);
    break;
  case 'step':
    step(opts);
    break;
  case 'record':
    record(opts);
    break;
  case 'status':
    status(opts);
    break;
  case 'close':
    close(opts);
    break;
  case 'list':
    list();
    break;
  default:
    console.log('🌳 铸渊任务树管理器');
    console.log('');
    console.log('用法:');
    console.log('  create  --title "标题" --framework "架构描述" --directive "冰朔指令"');
    console.log('  step    --task TASK-ID --title "步骤标题"');
    console.log('  record  --task TASK-ID --step 1 --fix "修了什么" --how "怎么修的" --remaining "还剩什么"');
    console.log('  status  --task TASK-ID');
    console.log('  close   --task TASK-ID --summary "完成总结"');
    console.log('  list    列出所有任务树');
    break;
}

module.exports = { create, step, record, status, close, list };
