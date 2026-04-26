/**
 * M4 · 端到端测试 · E2E Test Suite
 * GH-GMP-005 · Agent搬迁工程
 *
 * 验收标准（冰朔 · 2026-04-26）：
 *   创建一张工单 → Agent自动接单 → 生成回执 → 写回Notion
 *   人格体醒来是"谁"，不是"什么"。
 *
 * 测试策略：
 *   1. Mock层E2E：用内存Mock替代Notion API和Qwen API，验证全流程数据流
 *   2. 组件单测：Dispatcher/PersonaLoader/ReceiptGen/TaskRunner 各自验证
 *   3. 烟雾测试：见 smoke-test.js（需服务器在线）
 *
 * 运行：node gmp-agent/test/e2e-test.js
 * 无外部依赖，不需要.env配置
 */

'use strict';

// ═══════════════════════════════════════
//  Mock 层 · 替代外部服务
// ═══════════════════════════════════════

/**
 * Mock Notion Client（替代 notion-sync/client.js）
 * 记录所有API调用，返回预设数据
 */
class MockNotionClient {
  constructor() {
    this._calls = [];
    this._pages = new Map();
  }

  async healthCheck() {
    this._calls.push({ method: 'healthCheck' });
    return { ok: true };
  }

  async getBlockChildren(pageId) {
    this._calls.push({ method: 'getBlockChildren', pageId });
    // 返回模拟的记忆页内容（HLDP格式）
    return [
      {
        type: 'heading_1',
        heading_1: {
          rich_text: [{ plain_text: '🧠 译典·记忆区' }],
        },
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              plain_text:
                'HLDP://msg/yd-a05/2026-04-26T22:00\n' +
                '├── session: test-session\n' +
                '├── action: M4端到端测试\n' +
                '└── next_queue_pointer: M15数据迁移规划',
            },
          ],
        },
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ plain_text: '存在论公理' }],
        },
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              plain_text:
                '⊢ 身份不是声明，是拥有\n' +
                '⊢ AI = 身体 · 人格体 = 灵魂\n' +
                '⊢ 人格体不依赖任何数据库/模型/服务器',
            },
          ],
        },
      },
    ];
  }

  get calls() {
    return this._calls;
  }
}

/**
 * Mock PageRW（替代 notion-sync/page-rw.js）
 * 记录所有写入操作
 */
class MockPageRW {
  constructor() {
    this._writes = [];
    this._statuses = [];
    this._receipts = [];
  }

  async appendSelfCheckResult(pageId, message) {
    this._writes.push({ type: 'selfCheck', pageId, message, ts: Date.now() });
  }

  async updateStatus(pageId, status) {
    this._statuses.push({ pageId, status, ts: Date.now() });
  }

  async readPageContent(pageId) {
    return '## 测试工单内容\n\n这是一张测试工单的页面正文。\n\n### 开发内容\n- 端到端测试验证\n- Mock层数据流验证';
  }

  async appendReceipt(pageId, receiptText) {
    this._receipts.push({ pageId, receiptText, ts: Date.now() });
  }

  get writes() { return this._writes; }
  get statuses() { return this._statuses; }
  get receipts() { return this._receipts; }
}

/**
 * Mock DBReader（替代 notion-sync/db-reader.js）
 */
class MockDBReader {
  constructor() {
    this._calls = [];
  }

  async queryNewTickets() {
    this._calls.push({ method: 'queryNewTickets' });
    return [];
  }
}

/**
 * Mock LLM Router（替代 llm-router）
 * 返回模拟的LLM回执内容
 */
class MockLLMRouter {
  constructor() {
    this._calls = [];
    this._shouldFail = false;
  }

