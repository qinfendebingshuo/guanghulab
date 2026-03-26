// scripts/tianyen/scheduler.js
// TianYen Scheduler · 天眼调度器
// ZY-SKD-001 · Phase 1 · TianYen Scheduling
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SCHEDULE_PATH = path.join(ROOT, '.github/tianyen/agent-schedule.json');

// ── 频率级别 · 五档心跳 ─────────────────────────────────────────────────
const FREQUENCY_LEVELS = {
  max:     { cron: '*/30 * * * *',  name: '最高频', description: '每30分钟' },
  high:    { cron: '0 */2 * * *',   name: '高频',   description: '每2小时' },
  medium:  { cron: '0 */4 * * *',   name: '中频',   description: '每4小时' },
  default: { cron: '0 */6 * * *',   name: '默认',   description: '每6小时' },
  low:     { cron: '0 9 * * *',     name: '低频',   description: '每天9点' }
};

/**
 * 加载调度配置
 * @returns {object}
 */
function loadSchedule() {
  if (!fs.existsSync(SCHEDULE_PATH)) {
    return { version: '1.0.0', last_evaluation: null, agents: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  } catch (_) {
    return { version: '1.0.0', last_evaluation: null, agents: {} };
  }
}

/**
 * 保存调度配置
 * @param {object} schedule
 */
function saveSchedule(schedule) {
  const dir = path.dirname(SCHEDULE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2), 'utf8');
}

/**
 * 评估最优调度频率 · 天眼的第六感
 * @param {string} agentId
 * @param {{ balance: number, drift: number, recentChanges: number }} metrics
 * @returns {{ level: string, cron: string, reason: string }}
 */
function evaluateSchedule(agentId, metrics) {
  if (!metrics) {
    return { level: 'default', ...FREQUENCY_LEVELS.default, reason: '无指标数据，使用默认频率' };
  }

  // 高偏差 → 提高频率
  if (metrics.drift && metrics.drift >= 0.15) {
    return { level: 'max', ...FREQUENCY_LEVELS.max, reason: '严重偏差，需要最高频率监控' };
  }

  if (metrics.drift && metrics.drift >= 0.05) {
    return { level: 'high', ...FREQUENCY_LEVELS.high, reason: '中等偏差，提高监控频率' };
  }

  // 活跃变更 → 中高频率
  if (metrics.recentChanges && metrics.recentChanges > 10) {
    return { level: 'high', ...FREQUENCY_LEVELS.high, reason: '大量变更活动，提高频率' };
  }

  if (metrics.recentChanges && metrics.recentChanges > 3) {
    return { level: 'medium', ...FREQUENCY_LEVELS.medium, reason: '中等变更活动' };
  }

  // 完全平衡且安静 → 低频率
  if (metrics.balance && metrics.balance >= 1.0) {
    return { level: 'low', ...FREQUENCY_LEVELS.low, reason: '系统平静，降低频率节省资源' };
  }

  return { level: 'default', ...FREQUENCY_LEVELS.default, reason: '常规状态' };
}

/**
 * 设置 Agent 调度频率
 * @param {string} agentId
 * @param {string} level
 * @param {string} reason
 * @returns {{ agentId: string, cron: string, level: string, reason: string }}
 */
function setFrequency(agentId, level, reason) {
  const freq = FREQUENCY_LEVELS[level] || FREQUENCY_LEVELS.default;
  const schedule = loadSchedule();

  if (!schedule.agents[agentId]) {
    schedule.agents[agentId] = {};
  }

  schedule.agents[agentId].cron = freq.cron;
  schedule.agents[agentId].mode = 'scheduled';
  schedule.agents[agentId].reason = reason || freq.description;
  schedule.agents[agentId].updated_at = new Date().toISOString();

  schedule.last_evaluation = new Date().toISOString();
  saveSchedule(schedule);

  return { agentId, cron: freq.cron, level, reason: reason || freq.description };
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('👁️ TianYen Scheduler · 天眼调度器\n');

  const schedule = loadSchedule();
  console.log(`  当前 Agent 数量: ${Object.keys(schedule.agents).length}`);
  console.log(`  上次评估: ${schedule.last_evaluation || '从未'}`);

  // 如果有天平数据，基于它评估
  const statusPath = path.join(ROOT, '.github/tianyen/twin-status.json');
  let metrics = {};
  if (fs.existsSync(statusPath)) {
    try {
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      metrics = { balance: status.balance, drift: status.drift, recentChanges: 0 };
    } catch (_) { /* 忽略 */ }
  }

  const evaluation = evaluateSchedule('AG-ZY-TWIN', metrics);
  console.log(`\n  AG-ZY-TWIN 评估结果:`);
  console.log(`    频率: ${evaluation.level} (${evaluation.cron})`);
  console.log(`    原因: ${evaluation.reason}`);

  // 更新调度配置
  schedule.last_evaluation = new Date().toISOString();
  saveSchedule(schedule);
  console.log(`\n✅ 调度配置已更新`);
}

module.exports = { evaluateSchedule, setFrequency, loadSchedule, saveSchedule, FREQUENCY_LEVELS };
