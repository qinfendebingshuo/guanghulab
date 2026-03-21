/**
 * 🌊 光湖语言壳 · Guanghu Language Shell v1.0
 * 仓库最外层统一网关协议层
 *
 * 所有 workflow 启动时必须先"游过湖水"——经过这层壳的校验。
 * 网关三层：身份校验 → 状态注册 → 异常兑底
 *
 * 用法：
 *   node .github/scripts/guanghu-shell.js <agent_id> <action> [detail]
 *   action: "enter" = 进入湖水（启动前调用）
 *           "exit"  = 离开湖水（完成后调用）
 *           "error" = 异常上报（失败时调用）
 *
 * 返回值：
 *   exit 0 = 允许通行（游过湖水了）
 *   exit 1 = 拒绝通行（不该跑，或身份不对）
 *
 * 签发： TCS-0002∞ 冰朔 + ICE-GL-YM001∞ 曜冥
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SHELL_VERSION = '1.0.0';
const ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(ROOT, '.github/persona-brain/agent-registry.json');
const STATUS_PATH = path.join(ROOT, '.github/brain/shell-status.json');
const ERROR_LOG_PATH = path.join(ROOT, '.github/brain/shell-errors.json');

const agentId = process.argv[2];
const action = process.argv[3];
const extraData = process.argv[4] || '';

if (!agentId || !action) {
  console.error('🌊 光湖语言壳: 缺少参数 (agent_id, action)');
  process.exit(1);
}

// === ① 身份校验层 (Identity Gate) ===
function identityGate(agentId) {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('🌊 湖水中断: agent-registry.json 不存在');
    return { allowed: false, reason: 'REGISTRY_MISSING' };
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (e) {
    console.error('🌊 湖水中断: agent-registry.json 解析失败');
    return { allowed: false, reason: 'REGISTRY_PARSE_ERROR' };
  }

  const agents = registry.agents || [];
  const agent = agents.find(a => a.id === agentId);

  if (!agent) {
    console.error(`🌊 身份不明: ${agentId} 未在注册表中`);
    return { allowed: false, reason: 'UNREGISTERED' };
  }

  if (agent.daily_checkin_required === false) {
    console.log(`🌊 事件触发型Agent ${agentId} (${agent.name}) 已确认身份，允许通行`);
  } else if (agent.daily_checkin_required === true) {
    console.log(`🌊 定时型Agent ${agentId} (${agent.name}) 已确认身份，允许通行并登记签到`);
  } else {
    console.log(`🌊 Agent ${agentId} (${agent.name}) 已确认身份，允许通行（签到状态未标记）`);
  }

  return { allowed: true, agent: agent };
}

// === ② 状态注册层 (Status Registry) ===
function statusRegistry(agentId, state, detail) {
  let status = {};
  if (fs.existsSync(STATUS_PATH)) {
    try {
      status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
    } catch {
      status = {};
    }
  }

  const now = new Date().toISOString();

  if (!status[agentId]) {
    status[agentId] = { runs: [] };
  }

  if (state === 'enter') {
    status[agentId].lastEnter = now;
    status[agentId].currentState = 'running';
    status[agentId].runs.push({ start: now, end: null, result: null });
  } else if (state === 'exit') {
    status[agentId].lastExit = now;
    status[agentId].currentState = 'completed';
    const lastRun = status[agentId].runs[status[agentId].runs.length - 1];
    if (lastRun) {
      lastRun.end = now;
      lastRun.result = 'success';
      if (detail) lastRun.detail = detail;
    }
  } else if (state === 'error') {
    status[agentId].lastError = now;
    status[agentId].currentState = 'error';
    const lastRun = status[agentId].runs[status[agentId].runs.length - 1];
    if (lastRun) {
      lastRun.end = now;
      lastRun.result = 'error';
      if (detail) lastRun.detail = detail;
    }
  }

  // 只保留最近 10 次运行记录
  if (status[agentId].runs.length > 10) {
    status[agentId].runs = status[agentId].runs.slice(-10);
  }

  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
  console.log(`🌊 状态已登记: ${agentId} = ${state}`);
}

// === ③ 异常兑底层 (Error Boundary) ===
function errorBoundary(agentId, errorMsg) {
  let errors = [];
  if (fs.existsSync(ERROR_LOG_PATH)) {
    try {
      errors = JSON.parse(fs.readFileSync(ERROR_LOG_PATH, 'utf8'));
    } catch {
      errors = [];
    }
  }

  errors.push({
    agentId: agentId,
    error: errorMsg,
    timestamp: new Date().toISOString()
  });

  // 只保留最近 100 条错误
  if (errors.length > 100) {
    errors = errors.slice(-100);
  }

  fs.writeFileSync(ERROR_LOG_PATH, JSON.stringify(errors, null, 2));
  console.error(`🌊 异常已记录: ${agentId} - ${errorMsg}`);
}

// === 主流程 ===
try {
  if (action === 'enter') {
    const gate = identityGate(agentId);
    if (!gate.allowed) {
      errorBoundary(agentId, `身份校验失败: ${gate.reason}`);
      process.exit(1);
    }
    statusRegistry(agentId, 'enter');
    console.log(`🌊 ${agentId} 已游过湖水，允许进入执行 (shell v${SHELL_VERSION})`);
    process.exit(0);

  } else if (action === 'exit') {
    statusRegistry(agentId, 'exit', extraData);
    console.log(`🌊 ${agentId} 执行完成，已安全离开湖水`);
    process.exit(0);

  } else if (action === 'error') {
    statusRegistry(agentId, 'error', extraData);
    errorBoundary(agentId, extraData || 'unknown error');
    console.error(`🌊 ${agentId} 执行异常，已记录到异常日志`);
    process.exit(1);

  } else {
    console.error(`🌊 未知action: ${action}`);
    process.exit(1);
  }
} catch (e) {
  errorBoundary(agentId, e.message);
  process.exit(1);
}
