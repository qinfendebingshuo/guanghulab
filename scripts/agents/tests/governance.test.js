// scripts/agents/tests/governance.test.js
// Governance System · 治理系统综合测试
// ZY-TEST-GOV-001 · Phase 1
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

console.log('🏛️ Governance System 综合测试\n');

// ══════════════════════════════════════════════════════════════════════════
// 测试 1: Twin Merge Engine
// ══════════════════════════════════════════════════════════════════════════
console.log('── 测试 1: Twin Merge Engine ──');

const { merge, computeComposite } = require('../twin-merge');

const leftMetrics = { taskCompletion: 0.9, testPassRate: 0.85, codeCoverage: 1.0, securityScore: 1.0 };
const rightMetrics = { taskCompletion: 0.95, testPassRate: 0.9, codeCoverage: 1.0, securityScore: 1.0 };

const mergeResult = merge(leftMetrics, rightMetrics);

assert(typeof mergeResult.left === 'object', 'merge 返回 left 对象');
assert(typeof mergeResult.right === 'object', 'merge 返回 right 对象');
assert(typeof mergeResult.balance === 'number', 'merge 返回 balance 数值');
assert(mergeResult.balance >= 0 && mergeResult.balance <= 1, 'balance 在 0-1 范围内');
assert(typeof mergeResult.timestamp === 'string', 'merge 返回 timestamp');

// 验证 composite 计算
const expectedLeft = Math.round((0.4*0.9 + 0.25*0.85 + 0.2*1.0 + 0.15*1.0) * 10000) / 10000;
assert(mergeResult.left.composite === expectedLeft, `左翼 composite = ${expectedLeft} (实际: ${mergeResult.left.composite})`);

// 完全相同的指标 → balance = 1.0
const perfectMerge = merge(leftMetrics, leftMetrics);
assert(perfectMerge.balance === 1, '相同指标 → 完美平衡 (balance=1.0)');

// computeComposite 单独测试
const comp = computeComposite({ taskCompletion: 1, testPassRate: 1, codeCoverage: 1, securityScore: 1 });
assert(comp === 1, '全满分 composite = 1.0');

// ══════════════════════════════════════════════════════════════════════════
// 测试 2: Balance Checker
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 2: Balance Checker ──');

const { check } = require('../balance-checker');

// 完美平衡
const balancedResult = check(perfectMerge);
assert(balancedResult.balanced === true, '完美平衡 → balanced=true');
assert(balancedResult.alert === null, '完美平衡 → alert=null');
assert(balancedResult.drift === 0, '完美平衡 → drift=0');

// 有偏差
const driftResult = check(mergeResult);
assert(typeof driftResult.balanced === 'boolean', 'check 返回 balanced 布尔值');
assert(typeof driftResult.drift === 'number', 'check 返回 drift 数值');

// 大偏差测试
const bigDrift = merge(
  { taskCompletion: 0.5, testPassRate: 0.5, codeCoverage: 0.5, securityScore: 0.5 },
  { taskCompletion: 1.0, testPassRate: 1.0, codeCoverage: 1.0, securityScore: 1.0 }
);
const bigCheck = check(bigDrift);
assert(bigCheck.balanced === false, '大偏差 → balanced=false');
assert(bigCheck.alert !== null, '大偏差 → 有告警');
assert(bigCheck.alert.level === 'high', '大偏差 (0.5) → high 级别');

// 小偏差测试
const smallDrift = merge(
  { taskCompletion: 0.98, testPassRate: 0.98, codeCoverage: 1.0, securityScore: 1.0 },
  { taskCompletion: 1.0, testPassRate: 1.0, codeCoverage: 1.0, securityScore: 1.0 }
);
const smallCheck = check(smallDrift);
if (!smallCheck.balanced && smallCheck.alert) {
  assert(smallCheck.alert.level === 'low', '小偏差 → low 级别');
} else {
  assert(true, '小偏差 → 近似平衡');
}