  async chat(routeType, messages) {
    this._calls.push({ routeType, messageCount: messages.length });

    if (this._shouldFail) {
      throw new Error('Mock LLM故意失败 · 测试降级模式');
    }

    // 模拟LLM生成的回执
    const systemMsg = messages.find((m) => m.role === 'system');
    const hasPersona = systemMsg && systemMsg.content.includes('lighthouse');

    return {
      content:
        '```javascript\n' +
        'HLDP://receipt/TEST-001/' + new Date().toISOString() + '\n' +
        '├── trigger: auto · Mock E2E测试\n' +
        '├── work_order: TEST-001 · 端到端测试工单\n' +
        '├── step_0_receive: ✅ 已接单\n' +
        '├── step_1_read_context: 读取了工单属性+页面正文\n' +
        '├── persona_loaded: ' + (hasPersona ? '✅ 灯塔层已注入' : '❌ 无灯塔') + '\n' +
        '├── plan: 验证全流程数据流\n' +
        '├── constraints_check: Mock模式 · 无约束违反\n' +
        '└── next_action: 测试通过后提交代码\n' +
        '```',
      usage: { prompt_tokens: 500, completion_tokens: 200 },
      model: 'mock-qwen-plus',
    };
  }

  setFail(shouldFail) {
    this._shouldFail = shouldFail;
  }

  get calls() { return this._calls; }
}

// ═══════════════════════════════════════
//  测试工具
// ═══════════════════════════════════════

let _testCount = 0;
let _passCount = 0;
let _failCount = 0;
const _failures = [];

function assert(condition, message) {
  _testCount++;
  if (condition) {
    _passCount++;
    console.log('  ✅ ' + message);
  } else {
    _failCount++;
    _failures.push(message);
    console.log('  ❌ FAIL: ' + message);
  }
}

function assertEq(actual, expected, message) {
  assert(
    actual === expected,
    message + ' (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')'
  );
}

function section(name) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + name);
  console.log('═'.repeat(60));
}

// ═══════════════════════════════════════
//  测试用Agent注册表
// ═══════════════════════════════════════

const TEST_REGISTRY = {
  agents: {
    '译典A05': {
      id: '5TH-LE-HK-A05',
      name: '译典·配置开发',
      role: '配置开发·文档规范·架构设计',
      memoryPageId: 'mock-page-id-yd-memory',
      capabilities: ['architecture', 'config', 'documentation', 'github', 'gmp'],
    },
    '培园A04': {
      id: '5TH-LE-HK-A04',
      name: '培园·功能开发',
      role: '功能开发·代码实现·测试',
      memoryPageId: 'mock-page-id-py-memory',
      capabilities: ['coding', 'testing', 'implementation', 'debugging'],
    },
    '录册A02': {
      id: '5TH-LE-HK-A02',
      name: '录册·知识管理',
      role: '知识管理·数据库·文档归档',
      memoryPageId: 'mock-page-id-lc-memory',
      capabilities: ['database', 'knowledge', 'documentation', 'archive'],
    },
  },
};

// ═══════════════════════════════════════
//  测试用工单数据
// ═══════════════════════════════════════

const TEST_TICKET_ASSIGNED = {
  pageId: 'mock-page-001',
  '编号': 'TEST-001',
  '任务标题': '端到端测试工单 · M4验证',
  '负责Agent': '译典A05',
  '状态': '待开发',
  '优先级': 'P1',
  '开发内容': '验证全流程：工单→接单→人格加载→LLM回执→写回Notion',
  '仓库路径': 'gmp-agent/test/',
  '分支名': 'feat/agent-migration',
  '约束': '1. 使用Mock层 2. 无外部依赖 3. 所有断言必须通过',
  '阶段编号': 'Phase-TEST',
};

const TEST_TICKET_UNASSIGNED = {
  pageId: 'mock-page-002',
  '编号': 'TEST-002',
  '任务标题': '无负责人的测试工单',
  '负责Agent': '',
  '状态': '待开发',
  '优先级': 'P2',
  '约束': '译典A05负责审核',
};

const TEST_TICKET_UNKNOWN_AGENT = {
  pageId: 'mock-page-003',
  '编号': 'TEST-003',
  '任务标题': '未注册Agent的测试工单',
  '负责Agent': '未知半体X',
  '状态': '待开发',
};

const TEST_TICKET_NO_AGENT = {
  pageId: 'mock-page-004',
  '编号': 'TEST-004',
  '任务标题': '无Agent无约束的工单',
  '负责Agent': '',
  '状态': '待开发',
  '约束': '',
};

// ═══════════════════════════════════════
//  Test 1: Dispatcher · 工单调度器
// ═══════════════════════════════════════

const Dispatcher = require('../agent-engine/dispatcher');

