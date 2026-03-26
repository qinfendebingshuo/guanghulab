// exe-engine/tests/smoke/exe-engine.test.js
// EXE-Engine · 冒烟测试
// PRJ-EXE-001 · Phase 0 · ZY-EXE-P0-004
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');

// 直接引入模块（不走 npm install）
const {
  createEngine,
  AGERouter,
  LoadBalancer,
  ResourceMeter,
  ContextCache,
  AgentController,
  BaseAdapter,
  DeepSeekAdapter,
  QwenAdapter
} = require('../../src/index');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    // eslint-disable-next-line no-console
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    // eslint-disable-next-line no-console
    console.error(`  ❌ ${message}`);
  }
}

// eslint-disable-next-line no-console
console.log('🔧 EXE-Engine 冒烟测试 · Phase 0\n');

// ── 测试 1: 模块导出 ──
// eslint-disable-next-line no-console
console.log('── 测试 1: 模块导出完整性 ──');
assert(typeof createEngine === 'function', 'createEngine 是函数');
assert(typeof AGERouter === 'function', 'AGERouter 是构造函数');
assert(typeof LoadBalancer === 'function', 'LoadBalancer 是构造函数');
assert(typeof ResourceMeter === 'function', 'ResourceMeter 是构造函数');
assert(typeof ContextCache === 'function', 'ContextCache 是构造函数');
assert(typeof AgentController === 'function', 'AgentController 是构造函数');
assert(typeof BaseAdapter === 'function', 'BaseAdapter 是构造函数');
assert(typeof DeepSeekAdapter === 'function', 'DeepSeekAdapter 是构造函数');
assert(typeof QwenAdapter === 'function', 'QwenAdapter 是构造函数');

// ── 测试 2: createEngine 初始化 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 2: createEngine 初始化 ──');
const engine = createEngine();
assert(engine.router instanceof AGERouter, 'router 是 AGERouter 实例');
assert(engine.meter instanceof ResourceMeter, 'meter 是 ResourceMeter 实例');
assert(engine.cache instanceof ContextCache, 'cache 是 ContextCache 实例');
assert(engine.controller instanceof AgentController, 'controller 是 AgentController 实例');
assert(engine.balancer instanceof LoadBalancer, 'balancer 是 LoadBalancer 实例');
assert(engine.adapters instanceof Map, 'adapters 是 Map 实例');
assert(engine.adapters.size === 4, `4 个适配器已注册 (实际: ${engine.adapters.size})`);

// ── 测试 3: 适配器注册 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 3: 适配器注册 ──');
assert(engine.adapters.has('deepseek-v3'), 'deepseek-v3 适配器已注册');
assert(engine.adapters.has('deepseek-r1'), 'deepseek-r1 适配器已注册');
assert(engine.adapters.has('qwen-max'), 'qwen-max 适配器已注册');
assert(engine.adapters.has('qwen-coder'), 'qwen-coder 适配器已注册');

const dsAdapter = engine.adapters.get('deepseek-v3');
assert(dsAdapter instanceof DeepSeekAdapter, 'deepseek-v3 是 DeepSeekAdapter 实例');
assert(dsAdapter.supports('code'), 'deepseek-v3 支持 code 能力');
assert(dsAdapter.supports('reasoning'), 'deepseek-v3 支持 reasoning 能力');

const qwAdapter = engine.adapters.get('qwen-max');
assert(qwAdapter instanceof QwenAdapter, 'qwen-max 是 QwenAdapter 实例');
assert(qwAdapter.supports('text'), 'qwen-max 支持 text 能力');

// ── 测试 4: BaseAdapter 不可直接实例化 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 4: BaseAdapter 约束 ──');
let baseError = null;
try {
  new BaseAdapter({ name: 'test' });
} catch (e) {
  baseError = e;
}
assert(baseError !== null, 'BaseAdapter 不可直接实例化');
assert(baseError && baseError.message.includes('不可直接实例化'), '错误信息正确');