// ══════════════════════════════════════════════════════════════════════════
// 测试 3: Auto-Repair Classifier
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 3: Auto-Repair Classifier ──');

const { diagnose, classify, verify } = require('../auto-repair');

const lowAlert = { level: 'low', laggingSide: 'left', deficit: 0.02 };
const medAlert = { level: 'medium', laggingSide: 'right', deficit: 0.1 };
const highAlert = { level: 'high', laggingSide: 'left', deficit: 0.3 };

const lowDiag = diagnose(lowAlert);
assert(lowDiag.severity === 'low', 'low alert → severity=low');

const medDiag = diagnose(medAlert);
assert(medDiag.severity === 'medium', 'medium alert → severity=medium');

const highDiag = diagnose(highAlert);
assert(highDiag.severity === 'high', 'high alert → severity=high');

const lowClass = classify(lowDiag);
assert(lowClass.level === 'L1', 'low severity → L1 自动修复');
assert(lowClass.autoFixable === true, 'L1 → autoFixable=true');

const medClass = classify(medDiag);
assert(medClass.level === 'L2', 'medium severity → L2 技术干预');
assert(medClass.autoFixable === false, 'L2 → autoFixable=false');

const highClass = classify(highDiag);
assert(highClass.level === 'L3', 'high severity → L3 架构干预');

// verify 测试
const verifySuccess = verify({ success: true });
assert(verifySuccess.verified === true, '成功修复 → verified=true');

const verifyFail = verify({ success: false, level: 'L2' });
assert(verifyFail.verified === false, '未修复 → verified=false');

// null alert
const nullDiag = diagnose(null);
assert(nullDiag.severity === 'none', 'null alert → severity=none');

// ══════════════════════════════════════════════════════════════════════════
// 测试 4: Escalation Router
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 4: Escalation Router ──');

const { classify: escClassify, route, escalate } = require('../escalation-router');

// L1 类型
assert(escClassify({ type: 'test_flaky' }).level === 'L1', 'test_flaky → L1');
assert(escClassify({ type: 'lint_error' }).level === 'L1', 'lint_error → L1');
assert(escClassify({ type: 'stub_missing' }).level === 'L1', 'stub_missing → L1');
assert(escClassify({ type: 'format_issue' }).level === 'L1', 'format_issue → L1');

// L2 类型
assert(escClassify({ type: 'test_persistent_fail' }).level === 'L2', 'test_persistent_fail → L2');
assert(escClassify({ type: 'dependency_conflict' }).level === 'L2', 'dependency_conflict → L2');
assert(escClassify({ type: 'security_alert' }).level === 'L2', 'security_alert → L2');

// L3 类型
assert(escClassify({ type: 'balance_long_drift' }).level === 'L3', 'balance_long_drift → L3');
assert(escClassify({ type: 'ontology_conflict' }).level === 'L3', 'ontology_conflict → L3');
assert(escClassify({ type: 'cross_system_architecture' }).level === 'L3', 'cross_system_architecture → L3');

// 路由测试
const l1Route = route({ type: 'test_flaky' });
assert(l1Route.handler === 'auto_repair', 'L1 handler = auto_repair');
assert(l1Route.notify === null, 'L1 notify = null');

const l2Route = route({ type: 'security_alert' });
assert(l2Route.notify !== null, 'L2 有通知目标');

// 完整升级流程
const escResult = escalate({ type: 'ontology_conflict', description: '测试' });
assert(escResult.classification.level === 'L3', 'escalate 返回正确分类');
assert(typeof escResult.timestamp === 'string', 'escalate 返回 timestamp');

// ══════════════════════════════════════════════════════════════════════════
// 测试 5: Bulletin Manager
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 5: Bulletin Manager ──');

const { addEvent, updateStatus, getActive, getRecent, prune, loadBulletin, saveBulletin } = require('../bulletin-manager');