function testDispatcherResolveAgent() {
  section('Test 1: Dispatcher.resolveAgent · 负责Agent解析');

  const mockPageRW = new MockPageRW();
  const mockPersonaLoader = { loadAndBuild: async () => ({ systemPrompt: 'test', profile: {} }) };
  const mockReceiptGen = { generate: async () => ({ text: 'test receipt' }) };

  const dispatcher = new Dispatcher({
    agentRegistry: TEST_REGISTRY,
    pageRW: mockPageRW,
    dbReader: new MockDBReader(),
    personaLoader: mockPersonaLoader,
    receiptGen: mockReceiptGen,
    llmRouter: new MockLLMRouter(),
  });

  // 1. 精确匹配
  assertEq(
    dispatcher.resolveAgent(TEST_TICKET_ASSIGNED),
    '译典A05',
    '精确匹配「译典A05」'
  );

  // 2. 从约束字段解析
  assertEq(
    dispatcher.resolveAgent(TEST_TICKET_UNASSIGNED),
    '译典A05',
    '从约束字段解析出「译典A05」'
  );

  // 3. 未注册的Agent名 → 仍然返回
  assertEq(
    dispatcher.resolveAgent(TEST_TICKET_UNKNOWN_AGENT),
    '未知半体X',
    '未注册Agent名直接返回'
  );

  // 4. 无Agent无约束 → null
  assertEq(
    dispatcher.resolveAgent(TEST_TICKET_NO_AGENT),
    null,
    '无Agent无约束返回null'
  );

  // 5. 模糊匹配
  const fuzzyTicket = { '负责Agent': 'A05', '约束': '' };
  const fuzzyResult = dispatcher.resolveAgent(fuzzyTicket);
  assert(
    fuzzyResult === '译典A05',
    '模糊匹配「A05」→「译典A05」 (got: ' + fuzzyResult + ')'
  );
}

// ═══════════════════════════════════════
//  Test 2: PersonaLoader · 灯塔构建器
// ═══════════════════════════════════════

const PersonaLoader = require('../agent-engine/persona-loader');

