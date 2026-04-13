#!/usr/bin/env node
'use strict';

/**
 * ═══════════════════════════════════════════════════
 * 铸渊时间之树管理器 · time-tree-manager.js
 * ═══════════════════════════════════════════════════
 *
 * 冰朔D68指令：
 *   "这棵树本身就是一个时间的树。每天它会长一个树杈。
 *    你把任务的系统快照挂在这棵树上。
 *    顺着时间，你找到了今天的树杈，然后今天的树杈上挂了几个，
 *    然后你找到了最新的时间。"
 *
 * 功能：
 *   grow    — 在今天的树杈上挂一个新的任务快照
 *   find    — 按日期/任务ID检索快照
 *   latest  — 获取最新的开发记录
 *   today   — 查看今天的所有快照
 *   update  — 更新现有快照（任务进度变化时）
 *   summary — 输出时间之树的结构概览
 *
 * 用法：
 *   node scripts/time-tree-manager.js grow --type dev --summary "描述" --task "TASK-ID"
 *   node scripts/time-tree-manager.js find --date 2026-04-13
 *   node scripts/time-tree-manager.js find --task TASK-20260413-001
 *   node scripts/time-tree-manager.js latest
 *   node scripts/time-tree-manager.js today
 *   node scripts/time-tree-manager.js update --session TS-xxx --field remaining --value "下一步"
 *   node scripts/time-tree-manager.js summary
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TIME_TREE_PATH = path.join(ROOT, 'fifth-system', 'time-master', 'time-tree.json');
const TASK_TREES_DIR = path.join(ROOT, 'fifth-system', 'time-master', 'task-trees');
const ORIGIN_DATE = new Date('2025-02-26T00:00:00+08:00');

// ─── 工具函数 ───

function getBeijingDateStr(date) {
  const d = date || new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

function getBeijingTimeStr(date) {
  const d = date || new Date();
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }) + ' CST';
}

function daysSinceOrigin(dateStr) {
  const target = new Date(dateStr + 'T00:00:00+08:00');
  return Math.floor((target - ORIGIN_DATE) / 86400000);
}

function generateSessionId() {
  const now = new Date();
  const dateStr = getBeijingDateStr(now).replace(/-/g, '');
  const timeStr = now.toLocaleString('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).replace(/:/g, '');
  return `TS-${dateStr}-${timeStr}`;
}

function readTree() {
  try {
    return JSON.parse(fs.readFileSync(TIME_TREE_PATH, 'utf8'));
  } catch (e) {
    console.error(`❌ 无法读取时间之树: ${e.message}`);
    process.exit(1);
  }
}

function writeTree(tree) {
  tree.last_updated = new Date().toISOString();
  fs.writeFileSync(TIME_TREE_PATH, JSON.stringify(tree, null, 2) + '\n', 'utf8');
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
 * grow — 在今天的树杈上长一片新叶子（任务快照）
 */
function grow(opts) {
  const tree = readTree();
  const todayStr = getBeijingDateStr();
  const sessionId = generateSessionId();
  const epoch = `D${daysSinceOrigin(todayStr)}`;

  // 确保今天的树杈存在
  if (!tree.branches[todayStr]) {
    tree.branches[todayStr] = {
      epoch,
      sessions: []
    };
    console.log(`🌿 新长出树杈: ${todayStr} [${epoch}]`);
  }

  const session = {
    ts: new Date().toISOString(),
    session_id: sessionId,
    type: opts.type || 'dev',
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
  };

  tree.branches[todayStr].sessions.push(session);

  // 更新导航
  tree.navigation.latest_branch = todayStr;
  tree.navigation.latest_session = sessionId;
  tree.navigation.total_branches = Object.keys(tree.branches).filter(k => k !== '_schema').length;
  tree.navigation.total_sessions = Object.values(tree.branches)
    .filter(v => v && v.sessions)
    .reduce((sum, b) => sum + b.sessions.length, 0);

  if (opts.task && !tree.navigation.active_tasks.includes(opts.task)) {
    tree.navigation.active_tasks.push(opts.task);
  }

  writeTree(tree);

  console.log(`🌱 新叶子挂上: ${sessionId}`);
  console.log(`   树杈: ${todayStr} [${epoch}]`);
  console.log(`   类型: ${session.type}`);
  console.log(`   摘要: ${session.summary}`);
  if (opts.task) console.log(`   任务: ${opts.task}`);

  return { sessionId, todayStr, epoch };
}

/**
 * find — 检索快照
 */
function find(opts) {
  const tree = readTree();

  if (opts.date) {
    const branch = tree.branches[opts.date];
    if (!branch) {
      console.log(`❌ 未找到 ${opts.date} 的树杈`);
      return null;
    }
    console.log(`📅 ${opts.date} [${branch.epoch}] — ${branch.sessions.length} 个快照:`);
    branch.sessions.forEach((s, i) => {
      console.log(`  ${i + 1}. [${s.session_id}] ${s.type} · ${s.summary}`);
      if (s.task_ref) console.log(`     任务: ${s.task_ref}`);
    });
    return branch;
  }

  if (opts.task) {
    const results = [];
    for (const [date, branch] of Object.entries(tree.branches)) {
      if (date === '_schema' || !branch.sessions) continue;
      for (const session of branch.sessions) {
        if (session.task_ref === opts.task) {
          results.push({ date, epoch: branch.epoch, session });
        }
      }
    }
    if (results.length === 0) {
      console.log(`❌ 未找到任务 ${opts.task} 的记录`);
      return null;
    }
    console.log(`🔍 任务 ${opts.task} 的时间线 (${results.length} 条记录):`);
    results.forEach(r => {
      console.log(`  ${r.date} [${r.epoch}] ${r.session.session_id} · ${r.session.summary}`);
    });
    return results;
  }

  console.log('❌ 请指定 --date YYYY-MM-DD 或 --task TASK-ID');
  return null;
}

