#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/work-order-manager.js
// 📋 铸渊智能运维 · 工单管理器
//
// 管理开发任务的完整生命周期:
//   创建 → 部署中 → 测试中 → 成功/失败/需人工干预
//
// 用法:
//   node work-order-manager.js create --title "..." --commit "sha"
//   node work-order-manager.js update --id "WO-xxx" --status "testing"
//   node work-order-manager.js retry --id "WO-xxx" --log "错误信息"
//   node work-order-manager.js archive --id "WO-xxx"
//   node work-order-manager.js list [--status active|archived|all]
//   node work-order-manager.js dashboard
//
// 状态流转:
//   pending → deploying → testing → success → archived
//                                 → failed → retrying(1-3) → needs-human
// ═══════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACTIVE_FILE = path.join(ROOT, 'data/work-orders/active.json');
const ARCHIVE_DIR = path.join(ROOT, 'data/work-orders/archive');

const MAX_RETRIES = 3;

// ── 状态定义 ────────────────────────────────
const STATUSES = {
  pending:      { label: '⏳ 待部署', responsible: 'Agent', next: ['deploying'] },
  deploying:    { label: '🚀 部署中', responsible: 'Agent', next: ['testing', 'failed'] },
  testing:      { label: '🔍 测试中', responsible: 'Agent', next: ['success', 'failed'] },
  success:      { label: '✅ 成功',   responsible: 'Agent', next: ['archived'] },
  failed:       { label: '❌ 失败',   responsible: 'Agent', next: ['retrying'] },
  retrying:     { label: '🔄 重试中', responsible: 'Agent', next: ['testing', 'needs-human'] },
  'needs-human':{ label: '🆘 需人工', responsible: '冰朔',  next: ['pending'] },
  archived:     { label: '📦 已归档', responsible: '-',     next: [] }
};

// ── 加载工单数据 ────────────────────────────
function loadOrders() {
  try {
    return JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8'));
  } catch {
    return { _meta: { version: '1.0' }, orders: [] };
  }
}

// ── 保存工单数据 ────────────────────────────
function saveOrders(data) {
  fs.writeFileSync(ACTIVE_FILE, JSON.stringify(data, null, 2) + '\n');
}

// ── 生成工单ID ──────────────────────────────
function generateId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toISOString().slice(11, 16).replace(':', '');
  return `WO-${date}-${time}`;
}

// ── 创建工单 ────────────────────────────────
function createOrder(args) {
  const data = loadOrders();
  const title = args.title || '未命名任务';
  const commit = args.commit || 'unknown';
  const branch = args.branch || 'main';
  const actor = args.actor || 'copilot';

  const order = {
    id: generateId(),
    title,
    status: 'pending',
    commit_sha: commit,
    branch,
    created_by: actor,
    responsible: 'Agent',
    retry_count: 0,
    max_retries: MAX_RETRIES,
    timeline: [
      {
        timestamp: new Date().toISOString(),
        status: 'pending',
        actor: 'system',
        message: `工单创建 · ${title}`
      }
    ],
    deploy_logs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  data.orders.push(order);
  saveOrders(data);
  console.log(`✅ 工单已创建: ${order.id}`);
  console.log(`   标题: ${title}`);
  console.log(`   提交: ${commit.slice(0, 8)}`);
  // 输出ID供workflow使用
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `order_id=${order.id}\n`);
  }
  return order;
}

// ── 更新工单状态 ────────────────────────────
function updateOrder(args) {
  const data = loadOrders();
  const order = data.orders.find(o => o.id === args.id);
  if (!order) {
    console.error(`❌ 工单不存在: ${args.id}`);
    process.exit(1);
  }

  const newStatus = args.status;
  const statusDef = STATUSES[order.status];

  if (statusDef && !statusDef.next.includes(newStatus) && newStatus !== order.status) {
    // 宽松检查: 允许跳转但记录警告
    console.warn(`⚠️ 状态跳转 ${order.status} → ${newStatus} 不在标准流程中`);
  }

  order.status = newStatus;
  order.responsible = STATUSES[newStatus]?.responsible || 'Agent';
  order.updated_at = new Date().toISOString();
  order.timeline.push({
    timestamp: new Date().toISOString(),
    status: newStatus,
    actor: args.actor || 'Agent',
    message: args.message || `状态更新为 ${STATUSES[newStatus]?.label || newStatus}`
  });

  if (args.log) {
    order.deploy_logs.push({
      timestamp: new Date().toISOString(),
      content: args.log
    });
  }

  saveOrders(data);
  console.log(`✅ 工单 ${order.id} 已更新: ${STATUSES[newStatus]?.label || newStatus}`);
  return order;
}