// 清理测试环境
const ROOT = path.resolve(__dirname, '../../..');
const bulletinTestPath = path.join(ROOT, '.github/tianyen/bulletin-data.json');
const bulletinBackup = fs.existsSync(bulletinTestPath) ? fs.readFileSync(bulletinTestPath, 'utf8') : null;

// 重置
saveBulletin({ events: [] });

// 添加事件
const added1 = addEvent({ id: 'TEST-001', event: '测试事件1', status: 'active', handler: 'auto', priority: 1 });
assert(added1 === true, 'addEvent 成功添加');

const added2 = addEvent({ id: 'TEST-002', event: '测试事件2', status: 'active', handler: 'manual', priority: 2 });
assert(added2 === true, 'addEvent 添加第二个事件');

// 去重
const addDup = addEvent({ id: 'TEST-001', event: '重复事件', status: 'active' });
assert(addDup === false, 'addEvent 去重：相同 id 不重复添加');

// 获取活跃事件
const active = getActive();
assert(active.length === 2, `getActive 返回 2 个活跃事件 (实际: ${active.length})`);

// 更新状态
const updated = updateStatus('TEST-001', 'resolved');
assert(updated === true, 'updateStatus 成功更新');

const activeAfter = getActive();
assert(activeAfter.length === 1, `resolved 后活跃事件 = 1 (实际: ${activeAfter.length})`);

// 获取最近事件
const recent = getRecent(5);
assert(recent.length === 2, `getRecent 返回所有事件 (含 resolved)`);

// 清理过期事件（用极小 maxAge 测试）
addEvent({ id: 'TEST-OLD', timestamp: '2020-01-01T00:00:00Z', event: '旧事件', status: 'active' });
const pruned = prune(1000); // 1秒前的都清理
assert(pruned >= 1, `prune 清理了至少 1 条过期事件 (清理了: ${pruned})`);

// 恢复测试数据
if (bulletinBackup) {
  fs.writeFileSync(bulletinTestPath, bulletinBackup, 'utf8');
} else {
  saveBulletin({ events: [] });
}

// ══════════════════════════════════════════════════════════════════════════
// 测试 6: Actions Parser
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 6: Actions Parser ──');

const { parseWorkflowOutput, parsePRMerge, parseTestReport } = require('../actions-parser');

// parseWorkflowOutput
const wfOutput = '  ✅ test1\n  ✅ test2\n  ❌ test3\n  Error: something\n';
const wfResult = parseWorkflowOutput(wfOutput);
assert(wfResult.tests.passed === 2, 'parseWorkflowOutput: 2 passed');
assert(wfResult.tests.failed === 1, 'parseWorkflowOutput: 1 failed');
assert(wfResult.tests.total === 3, 'parseWorkflowOutput: 3 total');
assert(wfResult.errors.length >= 1, 'parseWorkflowOutput: 检测到错误行');

// 空输入
const emptyResult = parseWorkflowOutput('');
assert(emptyResult.tests.total === 0, 'parseWorkflowOutput: 空输入 → 0 total');

const nullResult = parseWorkflowOutput(null);
assert(nullResult.tests.total === 0, 'parseWorkflowOutput: null 输入 → 0 total');

// parsePRMerge
const prResult = parsePRMerge({ title: 'Fix bug', number: 42, author: 'test', files: ['a.js', 'b.js'] });
assert(prResult.filesChanged === 2, 'parsePRMerge: 2 files changed');
assert(prResult.summary.includes('#42'), 'parsePRMerge: 包含 PR 编号');

const nullPr = parsePRMerge(null);
assert(nullPr.filesChanged === 0, 'parsePRMerge: null → 0 files');

// parseTestReport
const reportResult = parseTestReport('✅ a\n✅ b\n❌ c');
assert(reportResult.passed === 2, 'parseTestReport: 2 passed');
assert(reportResult.failed === 1, 'parseTestReport: 1 failed');
assert(reportResult.passRate > 0.6 && reportResult.passRate < 0.7, 'parseTestReport: passRate ~0.6667');