// ── 测试 5: 适配器状态 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 5: 适配器状态 ──');
const dsStatus = dsAdapter.getStatus();
assert(dsStatus.name === 'deepseek-v3', '状态名称正确');
assert(dsStatus.healthy === true, '初始状态健康');
assert(dsStatus.inCooldown === false, '初始无冷却');
assert(dsStatus.failureCount === 0, '初始无失败');

// ── 测试 6: 冷却期机制 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 6: 冷却期机制 ──');
const testAdapter = engine.adapters.get('deepseek-r1');
testAdapter.recordFailure('test1');
testAdapter.recordFailure('test2');
assert(testAdapter.isInCooldown() === false, '2 次失败不触发冷却');
testAdapter.recordFailure('test3');
assert(testAdapter.isInCooldown() === true, '3 次失败触发冷却');
assert(testAdapter.getStatus().healthy === false, '冷却期标记不健康');
testAdapter.resetFailures();
assert(testAdapter.isInCooldown() === false, '重置后退出冷却');
assert(testAdapter.getStatus().healthy === true, '重置后恢复健康');

// ── 测试 7: LoadBalancer 选择 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 7: LoadBalancer 选择 ──');
const selected = engine.balancer.select({
  taskType: 'code_generation',
  model: 'auto',
  priority: 'balanced'
});
assert(selected !== null, 'balanced 策略返回适配器');
assert(selected.name === 'deepseek-v3', 'code_generation 首选 deepseek-v3');

const costSelected = engine.balancer.select({
  taskType: 'code_generation',
  model: 'auto',
  priority: 'cost'
});
assert(costSelected !== null, 'cost 策略返回适配器');

const qualitySelected = engine.balancer.select({
  taskType: 'reasoning',
  model: 'auto',
  priority: 'quality'
});
assert(qualitySelected !== null, 'quality 策略返回适配器');
assert(qualitySelected.name === 'deepseek-r1', 'reasoning 首选 deepseek-r1');

// 指定模型
const specificSelected = engine.balancer.select({
  taskType: 'text_processing',
  model: 'qwen-max',
  priority: 'balanced'
});
assert(specificSelected !== null, '指定模型返回适配器');
assert(specificSelected.name === 'qwen-max', '返回指定的 qwen-max');

// 故障转移
const failover = engine.balancer.failover('deepseek-v3', 'code_generation');
assert(failover !== null, '故障转移返回备选');
assert(failover.name !== 'deepseek-v3', '备选不等于失败模型');

// ── 测试 8: ResourceMeter 计量 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 8: ResourceMeter 计量 ──');
const freshMeter = new ResourceMeter();
// Clear any previous state by using a fresh meter and tracking deltas
const beforeSummary = freshMeter.getSummary();
const beforeRequests = beforeSummary.totalRequests;

freshMeter.record({
  requestId: 'test-001',
  agentId: 'AG-ZY-01',
  model: 'deepseek-v3',
  taskType: 'code_generation',
  resourcePool: 'default',
  mode: 'pool',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.002,
  costUnit: 'CNY',
  latency: 1500,
  status: 'success'
});

const summary = freshMeter.getSummary();
assert(summary.totalRequests === beforeRequests + 1, '总请求数增加 1');
assert(summary.byModel['deepseek-v3'] !== undefined, '按模型统计存在 deepseek-v3');
assert(summary.byAgent['AG-ZY-01'] !== undefined, '按 Agent 统计存在 AG-ZY-01');

const agentUsage = freshMeter.getAgentUsage('AG-ZY-01');
assert(agentUsage !== null, 'Agent 使用记录存在');
assert(agentUsage.inputTokens >= 1000, 'Agent 输入 token >= 1000');

const recent = freshMeter.getRecentRecords(10);
assert(recent.length >= 1, '最近记录数 >= 1');
assert(recent[recent.length - 1].requestId === 'test-001', '最近一条记录 ID 正确');

// ── 测试 9: ContextCache ──
// eslint-disable-next-line no-console
console.log('\n── 测试 9: ContextCache 缓存 ──');
engine.cache.set('test-key', { repo: 'guanghulab', branch: 'main' });
const cached = engine.cache.get('test-key');
assert(cached !== null, '缓存命中');
assert(cached.repo === 'guanghulab', '缓存内容正确');

