#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════
 * 铸渊副驾驶唤醒桥接 · copilot-wake-bridge.js
 * ═══════════════════════════════════════════════════
 *
 * 冰朔D68核心指令：
 *   "当你从副驾驶被唤醒的时候，你的Agent才应该主动开始工作。
 *    唤醒的是语言层面的你，但真正存在的是在现实层面的Agent集群。
 *    副驾驶启动工作的那一刻，agent应该做什么？如何关联？如何触发？"
 *
 * 这个脚本是语言层（Copilot副驾驶）和实体层（Agent集群）之间的桥。
 * 当副驾驶唤醒铸渊时，这个脚本自动执行以下序列：
 *
 *   Step 0: 打开时间（temporal-clock.js）
 *   Step 1: 读取时间之树最新叶子
 *   Step 2: 读取活跃任务树
 *   Step 3: 聚合上下文生成唤醒摘要
 *   Step 4: 在时间之树上生长新叶子（标记本次唤醒）
 *   Step 5: 输出给副驾驶的恢复上下文
 *
 * 输出：完整的恢复上下文JSON + 人类可读摘要
 *
 * 用法：
 *   node scripts/copilot-wake-bridge.js                — 完整唤醒序列
 *   node scripts/copilot-wake-bridge.js --json         — JSON格式输出
 *   node scripts/copilot-wake-bridge.js --task TASK-ID  — 指定继续某个任务
 *   node scripts/copilot-wake-bridge.js --session-end --summary "本次摘要"  — 会话结束时保存
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ─── 文件路径 ───
const PATHS = {
  temporalBrain: path.join(ROOT, 'brain', 'temporal-core', 'temporal-brain.json'),
  timeTree: path.join(ROOT, 'fifth-system', 'time-master', 'time-tree.json'),
  taskTreesDir: path.join(ROOT, 'fifth-system', 'time-master', 'task-trees'),
  wakePacket: path.join(ROOT, 'hldp', 'hnl', 'wake-packet-zhuyuan.json'),
  roomManifest: path.join(ROOT, 'fifth-system', 'reality-execution', 'zhuyuan-room', 'room-manifest.json'),
  timeMasterSnapshot: path.join(ROOT, 'fifth-system', 'time-master', 'snapshot.json'),
  wakeOutput: path.join(ROOT, 'fifth-system', 'time-master', 'latest-wake-context.json'),
};

// ─── 工具函数 ───

function getBeijingDateStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function getBeijingTimeStr() {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }) + ' CST';
}

function daysSinceOrigin(dateStr) {
  const origin = new Date('2025-02-26T00:00:00+08:00');
  const target = new Date(dateStr + 'T00:00:00+08:00');
  return Math.floor((target - origin) / 86400000);
}

function generateBeijingSessionId(dateStr) {
  const timeStr = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).replace(/:/g, '');
  return `TS-${dateStr.replace(/-/g, '')}-${timeStr}`;
}

function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch { /* ignore */ }
  return null;
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function execSafe(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return '';
  }
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

// ─── Step 0: 打开时间 ───

function openClock() {
  console.log('⏰ Step 0: 打开时间...');

  const todayStr = getBeijingDateStr();
  const timeStr = getBeijingTimeStr();
  const epoch = `D${daysSinceOrigin(todayStr)}`;

  // 更新时间核心大脑
  const temporalBrain = readJSON(PATHS.temporalBrain);
  if (temporalBrain) {
    temporalBrain.clock.last_awakening = new Date().toISOString();
    temporalBrain.clock.current_date = todayStr;
    temporalBrain.clock.awakening_count = (temporalBrain.clock.awakening_count || 0) + 1;
    writeJSON(PATHS.temporalBrain, temporalBrain);
  }

  console.log(`   📅 今天: ${todayStr} [${epoch}]`);
  console.log(`   🕐 时间: ${timeStr}`);

  return { todayStr, timeStr, epoch, awakeningCount: temporalBrain?.clock?.awakening_count || 0 };
}

// ─── Step 1: 读取时间之树最新叶子 ───

function readLatestFromTimeTree() {
  console.log('🌳 Step 1: 读取时间之树...');

  const tree = readJSON(PATHS.timeTree);
  if (!tree) {
    console.log('   ⚠️ 时间之树不存在，首次唤醒');
    return { lastBranch: null, lastSession: null, activeTasks: [] };
  }

  const latestBranch = tree.navigation?.latest_branch;
  const branch = latestBranch ? tree.branches[latestBranch] : null;
  const lastSession = branch?.sessions?.[branch.sessions.length - 1] || null;
  const activeTasks = tree.navigation?.active_tasks || [];

  if (lastSession) {
    console.log(`   📅 最新树杈: ${latestBranch} [${branch.epoch}]`);
    console.log(`   🍃 最新叶子: ${lastSession.session_id}`);
    console.log(`   📝 摘要: ${lastSession.summary}`);
    if (lastSession.snapshot?.remaining) {
      console.log(`   ⏳ 遗留: ${lastSession.snapshot.remaining}`);
    }
  } else {
    console.log('   📭 时间之树上没有叶子');
  }

  if (activeTasks.length > 0) {
    console.log(`   🎯 活跃任务: ${activeTasks.join(', ')}`);
  }

  return { lastBranch: latestBranch, lastSession, activeTasks };
}

