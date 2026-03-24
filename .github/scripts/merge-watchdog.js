#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// .github/scripts/merge-watchdog.js
// 👁️ Merge Watchdog · 合并指令看守者
//
// 看守者核心逻辑：
//  - 跟踪已合并的 auto-repair PR
//  - 验证修复是否生效
//  - 更新仪表盘记录
//  - 三振出局时准备告警数据
//
// 看守者五条铁律：
//  1. 看守者自身不修改代码 — 只观察、记录、通知
//  2. 最多重试 3 次 — 硬上限
//  3. 每轮修复策略必须不同
//  4. 邮件必须包含具体操作步骤
//  5. 成功后绝对静默 — 只更新仪表盘

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const WATCHDOG_DATA_PATH = path.join(ROOT, 'docs/dashboard/watchdog-records.json');
const DASHBOARD_PATH = path.join(ROOT, 'DASHBOARD.md');

// ━━━ 工具函数 ━━━

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getTimestamp() {
  return new Date().toISOString();
}

// ━━━ 看守记录管理 ━━━

function loadWatchdogRecords() {
  const data = loadJSON(WATCHDOG_DATA_PATH);
  if (data && data.records) return data;
  return {
    merge_watchdog: {
      last_updated: getTimestamp(),
      active_watches: 0,
      resolved_watches: 0,
      escalated_watches: 0
    },
    records: []
  };
}

function saveWatchdogRecords(data) {
  // Update counts
  data.merge_watchdog.last_updated = getTimestamp();
  data.merge_watchdog.active_watches = data.records.filter(r => r.status === 'watching').length;
  data.merge_watchdog.resolved_watches = data.records.filter(r => r.status === 'fixed').length;
  data.merge_watchdog.escalated_watches = data.records.filter(r => r.status === 'escalated').length;

  saveJSON(WATCHDOG_DATA_PATH, data);
}

// ━━━ 创建看守记录 ━━━

function createWatchRecord(prNumber, prTitle, targetWorkflows) {
  return {
    pr_number: prNumber,
    pr_title: prTitle,
    merged_at: getTimestamp(),
    target_workflows: targetWorkflows,
    retry_count: 0,
    max_retries: 3,
    status: 'watching',
    repair_strategies_used: ['standard'],
    last_check_time: null,
    resolution: null
  };
}

// ━━━ 记录修复成功（静默更新） ━━━

function recordSuccess(prNumber) {
  const data = loadWatchdogRecords();
  const record = data.records.find(r => r.pr_number === prNumber);

  if (record) {
    record.status = 'fixed';
    record.resolution = 'auto_fixed';
    record.last_check_time = getTimestamp();
  } else {
    data.records.push({
      pr_number: prNumber,
      status: 'fixed',
      resolved_at: getTimestamp(),
      resolution: 'auto_fixed',
      retry_count: 0
    });
  }

  saveWatchdogRecords(data);
  console.log(`✅ PR #${prNumber} 修复已确认生效 — 仪表盘已静默更新`);
}

// ━━━ 记录修复失败 ━━━

function recordFailure(prNumber, retryRound) {
  const data = loadWatchdogRecords();
  let record = data.records.find(r => r.pr_number === prNumber);

  if (!record) {
    record = createWatchRecord(prNumber, '', []);
    data.records.push(record);
  }

  record.retry_count = retryRound;
  record.last_check_time = getTimestamp();

  // Strategy names for each round
  const strategies = ['standard', 'deep_root_cause', 'conservative_fallback'];
  if (retryRound <= 3) {
    record.repair_strategies_used.push(strategies[retryRound - 1] || 'unknown');
  }

  if (retryRound >= 3) {
    record.status = 'escalated';
    record.resolution = 'human_intervention';
    console.log(`⛔ PR #${prNumber} 三振出局 — 需人类介入`);
  } else {
    record.status = 'watching';
    console.log(`🔄 PR #${prNumber} 第${retryRound}次失败 — 等待重试`);
  }

  saveWatchdogRecords(data);
}

// ━━━ 注册新的 watch ━━━

function registerWatch(prNumber, prTitle, targetWorkflows) {
  const data = loadWatchdogRecords();

  // Check if already watching
  const existing = data.records.find(r => r.pr_number === prNumber);
  if (existing) {
    console.log(`⚠️ PR #${prNumber} 已在看守列表中`);
    return;
  }

  const record = createWatchRecord(prNumber, prTitle, targetWorkflows);
  data.records.push(record);
  saveWatchdogRecords(data);
  console.log(`👁️ 开始看守 PR #${prNumber}: ${prTitle}`);
}

// ━━━ 获取看守状态 ━━━

function getWatchStatus(prNumber) {
  const data = loadWatchdogRecords();
  const record = data.records.find(r => r.pr_number === prNumber);
  return record || null;
}

// ━━━ CLI 入口 ━━━

function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  switch (action) {
    case 'register': {
      const prNumber = parseInt(args[1]);
      const prTitle = args[2] || '';
      const workflows = args[3] ? args[3].split(',') : [];
      registerWatch(prNumber, prTitle, workflows);
      break;
    }
    case 'success': {
      const prNumber = parseInt(args[1]);
      recordSuccess(prNumber);
      break;
    }
    case 'failure': {
      const prNumber = parseInt(args[1]);
      const retryRound = parseInt(args[2]) || 1;
      recordFailure(prNumber, retryRound);
      break;
    }
    case 'status': {
      const prNumber = parseInt(args[1]);
      const status = getWatchStatus(prNumber);
      console.log(JSON.stringify(status, null, 2));
      break;
    }
    case 'list': {
      const data = loadWatchdogRecords();
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    default: {
      console.log('Usage: merge-watchdog.js <action> [args]');
      console.log('Actions: register, success, failure, status, list');
    }
  }
}

main();