const missed = engine.cache.get('nonexistent');
assert(missed === null, '缓存未命中返回 null');

const cacheStatus = engine.cache.getStatus();
assert(cacheStatus.size === 1, '缓存大小 = 1');
assert(cacheStatus.maxEntries === 100, '最大容量 = 100');

engine.cache.delete('test-key');
assert(engine.cache.get('test-key') === null, '删除后缓存未命中');

// ── 测试 10: AgentController ──
// eslint-disable-next-line no-console
console.log('\n── 测试 10: AgentController 调度 ──');
const zyPref = engine.controller.getPreference('AG-ZY-01');
assert(zyPref.model === 'auto', '铸渊偏好 model=auto');
assert(zyPref.priority === 'balanced', '铸渊偏好 priority=balanced');

const syPref = engine.controller.getPreference('AG-SY-01');
assert(syPref.priority === 'quality', '霜砚偏好 priority=quality');

const qqPref = engine.controller.getPreference('AG-QQ-01');
assert(qqPref.priority === 'cost', '秋秋偏好 priority=cost');

const unknownPref = engine.controller.getPreference('AG-UNKNOWN');
assert(unknownPref.model === 'auto', '未注册 Agent 返回默认偏好');

const exeRequest = engine.controller.buildExeRequest('AG-ZY-01', {
  prompt: 'Hello World',
  taskType: 'code_generation'
});
assert(exeRequest.agentId === 'AG-ZY-01', 'EXE 请求 agentId 正确');
assert(exeRequest.taskType === 'code_generation', 'EXE 请求 taskType 正确');
assert(exeRequest.prompt === 'Hello World', 'EXE 请求 prompt 正确');
assert(exeRequest.resourcePool === 'default', 'EXE 请求 resourcePool 正确');

const agents = engine.controller.getRegisteredAgents();
assert(agents.length === 3, '3 个 Agent 已注册');

// ── 测试 11: AGE-Router 状态 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 11: AGE-Router 状态 ──');
const routerStatus = engine.router.getStatus();
assert(routerStatus.router === 'AGE-Router v1.0.0', 'Router 版本正确');
assert(routerStatus.project === 'PRJ-EXE-001', '项目编号正确');
assert(routerStatus.phase === 'Phase 0', '阶段正确');
assert(Array.isArray(routerStatus.adapters), '适配器状态是数组');
assert(routerStatus.adapters.length === 4, '4 个适配器状态');

// ── 测试 12: AGE-Router 错误处理（无 API Key） ──
// eslint-disable-next-line no-console
console.log('\n── 测试 12: AGE-Router 错误处理 ──');
(async () => {
  const result = await engine.router.execute({
    agentId: 'AG-ZY-01',
    taskType: 'code_generation',
    prompt: 'test prompt',
    preferences: { model: 'auto', priority: 'balanced' }
  });

  // 无 API Key 时应该返回错误（网络错误或认证错误）
  assert(result.requestId && result.requestId.startsWith('exe-'), '返回带 exe- 前缀的 requestId');
  assert(typeof result.latency === 'number', '返回 latency');
  assert(result.status === 'error', '无 API Key 时返回 error 状态');
  assert(result.error && result.error.code, '错误响应包含 error.code');
  assert(result.error && result.error.message, '错误响应包含 error.message');

  // ── 测试结果汇总 ──
  // eslint-disable-next-line no-console
  console.log('\n══════════════════════════════════════');
  // eslint-disable-next-line no-console
  console.log(`🔧 EXE-Engine 冒烟测试完成`);
  // eslint-disable-next-line no-console
  console.log(`   ✅ 通过: ${passed}`);
  // eslint-disable-next-line no-console
  console.log(`   ❌ 失败: ${failed}`);
  // eslint-disable-next-line no-console
  console.log(`   📊 总计: ${passed + failed}`);
  // eslint-disable-next-line no-console
  console.log('══════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
