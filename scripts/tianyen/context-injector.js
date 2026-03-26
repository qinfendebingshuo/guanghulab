// scripts/tianyen/context-injector.js
// Context Injector · 上下文注入器
// ZY-SKD-002 · Phase 1 · TianYen Scheduling
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TIANYEN_DIR = path.join(ROOT, '.github/tianyen');

/**
 * 采集全局状态 · 汇聚各路信号
 * @returns {object} 所有 Agent 的状态汇总
 */
function collectGlobalState() {
  const state = {
    timestamp: new Date().toISOString(),
    twin: null,
    bulletin: null,
    schedule: null,
    checkins: null
  };

  // 双子天平数据
  const twinPath = path.join(TIANYEN_DIR, 'twin-data.json');
  if (fs.existsSync(twinPath)) {
    try { state.twin = JSON.parse(fs.readFileSync(twinPath, 'utf8')); } catch (_) { /* 忽略 */ }
  }

  // 公告板数据
  const bulletinPath = path.join(TIANYEN_DIR, 'bulletin-data.json');
  if (fs.existsSync(bulletinPath)) {
    try { state.bulletin = JSON.parse(fs.readFileSync(bulletinPath, 'utf8')); } catch (_) { /* 忽略 */ }
  }

  // 调度配置
  const schedulePath = path.join(TIANYEN_DIR, 'agent-schedule.json');
  if (fs.existsSync(schedulePath)) {
    try { state.schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8')); } catch (_) { /* 忽略 */ }
  }

  // 签到记录
  const checkinPath = path.join(TIANYEN_DIR, 'checkin-log.json');
  if (fs.existsSync(checkinPath)) {
    try { state.checkins = JSON.parse(fs.readFileSync(checkinPath, 'utf8')); } catch (_) { /* 忽略 */ }
  }

  return state;
}

/**
 * 为特定 Agent 生成上下文
 * @param {string} agentId
 * @param {object} globalState
 * @returns {{ agentId: string, context: string, data: object }}
 */
function generateContext(agentId, globalState) {
  const data = {
    agentId,
    timestamp: globalState.timestamp,
    twinBalance: null,
    activeBulletins: 0,
    scheduleInfo: null,
    lastCheckin: null
  };

  // 注入天平数据
  if (globalState.twin) {
    data.twinBalance = {
      leftComposite: globalState.twin.left ? globalState.twin.left.composite : null,
      rightComposite: globalState.twin.right ? globalState.twin.right.composite : null
    };
  }

  // 注入公告数量
  if (globalState.bulletin && Array.isArray(globalState.bulletin.events)) {
    data.activeBulletins = globalState.bulletin.events.filter(e => e.status !== 'resolved').length;
  }

  // 注入调度信息
  if (globalState.schedule && globalState.schedule.agents && globalState.schedule.agents[agentId]) {
    data.scheduleInfo = globalState.schedule.agents[agentId];
  }

  // 注入签到信息
  if (globalState.checkins && globalState.checkins.checkins && globalState.checkins.checkins[agentId]) {
    data.lastCheckin = globalState.checkins.checkins[agentId];
  }

  // 生成上下文文本
  const lines = [
    `[天眼上下文 · ${agentId}]`,
    `时间: ${data.timestamp}`,
    data.twinBalance ? `天平: L=${data.twinBalance.leftComposite} R=${data.twinBalance.rightComposite}` : '天平: 无数据',
    `活跃公告: ${data.activeBulletins}`,
    data.scheduleInfo ? `调度: ${data.scheduleInfo.cron} (${data.scheduleInfo.reason})` : '调度: 未配置',
    data.lastCheckin ? `上次签到: ${data.lastCheckin.timestamp}` : '上次签到: 无记录'
  ];

  return {
    agentId,
    context: lines.join('\n'),
    data
  };
}

/**
 * 完整注入流程 · 采集 → 生成 → 返回
 * @param {string} agentId
 * @returns {{ agentId: string, context: string, data: object }}
 */
function injectContext(agentId) {
  const globalState = collectGlobalState();
  return generateContext(agentId, globalState);
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const agentId = process.argv[2] || 'AG-ZY-README';
  console.log('💉 Context Injector · 上下文注入器\n');

  const result = injectContext(agentId);
  console.log(result.context);
}

module.exports = { collectGlobalState, generateContext, injectContext };
