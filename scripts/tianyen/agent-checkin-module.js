// scripts/tianyen/agent-checkin-module.js
// Agent Checkin Module · 通用签到模块
// ZY-SKD-004 · Phase 1 · TianYen Scheduling
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CHECKIN_LOG_PATH = path.join(ROOT, '.github/tianyen/checkin-log.json');

/**
 * 读取签到记录
 * @returns {{ version: string, checkins: object }}
 */
function loadCheckinLog() {
  if (!fs.existsSync(CHECKIN_LOG_PATH)) {
    return { version: '1.0.0', checkins: {} };
  }
  try {
    const data = JSON.parse(fs.readFileSync(CHECKIN_LOG_PATH, 'utf8'));
    if (!data.checkins) data.checkins = {};
    return data;
  } catch (_) {
    return { version: '1.0.0', checkins: {} };
  }
}

/**
 * 保存签到记录
 * @param {object} log
 */
function saveCheckinLog(log) {
  const dir = path.dirname(CHECKIN_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CHECKIN_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
}

/**
 * 签到 · Agent 报到
 * @param {string} agentId
 * @returns {{ agentId: string, timestamp: string, status: string }}
 */
function checkin(agentId) {
  const log = loadCheckinLog();
  const timestamp = new Date().toISOString();

  log.checkins[agentId] = {
    timestamp,
    status: 'running',
    checkin_at: timestamp,
    checkout_at: null,
    metrics: {}
  };

  saveCheckinLog(log);

  return { agentId, timestamp, status: 'running' };
}

/**
 * 签退 · Agent 收工
 * @param {string} agentId
 * @param {string} status - 'success' | 'failure' | 'cancelled'
 * @param {object} metrics
 * @returns {{ agentId: string, timestamp: string, status: string, duration: number|null }}
 */
function checkout(agentId, status, metrics) {
  const log = loadCheckinLog();
  const timestamp = new Date().toISOString();

  let duration = null;
  if (log.checkins[agentId] && log.checkins[agentId].checkin_at) {
    const start = new Date(log.checkins[agentId].checkin_at).getTime();
    duration = Date.now() - start;
  }

  if (!log.checkins[agentId]) {
    log.checkins[agentId] = {};
  }

  log.checkins[agentId].status = status || 'success';
  log.checkins[agentId].checkout_at = timestamp;
  log.checkins[agentId].timestamp = timestamp;
  log.checkins[agentId].duration = duration;
  log.checkins[agentId].metrics = metrics || {};

  saveCheckinLog(log);

  return { agentId, timestamp, status: status || 'success', duration };
}

/**
 * 获取最后一次签到记录
 * @param {string} agentId
 * @returns {object|null}
 */
function getLastCheckin(agentId) {
  const log = loadCheckinLog();
  return log.checkins[agentId] || null;
}

/**
 * 检测超时 · Agent 是否卡住了
 * @param {string} agentId
 * @param {number} maxDurationMs - 最大允许运行时间（默认 10 分钟）
 * @returns {{ timedOut: boolean, agentId: string, elapsed: number|null }}
 */
function detectTimeout(agentId, maxDurationMs) {
  const maxMs = (maxDurationMs !== undefined && maxDurationMs !== null) ? maxDurationMs : 600000;
  const log = loadCheckinLog();
  const record = log.checkins[agentId];

  if (!record || !record.checkin_at) {
    return { timedOut: false, agentId, elapsed: null };
  }

  // 只检查正在运行的 Agent
  if (record.status !== 'running') {
    return { timedOut: false, agentId, elapsed: null };
  }

  const elapsed = Date.now() - new Date(record.checkin_at).getTime();
  return {
    timedOut: elapsed >= maxMs,
    agentId,
    elapsed
  };
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const action = args[0];
  const agentId = args[1];

  if (!action || !agentId) {
    console.log('用法: node agent-checkin-module.js <checkin|checkout> <agentId> [status]');
    process.exit(0);
  }

  if (action === 'checkin') {
    const result = checkin(agentId);
    console.log(`📋 ${agentId} 签到: ${result.timestamp}`);
  } else if (action === 'checkout') {
    const status = args[2] || 'success';
    const result = checkout(agentId, status);
    console.log(`📋 ${agentId} 签退: ${result.status} (耗时 ${result.duration}ms)`);
  } else {
    console.log(`未知操作: ${action}`);
  }
}

module.exports = { checkin, checkout, getLastCheckin, detectTimeout, loadCheckinLog, saveCheckinLog };