// ── 重试工单 ────────────────────────────────
function retryOrder(args) {
  const data = loadOrders();
  const order = data.orders.find(o => o.id === args.id);
  if (!order) {
    console.error(`❌ 工单不存在: ${args.id}`);
    process.exit(1);
  }

  order.retry_count += 1;
  order.updated_at = new Date().toISOString();

  if (args.log) {
    order.deploy_logs.push({
      timestamp: new Date().toISOString(),
      content: `[重试 #${order.retry_count}] ${args.log}`
    });
  }

  if (order.retry_count >= MAX_RETRIES) {
    order.status = 'needs-human';
    order.responsible = '冰朔';
    order.timeline.push({
      timestamp: new Date().toISOString(),
      status: 'needs-human',
      actor: 'Agent',
      message: `已重试${order.retry_count}次仍未解决 · 需要人工干预`
    });
    console.log(`🆘 工单 ${order.id} 已达最大重试次数(${MAX_RETRIES}) · 需要冰朔人工干预`);
    // 输出标记供workflow使用
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `needs_human=true\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `retry_count=${order.retry_count}\n`);
    }
  } else {
    order.status = 'retrying';
    order.responsible = 'Agent';
    order.timeline.push({
      timestamp: new Date().toISOString(),
      status: 'retrying',
      actor: 'Agent',
      message: `第${order.retry_count}次重试 · 最多${MAX_RETRIES}次`
    });
    console.log(`🔄 工单 ${order.id} 第${order.retry_count}次重试 (最多${MAX_RETRIES}次)`);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `needs_human=false\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `retry_count=${order.retry_count}\n`);
    }
  }

  saveOrders(data);
  return order;
}

// ── 归档工单 ────────────────────────────────
function archiveOrder(args) {
  const data = loadOrders();
  const idx = data.orders.findIndex(o => o.id === args.id);
  if (idx === -1) {
    console.error(`❌ 工单不存在: ${args.id}`);
    process.exit(1);
  }

  const order = data.orders[idx];
  order.status = 'archived';
  order.archived_at = new Date().toISOString();
  order.timeline.push({
    timestamp: new Date().toISOString(),
    status: 'archived',
    actor: args.actor || 'Agent',
    message: '任务归档完成'
  });

  // 确保归档目录存在
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  // 移到归档目录
  const month = new Date().toISOString().slice(0, 7);
  const archiveFile = path.join(ARCHIVE_DIR, `${month}.json`);
  let archive = [];
  try {
    archive = JSON.parse(fs.readFileSync(archiveFile, 'utf8'));
  } catch { /* 新月份 */ }
  archive.push(order);
  fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2) + '\n');

  // 从活跃列表移除
  data.orders.splice(idx, 1);
  saveOrders(data);

  console.log(`📦 工单 ${order.id} 已归档`);
  return order;
}

// ── 列出工单 ────────────────────────────────
function listOrders(args) {
  const filter = args.status || 'active';
  const data = loadOrders();

  let orders = data.orders;
  if (filter === 'active') {
    orders = orders.filter(o => o.status !== 'archived');
  }

  if (orders.length === 0) {
    console.log('📋 没有活跃工单');
    return;
  }

  console.log(`📋 工单列表 (${filter}):`);
  console.log('─'.repeat(70));
  for (const o of orders) {
    const statusDef = STATUSES[o.status] || { label: o.status };
    console.log(`  ${o.id} │ ${statusDef.label.padEnd(8)} │ ${o.title.slice(0, 30).padEnd(30)} │ 负责: ${o.responsible}`);
    if (o.retry_count > 0) {
      console.log(`         │ 重试: ${o.retry_count}/${o.max_retries}次`);
    }
  }
  console.log('─'.repeat(70));
}