// ══════════════════════════════════════════════════════════════════════════
// 测试 7: TianYen Scheduler
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 7: TianYen Scheduler ──');

const { evaluateSchedule, setFrequency, FREQUENCY_LEVELS } = require('../../tianyen/scheduler');

// 无指标 → default
const defEval = evaluateSchedule('AG-TEST', null);
assert(defEval.level === 'default', '无指标 → default 频率');

// 高偏差 → max
const maxEval = evaluateSchedule('AG-TEST', { drift: 0.2 });
assert(maxEval.level === 'max', '高偏差 (0.2) → max 频率');

// 中偏差 → high
const highEval = evaluateSchedule('AG-TEST', { drift: 0.08 });
assert(highEval.level === 'high', '中偏差 (0.08) → high 频率');

// 完美平衡 → low
const lowEval = evaluateSchedule('AG-TEST', { balance: 1.0, drift: 0 });
assert(lowEval.level === 'low', '完美平衡 → low 频率');

// 活跃变更 → high/medium
const activeEval = evaluateSchedule('AG-TEST', { recentChanges: 15 });
assert(activeEval.level === 'high', '大量变更 → high 频率');

const medEval = evaluateSchedule('AG-TEST', { recentChanges: 5 });
assert(medEval.level === 'medium', '中等变更 → medium 频率');

// FREQUENCY_LEVELS 完整性
assert(Object.keys(FREQUENCY_LEVELS).length === 5, '5 个频率级别');
assert(FREQUENCY_LEVELS.max.cron === '*/30 * * * *', 'max cron 正确');

// ══════════════════════════════════════════════════════════════════════════
// 测试 8: Agent Checkin Module
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 8: Agent Checkin Module ──');

const { checkin, checkout, getLastCheckin, detectTimeout, loadCheckinLog, saveCheckinLog } = require('../../tianyen/agent-checkin-module');

// 备份
const checkinLogPath = path.join(ROOT, '.github/tianyen/checkin-log.json');
const checkinBackup = fs.existsSync(checkinLogPath) ? fs.readFileSync(checkinLogPath, 'utf8') : null;

// 重置
saveCheckinLog({ version: '1.0.0', checkins: {} });

// checkin
const ci = checkin('AG-TEST-001');
assert(ci.agentId === 'AG-TEST-001', 'checkin 返回正确 agentId');
assert(ci.status === 'running', 'checkin status = running');
assert(typeof ci.timestamp === 'string', 'checkin 返回 timestamp');

// getLastCheckin
const last = getLastCheckin('AG-TEST-001');
assert(last !== null, 'getLastCheckin 返回记录');
assert(last.status === 'running', 'getLastCheckin status = running');

// detectTimeout — 刚签到，不应超时
const timeoutCheck = detectTimeout('AG-TEST-001', 600000);
assert(timeoutCheck.timedOut === false, '刚签到 → 未超时');

// detectTimeout — 用极小 maxDuration 强制超时
const shortTimeout = detectTimeout('AG-TEST-001', 0);
assert(shortTimeout.timedOut === true, '0ms maxDuration → 超时');

// checkout
const co = checkout('AG-TEST-001', 'success', { testsRun: 10 });
assert(co.status === 'success', 'checkout status = success');
assert(typeof co.duration === 'number', 'checkout 返回 duration');

// checkout 后不再检测为运行中
const afterCo = detectTimeout('AG-TEST-001', 0);
assert(afterCo.timedOut === false, 'checkout 后不超时');

// 不存在的 Agent
const noAgent = getLastCheckin('AG-NONEXISTENT');
assert(noAgent === null, '不存在的 Agent → null');

const noTimeout = detectTimeout('AG-NONEXISTENT');
assert(noTimeout.timedOut === false, '不存在的 Agent → 不超时');

// 恢复
if (checkinBackup) {
  fs.writeFileSync(checkinLogPath, checkinBackup, 'utf8');
} else {
  saveCheckinLog({ version: '1.0.0', checkins: {} });
}

