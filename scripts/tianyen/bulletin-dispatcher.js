// scripts/tianyen/bulletin-dispatcher.js
// Bulletin Dispatcher · 公告分发器
// ZY-SKD-006 · Phase 1 · TianYen Scheduling
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TIANYEN_DIR = path.join(ROOT, '.github/tianyen');
const DISPATCH_PATH = path.join(TIANYEN_DIR, 'bulletin-dispatch.json');

/**
 * 采集所有 Agent 状态
 * @returns {object[]}
 */
function collectAllAgentStatus() {
  const statuses = [];

  // 签到记录
  const checkinPath = path.join(TIANYEN_DIR, 'checkin-log.json');
  if (fs.existsSync(checkinPath)) {
    try {
      const log = JSON.parse(fs.readFileSync(checkinPath, 'utf8'));
      for (const [agentId, record] of Object.entries(log.checkins || {})) {
        statuses.push({
          agentId,
          status: record.status || 'unknown',
          lastSeen: record.timestamp || null
        });
      }
    } catch (_) { /* 忽略 */ }
  }

  // 调度配置
  const schedulePath = path.join(TIANYEN_DIR, 'agent-schedule.json');
  if (fs.existsSync(schedulePath)) {
    try {
      const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
      for (const [agentId, config] of Object.entries(schedule.agents || {})) {
        const existing = statuses.find(s => s.agentId === agentId);
        if (existing) {
          existing.schedule = config;
        } else {
          statuses.push({ agentId, status: 'configured', lastSeen: null, schedule: config });
        }
      }
    } catch (_) { /* 忽略 */ }
  }

  return statuses;
}

/**
 * 评估需要唤醒的 Agent
 * @param {object} globalState - 包含 statuses 数组
 * @returns {string[]} 需要唤醒的 Agent ID 列表
 */
function evaluateWakeTargets(globalState) {
  const targets = [];
  const now = Date.now();

  for (const agent of (globalState.statuses || [])) {
    // 事件驱动型不主动唤醒
    if (agent.schedule && agent.schedule.mode === 'event_driven') {
      continue;
    }

    // 超过最大间隔未活动 → 唤醒
    if (agent.lastSeen) {
      const lastSeen = new Date(agent.lastSeen).getTime();
      const maxInterval = 24 * 60 * 60 * 1000; // 默认 24h
      if (now - lastSeen > maxInterval) {
        targets.push(agent.agentId);
      }
    }
  }

  return targets;
}

/**
 * 生成公告条目
 * @param {string} agentId
 * @param {number} priority - 1(紧急) ~ 5(常规)
 * @param {string} context
 * @returns {object}
 */
function generateBulletinEntry(agentId, priority, context) {
  return {
    id: `DISP-${Date.now()}-${agentId}`,
    timestamp: new Date().toISOString(),
    agentId,
    priority: priority || 3,
    context: context || '天眼调度唤醒',
    status: 'pending'
  };
}

/**
 * 完整分发流程
 * @returns {object}
 */
function dispatch() {
  const statuses = collectAllAgentStatus();
  const wakeTargets = evaluateWakeTargets({ statuses });
  const entries = [];

  for (const agentId of wakeTargets) {
    entries.push(generateBulletinEntry(agentId, 2, '超时唤醒'));
  }

  // 加载现有分发数据
  let dispatchData = { version: '1.0.0', bulletin: [] };
  if (fs.existsSync(DISPATCH_PATH)) {
    try {
      dispatchData = JSON.parse(fs.readFileSync(DISPATCH_PATH, 'utf8'));
      if (!Array.isArray(dispatchData.bulletin)) {
        dispatchData.bulletin = [];
      }
    } catch (_) {
      dispatchData = { version: '1.0.0', bulletin: [] };
    }
  }

  // 追加新条目
  dispatchData.bulletin.push(...entries);

  // 保留最近 100 条
  if (dispatchData.bulletin.length > 100) {
    dispatchData.bulletin = dispatchData.bulletin.slice(-100);
  }

  // 保存
  if (!fs.existsSync(TIANYEN_DIR)) {
    fs.mkdirSync(TIANYEN_DIR, { recursive: true });
  }
  fs.writeFileSync(DISPATCH_PATH, JSON.stringify(dispatchData, null, 2), 'utf8');

  return {
    timestamp: new Date().toISOString(),
    agentCount: statuses.length,
    wakeTargets,
    dispatched: entries.length
  };
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('👁️ TianYen Bulletin Dispatcher · 公告分发器\n');

  const result = dispatch();
  console.log(`  Agent 总数: ${result.agentCount}`);
  console.log(`  唤醒目标: ${result.wakeTargets.length}`);
  console.log(`  已分发: ${result.dispatched}`);
  console.log('\n✅ 分发完成');
}

module.exports = { collectAllAgentStatus, evaluateWakeTargets, generateBulletinEntry, dispatch };