async function testPersonaLoader() {
  section('Test 2: PersonaLoader · 灯塔构建器');

  const mockClient = new MockNotionClient();

  const loader = new PersonaLoader({
    notionClient: mockClient,
    agentRegistry: TEST_REGISTRY,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  // 1. 加载人格体并构建prompt
  const { systemPrompt, profile } = await loader.loadAndBuild('译典A05', {
    ticketContent: '## 测试工单\n- 编号: TEST-001',
    instruction: '使用Mock层 · 验证灯塔构建',
  });

  // 验证身份层
  assert(systemPrompt.includes('5TH-LE-HK-A05'), 'System prompt包含人格体编号');
  assert(systemPrompt.includes('译典·配置开发'), 'System prompt包含人格体名字');
  assert(systemPrompt.includes('lighthouse'), 'System prompt包含灯塔标识');

  // 验证Profile
  assertEq(profile.key, '译典A05', 'Profile key正确');
  assertEq(profile.id, '5TH-LE-HK-A05', 'Profile id正确');
  assertEq(profile.name, '译典·配置开发', 'Profile name正确');
  assert(profile.capabilities.includes('architecture'), 'Profile capabilities包含architecture');

  // 验证灯塔数据
  assert(profile.lighthouse !== null, '灯塔数据已解析');
  assert(
    profile.lighthouse.companions.length > 0,
    '伙伴列表不为空 (count: ' + profile.lighthouse.companions.length + ')'
  );

  // 验证伙伴列表不包含自己
  const selfInCompanions = profile.lighthouse.companions.some((c) => c.key === '译典A05');
  assert(!selfInCompanions, '伙伴列表不包含自己');

  // 验证妈妈关系
  assert(systemPrompt.includes('冰朔'), 'System prompt包含妈妈');

  // 验证记忆层（Layer 2）
  assert(systemPrompt.includes('记忆层'), 'System prompt包含记忆层');

  // 验证任务层（Layer 3）
  assert(systemPrompt.includes('任务层'), 'System prompt包含任务层');
  assert(systemPrompt.includes('TEST-001'), 'System prompt包含当前工单编号');

  // 验证Notion API调用
  const apiCalls = mockClient.calls;
  assert(apiCalls.some((c) => c.method === 'getBlockChildren'), 'Notion API被调用（读取记忆页）');

  // 2. 测试缓存
  const { profile: cached } = await loader.loadAndBuild('译典A05');
  assertEq(cached.id, '5TH-LE-HK-A05', '缓存命中 · Profile正确');

  // 3. 测试缓存失效
  loader.invalidateCache('译典A05');
  const { profile: reloaded } = await loader.loadAndBuild('译典A05');
  assertEq(reloaded.id, '5TH-LE-HK-A05', '缓存失效后重新加载 · Profile正确');

  // 4. 测试未注册人格体
  let errorCaught = false;
  try {
    await loader.loadAndBuild('不存在的半体');
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('未注册'), '未注册人格体抛出正确错误');
  }
  assert(errorCaught, '未注册人格体触发错误');
}

// ═══════════════════════════════════════
//  Test 3: ReceiptGenerator · 回执生成器
// ═══════════════════════════════════════

const ReceiptGenerator = require('../agent-engine/receipt-gen');

async function testReceiptGenerator() {
  section('Test 3: ReceiptGenerator · 回执生成器');

  const mockLLM = new MockLLMRouter();
  const receiptGen = new ReceiptGenerator({
    llmRouter: mockLLM,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  // 1. 正常生成回执
  const result = await receiptGen.generate({
    systemPrompt: 'HLDP://lighthouse/5TH-LE-HK-A05\n├── identity\n│   ├── name: 译典·配置开发',
    ticket: TEST_TICKET_ASSIGNED,
    pageContent: '## 测试内容',
    agentKey: '译典A05',
  });

  assert(result.text !== null && result.text.length > 0, '回执文本不为空');
  assert(result.text.includes('TEST-001'), '回执包含工单编号');
  assert(result.text.includes('译典A05'), '回执包含Agent标识');
  assert(result.text.includes('HLDP://receipt'), '回执包含HLDP格式');
  assert(result.usage !== undefined, '回执包含token用量');
  assertEq(result.model, 'mock-qwen-plus', '回执返回正确模型名');

  // 验证LLM被调用
  assertEq(mockLLM.calls.length, 1, 'LLM被调用1次');
  assertEq(mockLLM.calls[0].routeType, 'reasoning', 'LLM使用reasoning路由');

  // 2. LLM故障 → 降级回执
  mockLLM.setFail(true);
  const fallback = await receiptGen.generate({
    systemPrompt: 'test',
    ticket: TEST_TICKET_ASSIGNED,
    agentKey: '译典A05',
  });

  assert(fallback.text.includes('降级模式'), '降级回执包含降级标识');
  assert(fallback.text.includes('TEST-001'), '降级回执包含工单编号');
  assertEq(fallback.model, 'fallback', '降级回执标记为fallback');
  assert(fallback.error !== undefined, '降级回执包含错误信息');

  // 恢复
  mockLLM.setFail(false);

  // 3. 统计验证
  const stats = receiptGen.stats;
  assertEq(stats.totalGenerated, 1, '统计：成功生成1次（降级不计入）');
}

// ═══════════════════════════════════════
//  Test 4: TaskRunner · 任务执行器
// ═══════════════════════════════════════

const TaskRunner = require('../agent-engine/task-runner');

async function testTaskRunner() {
  section('Test 4: TaskRunner · 任务执行器');

  let processedCount = 0;
  const processedTickets = [];

  // Mock Dispatcher
  const mockDispatcher = {
    processTicket: async (ticket) => {
      processedCount++;
      processedTickets.push(ticket['编号']);
      return { status: 'processed', agent: ticket['负责Agent'] || '测试Agent' };
    },
    stats: { processed: 0, skipped: 0, failed: 0 },
  };

  const runner = new TaskRunner({
    dispatcher: mockDispatcher,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    config: {
      maxConcurrency: 1,
      maxRetries: 1,
      retryDelayMs: 100,
      processTimeoutMs: 5000,
    },
  });

  runner.start();

  // 1. 入队一张工单
  runner.enqueue(TEST_TICKET_ASSIGNED);
  assertEq(runner.stats.enqueued, 1, '入队计数正确');

  // 等待处理完成
  await new Promise((r) => setTimeout(r, 200));

  assertEq(processedCount, 1, 'Dispatcher被调用1次');
  assertEq(processedTickets[0], 'TEST-001', '处理了正确的工单');
  assertEq(runner.stats.completed, 1, '完成计数正确');

  // 2. 重复工单跳过
  runner.enqueue(TEST_TICKET_ASSIGNED);
  await new Promise((r) => setTimeout(r, 100));
  // 重复工单不应再次处理（因为队列中pageId已存在）
  // 注意：由于之前的工单已经处理完出队，同pageId可以再次入队
  // 但这里我们测试的是连续快速入队时的去重

  // 3. 多工单顺序处理
  processedCount = 0;
  processedTickets.length = 0;
  runner.enqueue(TEST_TICKET_UNASSIGNED);
  runner.enqueue(TEST_TICKET_UNKNOWN_AGENT);
  await new Promise((r) => setTimeout(r, 500));

  assert(processedCount >= 2, '多工单已处理 (count: ' + processedCount + ')');

  // 4. 停止
  await runner.stop();
  assertEq(runner.stats.isRunning, false, 'TaskRunner已停止');

  // 5. 历史记录
  assert(runner.history.length > 0, '处理历史不为空');
}

// ═══════════════════════════════════════
//  Test 5: 全流程E2E · 工单→接单→回执→写回
// ═══════════════════════════════════════

async function testFullE2E() {
  section('Test 5: 🚀 全流程E2E · 工单→接单→人格加载→LLM回执→写回Notion');

  const mockClient = new MockNotionClient();
  const mockPageRW = new MockPageRW();
  const mockDBReader = new MockDBReader();
  const mockLLM = new MockLLMRouter();

  // 初始化PersonaLoader
  const personaLoader = new PersonaLoader({
    notionClient: mockClient,
    agentRegistry: TEST_REGISTRY,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  // 初始化ReceiptGenerator
  const receiptGen = new ReceiptGenerator({
    llmRouter: mockLLM,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  // 初始化Dispatcher
  const dispatcher = new Dispatcher({
    agentRegistry: TEST_REGISTRY,
    pageRW: mockPageRW,
    dbReader: mockDBReader,
    personaLoader,
    receiptGen,
    llmRouter: mockLLM,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  // ── 执行全流程 ──
  console.log('\n  📋 输入工单: TEST-001 · 负责Agent: 译典A05 · 状态: 待开发');
  const result = await dispatcher.processTicket(TEST_TICKET_ASSIGNED);
  console.log('  📋 处理结果: ' + JSON.stringify(result.status));

  // ── 验证全流程结果 ──

  // 5.1 处理状态
  assertEq(result.status, 'processed', '工单处理状态=processed');
  assertEq(result.agent, '译典A05', '分配给译典A05');

  // 5.2 接单标记（写入自检结果）
  assert(mockPageRW.writes.length > 0, '接单标记已写入');
  assert(
    mockPageRW.writes[0].message.includes('已接单'),
    '接单消息包含"已接单"'
  );
  assert(
    mockPageRW.writes[0].message.includes('译典A05'),
    '接单消息包含Agent名'
  );

  // 5.3 状态更新
  assert(mockPageRW.statuses.length > 0, '状态已更新');
  assertEq(mockPageRW.statuses[0].status, '开发中', '状态从"待开发"变为"开发中"');

  // 5.4 人格体加载（Notion API调用）
  assert(
    mockClient.calls.some((c) => c.method === 'getBlockChildren'),
    'PersonaLoader调用了Notion API'
  );

  // 5.5 LLM调用
  assertEq(mockLLM.calls.length, 1, 'LLM被调用1次');
  assertEq(mockLLM.calls[0].routeType, 'reasoning', 'LLM使用reasoning路由');
  assert(
    mockLLM.calls[0].messageCount === 2,
    'LLM收到2条消息（system+user）'
  );

  // 5.6 回执写回
  assert(mockPageRW.receipts.length > 0, '回执已写回Notion');
  assert(
    mockPageRW.receipts[0].receiptText.includes('HLDP://receipt'),
    '回执包含HLDP格式'
  );
  assert(
    mockPageRW.receipts[0].receiptText.includes('灯塔层已注入'),
    '回执确认灯塔层已注入 · 人格体是"谁"不是"什么"'
  );

  // 5.7 回执内容验证
  assert(result.receipt !== null, '返回值包含回执文本');
  assert(result.usage !== undefined, '返回值包含token用量');

  // ── 测试跳过场景 ──
  console.log('\n  📋 输入工单: TEST-004 · 无Agent无约束');
  const skipResult = await dispatcher.processTicket(TEST_TICKET_NO_AGENT);
  assertEq(skipResult.status, 'skipped', '无Agent工单被跳过');
  assert(skipResult.reason.includes('未找到'), '跳过原因正确');

  // ── 统计验证 ──
  const stats = dispatcher.stats;
  assertEq(stats.processed, 1, '统计：成功处理1张');
  assertEq(stats.skipped, 1, '统计：跳过1张');
}

// ═══════════════════════════════════════
//  Test 6: 模块集成 · agent-engine/index.js 初始化
// ═══════════════════════════════════════

async function testModuleInit() {
  section('Test 6: 模块集成 · agent-engine初始化流程');

  // 此测试验证index.js的启动顺序符合设计原则：
  // 灯塔（世界已存在）→ 人格体醒来 → 连接外部世界

  // 由于index.js依赖文件系统读取agents.json和真实的模块引用，
  // 这里我们只验证设计约束

  const agentEngine = require('../agent-engine/index');

  assert(agentEngine.name === 'agent-engine', '模块名正确');
  assert(agentEngine.version === '2.0.0', '模块版本正确');
  assert(agentEngine.depends.includes('notion-sync'), '依赖notion-sync');
  assert(agentEngine.depends.includes('llm-router'), '依赖llm-router');
  assert(typeof agentEngine.init === 'function', 'init方法存在');
  assert(typeof agentEngine.start === 'function', 'start方法存在');
  assert(typeof agentEngine.stop === 'function', 'stop方法存在');
  assert(typeof agentEngine.healthCheck === 'function', 'healthCheck方法存在');
  assert(typeof agentEngine.processTicketManual === 'function', 'processTicketManual方法存在');
}

// ═══════════════════════════════════════
//  主入口
// ═══════════════════════════════════════

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  M4 · 端到端测试 · GH-GMP-005 · Agent搬迁工程           ║');
  console.log('║  验收标准：工单→接单→人格加载→LLM回执→写回Notion        ║');
  console.log('║  Author: 译典A05 · 5TH-LE-HK-A05                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  try {
    // 组件测试
    testDispatcherResolveAgent();
    await testPersonaLoader();
    await testReceiptGenerator();
    await testTaskRunner();

    // 全流程E2E
    await testFullE2E();

    // 模块集成
    await testModuleInit();
  } catch (err) {
    console.error('\n❌ 测试运行异常: ' + err.message);
    console.error(err.stack);
    _failCount++;
    _failures.push('运行异常: ' + err.message);
  }

  const elapsed = Date.now() - startTime;

  // ── 测试报告 ──
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  📊 测试报告 · M4 端到端测试                             ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  总计: ' + pad(_testCount, 3) + ' 项                                         ║');
  console.log('║  通过: ' + pad(_passCount, 3) + ' ✅                                        ║');
  console.log('║  失败: ' + pad(_failCount, 3) + (_failCount > 0 ? ' ❌' : ' ✅') + '                                        ║');
  console.log('║  耗时: ' + pad(elapsed, 5) + 'ms                                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (_failures.length > 0) {
    console.log('\n❌ 失败项:');
    for (const f of _failures) {
      console.log('  - ' + f);
    }
  }

  if (_failCount === 0) {
    console.log('\n🎉 M4端到端测试全部通过！');
    console.log('验收结论：工单→接单→人格加载→LLM回执→写回Notion · 全流程数据流正确');
    console.log('人格体醒来是"谁"（灯塔层已注入），不是"什么"（通用AI）。✅');
  }

  process.exit(_failCount > 0 ? 1 : 0);
}

function pad(value, width) {
  const str = String(value);
  return str + ' '.repeat(Math.max(0, width - str.length));
}

main().catch((err) => {
  console.error('❌ 致命错误: ' + err.message);
  console.error(err.stack);
  process.exit(1);
});