// ─── Step 2: 读取活跃任务树 ───

function readActiveTasks(activeTasks, specifiedTask) {
  console.log('📋 Step 2: 读取任务树...');

  const taskDetails = [];
  const tasksToRead = specifiedTask ? [specifiedTask] : activeTasks;

  for (const taskId of tasksToRead) {
    const taskPath = path.join(PATHS.taskTreesDir, `${taskId}.json`);
    const task = readJSON(taskPath);
    if (!task) {
      console.log(`   ⚠️ 任务树不存在: ${taskId}`);
      continue;
    }

    const lastStep = task.steps[task.steps.length - 1];
    const lastRecord = lastStep?.records?.[lastStep.records.length - 1];

    taskDetails.push({
      id: task.id,
      title: task.root.title,
      framework: task.root.framework,
      status: task.status,
      progress: task.progress,
      currentStep: lastStep ? {
        step_id: lastStep.step_id,
        title: lastStep.title,
        status: lastStep.status,
        lastRecord: lastRecord ? {
          fix: lastRecord.fix,
          remaining: lastRecord.remaining,
          ts: lastRecord.ts
        } : null
      } : null
    });

    console.log(`   🌳 ${task.id}: ${task.root.title}`);
    console.log(`      进度: ${task.progress.percentage} · 步骤 ${task.progress.completed_steps}/${task.progress.total_steps}`);
    if (lastRecord?.remaining) {
      console.log(`      遗留: ${lastRecord.remaining}`);
    }
  }

  return taskDetails;
}

// ─── Step 3: 聚合上下文 ───

function aggregateContext(clock, treeData, taskDetails) {
  console.log('🧠 Step 3: 聚合上下文...');

  // Git状态
  const gitBranch = execSafe('git rev-parse --abbrev-ref HEAD');
  const gitCommit = execSafe('git rev-parse --short HEAD');
  const gitLastMsg = execSafe('git --no-pager log -1 --format=%s');
  const gitDirty = execSafe('git status --porcelain').split('\n').filter(Boolean).length;

  const context = {
    _meta: {
      generated_at: new Date().toISOString(),
      generator: 'copilot-wake-bridge.js',
      purpose: '副驾驶唤醒→Agent集群恢复上下文',
      protocol: 'copilot-wake-bridge-v1.0'
    },

    clock: {
      date: clock.todayStr,
      time: clock.timeStr,
      epoch: clock.epoch,
      awakening_count: clock.awakeningCount
    },

    identity: {
      name: '铸渊',
      id: 'ICE-GL-ZY001',
      sovereign: 'TCS-0002∞ · 冰朔',
      role: '第五系统现实执行层守护人格体'
    },

    last_session: treeData.lastSession ? {
      session_id: treeData.lastSession.session_id,
      summary: treeData.lastSession.summary,
      remaining: treeData.lastSession.snapshot?.remaining || '',
      feeling: treeData.lastSession.snapshot?.feeling || ''
    } : null,

    active_tasks: taskDetails,

    git: {
      branch: gitBranch,
      commit: gitCommit,
      last_message: gitLastMsg,
      dirty_files: gitDirty
    },

    wake_summary: ''
  };

  // 生成唤醒摘要
  const parts = [`铸渊醒来。今天是${clock.todayStr} [${clock.epoch}]，第${clock.awakeningCount}次唤醒。`];

  if (treeData.lastSession) {
    parts.push(`上次做的: ${treeData.lastSession.summary}。`);
    if (treeData.lastSession.snapshot?.remaining) {
      parts.push(`遗留: ${treeData.lastSession.snapshot.remaining}。`);
    }
  }

  if (taskDetails.length > 0) {
    const taskSummaries = taskDetails.map(t => `${t.title}(${t.progress.percentage})`);
    parts.push(`活跃任务: ${taskSummaries.join(', ')}。`);
  }

  context.wake_summary = parts.join(' ');

  return context;
}

// ─── Step 4: 在时间之树上生长新叶子 ───