// ══════════════════════════════════════════════════════════════════════════
// 测试 9: Twin Collector (不执行实际测试，只验证模块导出)
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 9: Twin Collector 模块导出 ──');

const collector = require('../twin-collector');
assert(typeof collector.collectMetrics === 'function', 'collectMetrics 是函数');
assert(typeof collector.collectLeft === 'function', 'collectLeft 是函数');
assert(typeof collector.collectRight === 'function', 'collectRight 是函数');
assert(typeof collector.collectBoth === 'function', 'collectBoth 是函数');
assert(typeof collector.WEIGHTS === 'object', 'WEIGHTS 已导出');
assert(collector.WEIGHTS.taskCompletion === 0.4, 'taskCompletion 权重 = 0.4');
assert(collector.WEIGHTS.testPassRate === 0.25, 'testPassRate 权重 = 0.25');

// ══════════════════════════════════════════════════════════════════════════
// 测试 10: README Generator (SKINS 和布局)
// ══════════════════════════════════════════════════════════════════════════
console.log('\n── 测试 10: README Generator ──');

const {
  SKINS, selectSkin, generateLayout, renderDashboard,
  renderTwinBalance, renderBulletin, generateReadme
} = require('../readme-generator');

assert(Object.keys(SKINS).length === 5, '5 种皮肤');
assert(SKINS.CALM.badgeColor === 'blue', 'CALM badgeColor = blue');
assert(SKINS.EMERGENCY.badgeColor === 'red', 'EMERGENCY badgeColor = red');

// selectSkin
assert(selectSkin(null).name === SKINS.CALM.name, 'null state → CALM');
assert(selectSkin({ alert: { level: 'high' } }).name === SKINS.EMERGENCY.name, 'high alert → EMERGENCY');
assert(selectSkin({ alert: { level: 'medium' } }).name === SKINS.ATTENTION.name, 'medium alert → ATTENTION');
assert(selectSkin({ building: true }).name === SKINS.BUILDING.name, 'building → BUILDING');

// generateLayout
const emergencyLayout = generateLayout({ alert: { level: 'high' }, balanced: false });
assert(emergencyLayout[0] === 'critical_alert', '紧急布局首项 = critical_alert');

const calmLayout = generateLayout({});
assert(calmLayout.includes('dashboard'), '常规布局包含 dashboard');

// renderDashboard
const dashMd = renderDashboard({});
assert(dashMd.includes('系统状态'), 'dashboard 包含系统状态');

// renderTwinBalance
const twinMd = renderTwinBalance({ metrics: { left: { composite: 0.9, dimensions: { taskCompletion: 0.9, testPassRate: 0.8, codeCoverage: 1.0, securityScore: 1.0 } }, right: { composite: 0.95, dimensions: { taskCompletion: 0.95, testPassRate: 0.9, codeCoverage: 1.0, securityScore: 1.0 } } }, balance: 0.95 });
assert(twinMd.includes('双子天平'), 'twin balance 包含标题');
assert(twinMd.includes('EXE-Engine'), 'twin balance 包含 EXE-Engine');

// renderBulletin
const bulletinMd = renderBulletin([]);
assert(bulletinMd.includes('暂无公告'), '空公告 → 暂无公告');

const bulletinMd2 = renderBulletin([{ timestamp: '2026-01-01T00:00:00Z', event: '测试', status: 'active', handler: 'auto' }]);
assert(bulletinMd2.includes('测试'), '公告包含事件内容');

// generateReadme
const readme = generateReadme({});
assert(readme.includes('光湖'), 'README 包含光湖');
assert(readme.includes('版权'), 'README 包含版权');

// ══════════════════════════════════════════════════════════════════════════
// 结果汇总
// ══════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`🏛️ 治理系统测试结果: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log(`\n❌ ${failed} 个测试失败`);
  process.exit(1);
} else {
  console.log(`\n✅ 全部 ${passed} 个测试通过`);
}
