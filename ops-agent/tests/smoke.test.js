#!/usr/bin/env node
/**
 * 铸渊运维守卫 · 冒烟测试
 * 编号: ZY-OPS-TEST-001
 * 版权: 国作登字-2026-A-00037559
 *
 * 验证所有模块能正确加载和基本功能正常
 */

'use strict';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

console.log('\n🛡️ 铸渊运维守卫 · 冒烟测试\n');

// ── 模块加载 ──────────────────────────────

console.log('📦 模块加载:');

let llm, memory, healthChecker, repairEngine, notifier;

try {
  llm = require('../llm-client');
  assert(true, 'llm-client 加载成功');
} catch (e) {
  assert(false, `llm-client 加载失败: ${e.message}`);
}

try {
  memory = require('../memory');
  assert(true, 'memory 加载成功');
} catch (e) {
  assert(false, `memory 加载失败: ${e.message}`);
}

try {
  healthChecker = require('../health-checker');
  assert(true, 'health-checker 加载成功');
} catch (e) {
  assert(false, `health-checker 加载失败: ${e.message}`);
}

try {
  repairEngine = require('../repair-engine');
  assert(true, 'repair-engine 加载成功');
} catch (e) {
  assert(false, `repair-engine 加载失败: ${e.message}`);
}

try {
  notifier = require('../notifier');
  assert(true, 'notifier 加载成功');
} catch (e) {
  assert(false, `notifier 加载失败: ${e.message}`);
}

// ── LLM 客户端 ──────────────────────────

console.log('\n🧠 LLM 客户端:');

assert(typeof llm.diagnoseByPattern === 'function', 'diagnoseByPattern 是函数');
assert(typeof llm.chat === 'function', 'chat 是函数');
assert(typeof llm.detectIntent === 'function', 'detectIntent 是函数');
assert(typeof llm.getSession === 'function', 'getSession 是函数');
assert(typeof llm.getSessionHistory === 'function', 'getSessionHistory 是函数');
assert(typeof llm.listSessions === 'function', 'listSessions 是函数');
assert(typeof llm.callLLM === 'function', 'callLLM 是函数');

// 模式匹配测试
const patterns = llm.diagnoseByPattern('ECONNREFUSED on port 3800');
assert(patterns.length > 0, '模式匹配: ECONNREFUSED 被识别');
assert(patterns[0].category === 'service', '模式匹配: 正确分类为 service');

const emptyPatterns = llm.diagnoseByPattern('一切正常');
assert(emptyPatterns.length === 0, '模式匹配: 正常文本无匹配');

// 意图识别测试
const intent1 = llm.detectIntent('MCP连不上了怎么办');
assert(intent1.intent === 'diagnose', '意图识别: "连不上" → diagnose');
assert(intent1.action === 'health_check', '意图识别: diagnose → health_check');

const intent2 = llm.detectIntent('服务器内存够用吗');
assert(intent2.intent === 'resources', '意图识别: "内存" → resources');

const intent3 = llm.detectIntent('看看日志');
assert(intent3.intent === 'logs', '意图识别: "日志" → logs');

const intent4 = llm.detectIntent('你好呀');
assert(intent4.intent === 'general', '意图识别: 普通问候 → general');

// 会话管理测试
const { sessionId: sid1, session: s1 } = llm.getSession();
assert(sid1.startsWith('s-'), '会话管理: 新会话ID格式正确');
assert(Array.isArray(s1.messages), '会话管理: messages 是数组');

const { sessionId: sid2 } = llm.getSession(sid1);
assert(sid2 === sid1, '会话管理: 同一ID返回同一会话');

const { sessionId: sid3 } = llm.getSession();
assert(sid3 !== sid1, '会话管理: 无ID时创建新会话');

const sessions = llm.listSessions();
assert(sessions.length >= 2, '会话管理: listSessions 返回正确数量');

// ── 记忆系统 ──────────────────────────────

console.log('\n💾 记忆系统:');

assert(typeof memory.logEvent === 'function', 'logEvent 是函数');
assert(typeof memory.queryEvents === 'function', 'queryEvents 是函数');
assert(typeof memory.buildMemoryContext === 'function', 'buildMemoryContext 是函数');
assert(typeof memory.createTicket === 'function', 'createTicket 是函数');

const ctx = memory.buildMemoryContext();
assert(typeof ctx === 'string', 'buildMemoryContext 返回字符串');
assert(ctx.includes('运维守卫记忆'), 'buildMemoryContext 包含正确标题');

// ── 健康检查 ──────────────────────────────

console.log('\n🔍 健康检查:');

assert(typeof healthChecker.quickCheck === 'function', 'quickCheck 是函数');
assert(typeof healthChecker.deepCheck === 'function', 'deepCheck 是函数');
assert(typeof healthChecker.getSystemResources === 'function', 'getSystemResources 是函数');
assert(typeof healthChecker.getPM2Status === 'function', 'getPM2Status 是函数');
assert(typeof healthChecker.getNginxStatus === 'function', 'getNginxStatus 是函数');
assert(Array.isArray(healthChecker.SERVICES), 'SERVICES 是数组');
assert(healthChecker.SERVICES.length > 0, 'SERVICES 不为空');

const resources = healthChecker.getSystemResources();
assert(typeof resources.memory.used_pct === 'number', 'getSystemResources: 内存百分比是数字');
assert(resources.cpus > 0, 'getSystemResources: CPU核数 > 0');

// ── 修复引擎 ──────────────────────────────

console.log('\n🔧 修复引擎:');

assert(typeof repairEngine.autoRepair === 'function', 'autoRepair 是函数');
assert(typeof repairEngine.sanitizeProcessName === 'function', 'sanitizeProcessName 是函数');
assert(typeof repairEngine.sanitizePath === 'function', 'sanitizePath 是函数');

assert(repairEngine.sanitizeProcessName('zhuyuan-server') === 'zhuyuan-server', '白名单: zhuyuan-server 允许');
assert(repairEngine.sanitizeProcessName('rm -rf /') === null, '白名单: 恶意输入被拒绝');
assert(repairEngine.sanitizeProcessName('unknown-process') === null, '白名单: 未知进程被拒绝');

assert(repairEngine.sanitizePath('/opt/zhuyuan/app/test') === '/opt/zhuyuan/app/test', '路径: 合法路径允许');
assert(repairEngine.sanitizePath('/etc/passwd') === null, '路径: 敏感路径被拒绝');
assert(repairEngine.sanitizePath('/opt/zhuyuan/../etc/passwd') === null, '路径: 路径遍历被拒绝');

// ── 通知系统 ──────────────────────────────

console.log('\n📧 通知系统:');

assert(typeof notifier.sendAlertEmail === 'function', 'sendAlertEmail 是函数');
assert(typeof notifier.alertOnIssues === 'function', 'alertOnIssues 是函数');
assert(typeof notifier.notifyTicketCreated === 'function', 'notifyTicketCreated 是函数');
assert(typeof notifier.sendDailyReport === 'function', 'sendDailyReport 是函数');

// SMTP 未配置时不崩溃
const transporter = notifier.getSmtpTransporter();
assert(transporter === null || typeof transporter === 'object', 'SMTP 未配置时返回 null');

// ── 结果汇总 ──────────────────────────────

console.log('\n─────────────────────────────');
console.log(`结果: ${passed} 通过, ${failed} 失败`);

if (failed > 0) {
  console.log('❌ 冒烟测试未全部通过\n');
  process.exit(1);
} else {
  console.log('✅ 冒烟测试全部通过\n');
  process.exit(0);
}