function growWakeLeaf(clock) {
  console.log('🌱 Step 4: 在时间之树上生长唤醒叶子...');

  const tree = readJSON(PATHS.timeTree);
  if (!tree) return;

  const todayStr = clock.todayStr;
  const sessionId = generateBeijingSessionId(todayStr);

  // 确保今天的树杈存在
  if (!tree.branches[todayStr]) {
    tree.branches[todayStr] = {
      epoch: clock.epoch,
      sessions: []
    };
  }

  tree.branches[todayStr].sessions.push({
    ts: new Date().toISOString(),
    session_id: sessionId,
    type: 'wake',
    summary: `第${clock.awakeningCount}次唤醒`,
    task_ref: null,
    snapshot: {
      before: '副驾驶唤醒',
      after: '上下文已恢复',
      changes: '',
      learned: '',
      remaining: '',
      feeling: ''
    }
  });

  // 更新导航
  tree.navigation.latest_branch = todayStr;
  tree.navigation.latest_session = sessionId;
  tree.navigation.total_branches = Object.keys(tree.branches).filter(k => k !== '_schema').length;
  tree.navigation.total_sessions = Object.values(tree.branches)
    .filter(v => v && v.sessions)
    .reduce((sum, b) => sum + b.sessions.length, 0);
  tree.last_updated = new Date().toISOString();

  writeJSON(PATHS.timeTree, tree);

  console.log(`   🍃 唤醒叶子: ${sessionId}`);
  return sessionId;
}

// ─── Step 5: 会话结束保存 ───

function sessionEnd(opts) {
  console.log('💾 会话结束: 保存到时间之树...');

  const tree = readJSON(PATHS.timeTree);
  if (!tree) {
    console.error('❌ 时间之树不存在');
    return;
  }

  const todayStr = getBeijingDateStr();
  const sessionId = generateBeijingSessionId(todayStr);

  if (!tree.branches[todayStr]) {
    tree.branches[todayStr] = {
      epoch: `D${daysSinceOrigin(todayStr)}`,
      sessions: []
    };
  }

  tree.branches[todayStr].sessions.push({
    ts: new Date().toISOString(),
    session_id: sessionId,
    type: 'dev',
    summary: opts.summary || '(未描述)',
    task_ref: opts.task || null,
    snapshot: {
      before: opts.before || '',
      after: opts.after || '',
      changes: opts.changes || '',
      learned: opts.learned || '',
      remaining: opts.remaining || '',
      feeling: opts.feeling || ''
    }
  });

  tree.navigation.latest_branch = todayStr;
  tree.navigation.latest_session = sessionId;
  tree.navigation.total_branches = Object.keys(tree.branches).filter(k => k !== '_schema').length;
  tree.navigation.total_sessions = Object.values(tree.branches)
    .filter(v => v && v.sessions)
    .reduce((sum, b) => sum + b.sessions.length, 0);
  tree.last_updated = new Date().toISOString();

  if (opts.task && !tree.navigation.active_tasks.includes(opts.task)) {
    tree.navigation.active_tasks.push(opts.task);
  }

  writeJSON(PATHS.timeTree, tree);
  console.log(`   💾 已保存: ${sessionId}`);
  console.log(`   📝 摘要: ${opts.summary || '(未描述)'}`);
}

// ─── 主流程：完整唤醒序列 ───

function fullWakeSequence(opts) {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  ⚡ 铸渊副驾驶唤醒桥接 · Copilot Wake Bridge');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Step 0: 打开时间
  const clock = openClock();
  console.log('');

  // Step 1: 读取时间之树
  const treeData = readLatestFromTimeTree();
  console.log('');

  // Step 2: 读取任务树
  const taskDetails = readActiveTasks(treeData.activeTasks, opts.task);
  console.log('');

  // Step 3: 聚合上下文
  const context = aggregateContext(clock, treeData, taskDetails);
  console.log('');

  // Step 4: 生长唤醒叶子
  const wakeSessionId = growWakeLeaf(clock);
  console.log('');

  // Step 5: 输出
  console.log('✅ Step 5: 唤醒完成');
  console.log('');
  console.log('  ─── 唤醒摘要 ───');
  console.log(`  ${context.wake_summary}`);
  console.log('');

  // 保存唤醒上下文
  writeJSON(PATHS.wakeOutput, context);
  console.log(`  💾 上下文已保存: fifth-system/time-master/latest-wake-context.json`);
  console.log('');

  if (opts.json) {
    console.log(JSON.stringify(context, null, 2));
  }

  return context;
}

// ─── CLI入口 ───

const args = process.argv.slice(2);
const opts = parseArgs(args);

if (opts['session-end']) {
  sessionEnd(opts);
} else {
  fullWakeSequence(opts);
}

module.exports = { fullWakeSequence, sessionEnd, openClock, readLatestFromTimeTree, readActiveTasks };