// ── 生成仪表盘数据 ──────────────────────────
function generateDashboard() {
  const data = loadOrders();

  // 统计活跃工单
  const stats = {
    total: data.orders.length,
    pending: 0, deploying: 0, testing: 0,
    success: 0, failed: 0, retrying: 0,
    'needs-human': 0, archived: 0
  };

  for (const o of data.orders) {
    stats[o.status] = (stats[o.status] || 0) + 1;
  }

  // 读取归档统计
  let archivedTotal = 0;
  try {
    const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const archive = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, f), 'utf8'));
      archivedTotal += archive.length;
    }
  } catch { /* no archives */ }

  const dashboard = {
    generated_at: new Date().toISOString(),
    summary: {
      active_orders: data.orders.length,
      archived_total: archivedTotal,
      needs_attention: stats['needs-human'] + stats.failed,
      in_progress: stats.deploying + stats.testing + stats.retrying
    },
    active_orders: data.orders.map(o => ({
      id: o.id,
      title: o.title,
      status: o.status,
      status_label: STATUSES[o.status]?.label || o.status,
      responsible: o.responsible,
      retry_count: o.retry_count,
      max_retries: o.max_retries,
      created_at: o.created_at,
      updated_at: o.updated_at,
      last_event: o.timeline[o.timeline.length - 1]?.message || ''
    })),
    status_definitions: Object.fromEntries(
      Object.entries(STATUSES).map(([k, v]) => [k, { label: v.label, responsible: v.responsible }])
    )
  };

  const dashboardFile = path.join(ROOT, 'data/work-orders/dashboard.json');
  fs.writeFileSync(dashboardFile, JSON.stringify(dashboard, null, 2) + '\n');
  console.log('📊 仪表盘数据已生成: data/work-orders/dashboard.json');

  // 同时输出Markdown摘要
  console.log('');
  console.log('## 📋 铸渊工单仪表盘');
  console.log('');
  console.log(`| 指标 | 数量 |`);
  console.log(`|------|------|`);
  console.log(`| 📋 活跃工单 | ${dashboard.summary.active_orders} |`);
  console.log(`| 🚨 需关注 | ${dashboard.summary.needs_attention} |`);
  console.log(`| 🔄 进行中 | ${dashboard.summary.in_progress} |`);
  console.log(`| 📦 历史归档 | ${dashboard.summary.archived_total} |`);

  if (data.orders.length > 0) {
    console.log('');
    console.log('| 工单ID | 状态 | 标题 | 负责方 | 重试 |');
    console.log('|--------|------|------|--------|------|');
    for (const o of data.orders) {
      const statusLabel = STATUSES[o.status]?.label || o.status;
      console.log(`| ${o.id} | ${statusLabel} | ${o.title.slice(0, 25)} | ${o.responsible} | ${o.retry_count}/${o.max_retries} |`);
    }
  }

  return dashboard;
}

// ── 命令行解析 ──────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const params = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      params[key] = args[i + 1] || '';
      i++;
    }
  }

  return { cmd, ...params };
}

// ── 主入口 ──────────────────────────────────
const args = parseArgs();

switch (args.cmd) {
  case 'create':
    createOrder(args);
    break;
  case 'update':
    updateOrder(args);
    break;
  case 'retry':
    retryOrder(args);
    break;
  case 'archive':
    archiveOrder(args);
    break;
  case 'list':
    listOrders(args);
    break;
  case 'dashboard':
    generateDashboard();
    break;
  default:
    console.log('📋 铸渊工单管理器');
    console.log('');
    console.log('用法:');
    console.log('  node work-order-manager.js create --title "任务标题" --commit "sha"');
    console.log('  node work-order-manager.js update --id "WO-xxx" --status "testing"');
    console.log('  node work-order-manager.js retry --id "WO-xxx" --log "错误信息"');
    console.log('  node work-order-manager.js archive --id "WO-xxx"');
    console.log('  node work-order-manager.js list [--status active|all]');
    console.log('  node work-order-manager.js dashboard');
    break;
}