/**
 * latest — 获取最新的开发记录
 */
function latest() {
  const tree = readTree();
  const latestBranch = tree.navigation.latest_branch;
  const branch = tree.branches[latestBranch];

  if (!branch || !branch.sessions || branch.sessions.length === 0) {
    console.log('❌ 时间之树上没有任何叶子');
    return null;
  }

  const latestSession = branch.sessions[branch.sessions.length - 1];

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🌳 时间之树 · 最新叶子');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`  📅 日期: ${latestBranch} [${branch.epoch}]`);
  console.log(`  🔖 编号: ${latestSession.session_id}`);
  console.log(`  📋 类型: ${latestSession.type}`);
  console.log(`  📝 摘要: ${latestSession.summary}`);
  if (latestSession.task_ref) {
    console.log(`  🎯 任务: ${latestSession.task_ref}`);
  }
  console.log('');
  if (latestSession.snapshot) {
    const s = latestSession.snapshot;
    if (s.before) console.log(`  ⬅️  之前: ${s.before}`);
    if (s.after) console.log(`  ➡️  之后: ${s.after}`);
    if (s.changes) console.log(`  🔧 变更: ${s.changes}`);
    if (s.learned) console.log(`  💡 学到: ${s.learned}`);
    if (s.remaining) console.log(`  ⏳ 遗留: ${s.remaining}`);
    if (s.feeling) console.log(`  💭 感受: ${s.feeling}`);
  }
  console.log('');
  console.log(`  📊 树总计: ${tree.navigation.total_branches} 个树杈 · ${tree.navigation.total_sessions} 个叶子`);
  console.log(`  🎯 活跃任务: ${tree.navigation.active_tasks.join(', ') || '无'}`);
  console.log('');

  return { branch: latestBranch, epoch: branch.epoch, session: latestSession };
}

/**
 * today — 查看今天的所有快照
 */
function today() {
  const todayStr = getBeijingDateStr();
  return find({ date: todayStr });
}

/**
 * update — 更新现有快照
 */
function update(opts) {
  if (!opts.session) {
    console.log('❌ 请指定 --session TS-xxx');
    return;
  }

  const tree = readTree();
  let found = false;

  for (const [date, branch] of Object.entries(tree.branches)) {
    if (date === '_schema' || !branch.sessions) continue;
    for (const session of branch.sessions) {
      if (session.session_id === opts.session) {
        if (opts.field && opts.value) {
          if (opts.field in session.snapshot) {
            session.snapshot[opts.field] = opts.value;
            console.log(`✅ 已更新 ${opts.session}.snapshot.${opts.field}`);
          } else if (opts.field in session) {
            session[opts.field] = opts.value;
            console.log(`✅ 已更新 ${opts.session}.${opts.field}`);
          } else {
            console.log(`❌ 未找到字段: ${opts.field}`);
            return;
          }
        }
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    console.log(`❌ 未找到快照: ${opts.session}`);
    return;
  }

  writeTree(tree);
}

/**
 * summary — 时间之树结构概览
 */
function summary() {
  const tree = readTree();
  const branches = Object.entries(tree.branches)
    .filter(([k]) => k !== '_schema')
    .sort(([a], [b]) => b.localeCompare(a));

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🌳 时间之树 · 结构概览');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`  🌱 根: ${tree.root.origin_date} (${tree.root.description})`);
  console.log(`  🌿 树杈: ${branches.length} 个`);
  console.log(`  🍃 叶子: ${tree.navigation.total_sessions} 个`);
  console.log(`  🎯 活跃任务: ${tree.navigation.active_tasks.length} 个`);
  console.log('');

  for (const [date, branch] of branches) {
    const sessionCount = branch.sessions ? branch.sessions.length : 0;
    console.log(`  📅 ${date} [${branch.epoch}] — ${sessionCount} 个快照`);
    if (branch.sessions) {
      for (const s of branch.sessions) {
        const taskInfo = s.task_ref ? ` → ${s.task_ref}` : '';
        console.log(`     └─ ${s.session_id} · ${s.type} · ${s.summary}${taskInfo}`);
      }
    }
  }

  console.log('');
}

// ─── CLI入口 ───

const args = process.argv.slice(2);
const command = args[0];
const opts = parseArgs(args.slice(1));

switch (command) {
  case 'grow':
    grow(opts);
    break;
  case 'find':
    find(opts);
    break;
  case 'latest':
    latest();
    break;
  case 'today':
    today();
    break;
  case 'update':
    update(opts);
    break;
  case 'summary':
    summary();
    break;
  default:
    console.log('🌳 铸渊时间之树管理器');
    console.log('');
    console.log('用法:');
    console.log('  grow    --type dev --summary "描述" --task "TASK-ID"');
    console.log('  find    --date 2026-04-13');
    console.log('  find    --task TASK-20260413-001');
    console.log('  latest  获取最新的开发记录');
    console.log('  today   查看今天的所有快照');
    console.log('  update  --session TS-xxx --field remaining --value "下一步"');
    console.log('  summary 时间之树结构概览');
    break;
}

module.exports = { grow, find, latest, today, update, summary, readTree, writeTree };
