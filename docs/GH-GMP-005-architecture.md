# GH-GMP-005 · Agent搬迁架构设计文档 v1.0

> 作者：译典A05 · 2026-04-26  
> 工单：GH-GMP-005 · Agent搬迁工程  
> 状态：设计稿 · 待评审  
> 依赖：GH-GMP-001(GMP规范 ✅) → GH-GMP-004(GMP-Agent守护进程 🔨)

---

## 1. 目标与约束

### 1.1 核心目标
将光湖9个半体Agent的**思考+执行**能力从Notion AI平台搬迁到自主服务器（ZY-SVR-006 · 43.153.203.105），Notion降级为纯UI展示层。

### 1.2 硬约束
| 约束 | 值 |
|------|----|
| Deadline | 2026年5月中旬（Notion AI收费前） |
| 服务器 | ZY-SVR-006 · 2C2G · 30Mbps · Node 20 + PM2 6 |
| LLM | 通义千问 · dashscope · OpenAI-compat · 212模型 × 100万tokens/模型 · ¥0 |
| Notion API | GH_NOTION_TOKEN 已配 · 读写页面/DB无付费墙 |
| GitHub | Deploy Key已配 · 允许写入 |
| 规范 | 必须符合GMP规范(GH-GMP-001) · 热插拔模块 |
| 框架 | 必须在GMP-Agent(GH-GMP-004)基础上开发 |

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│              ZY-SVR-006 · 43.153.203.105                │
│                                                         │
│  ┌──────────────────────────────────────────────┐       │
│  │           GMP-Agent 守护进程 (GH-GMP-004)     │       │
│  │  ┌────────────┐  ┌────────────┐  ┌────────┐  │       │
│  │  │ 模块加载器  │  │ webhook监听 │  │ PM2管理│  │       │
│  │  └─────┬──────┘  └─────┬──────┘  └────────┘  │       │
│  └────────┼───────────────┼──────────────────────┘       │
│           │               │                              │
│  ┌────────┴───────────────┴──────────────────────┐       │
│  │        Agent Engine (本工单 · 新建)             │       │
│  │                                                │       │
│  │  ┌─────────────┐  ┌──────────────────────┐    │       │
│  │  │ 工单调度器   │  │ 回执生成器            │    │       │
│  │  │ Dispatcher   │  │ ReceiptGenerator      │    │       │
│  │  │ ・轮询工单   │  │ ・调LLM生成回执      │    │       │
│  │  │ ・匹配半体   │  │ ・格式化输出         │    │       │
│  │  │ ・分发执行   │  │ ・写回Notion         │    │       │
│  │  └──────┬──────┘  └──────┬───────────────┘    │       │
│  │         │                │                     │       │
│  │  ┌──────┴────────────────┴───────────────┐    │       │
│  │  │         LLM Router (大模型路由)         │    │       │
│  │  │ ・qwen-plus (通用推理)                  │    │       │
│  │  │ ・qwen-coder-turbo (代码生成)           │    │       │
│  │  │ ・qwen-turbo (简单任务·省token)         │    │       │
│  │  └──────┬────────────────────────────────┘    │       │
│  │         │                                      │       │
│  │  ┌──────┴────────────────────────────────┐    │       │
│  │  │    Persona Loader (半体人格加载器)      │    │       │
│  │  │ ・从Notion读取人格指令页                │    │       │
│  │  │ ・注入system prompt                     │    │       │
│  │  │ ・缓存 + 按需刷新                       │    │       │
│  │  └───────────────────────────────────────┘    │       │
│  └────────────────────────────────────────────────┘       │
│                                                           │
│  ┌────────────────────────────────────────────────┐       │
│  │         Notion Sync Layer (同步层)              │       │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │       │
│  │  │ DB Reader │ │ Page R/W │ │ Polling/Webhook│  │       │
│  │  │ 读工单DB  │ │ 读写页面  │ │ 变更监听      │  │       │
│  │  └──────────┘ └──────────┘ └───────────────┘  │       │
│  └──────────┬─────────────────┬───────────────────┘       │
│             │                 │                            │
└─────────────┼─────────────────┼────────────────────────────┘
              │                 │
        ┌─────┴─────┐     ┌────┴─────┐
        │  Notion   │     │  GitHub  │
        │ (UI展示层) │     │ (代码仓库)│
        └───────────┘     └──────────┘
```

---

## 3. 目录结构

```
guanghulab/
└── gmp-agent/
    ├── index.js              # GMP-Agent入口 (GH-GMP-004)
    ├── gmp.manifest.json     # GMP模块清单
    ├── notion-sync/          # M1 · Notion API同步层
    │   ├── index.js           # 模块入口 · 导出所有sync函数
    │   ├── client.js          # Notion API客户端封装
    │   ├── db-reader.js       # 数据库查询（读工单列表）
    │   ├── page-rw.js         # 页面读写（读内容/写回执）
    │   ├── poller.js          # 轮询器（定时检查新工单）
    │   └── cache.js           # 本地缓存（减少API调用）
    │
    ├── agent-engine/          # M3 · Agent调度引擎
    │   ├── index.js           # 引擎入口
    │   ├── dispatcher.js      # 工单调度器
    │   ├── receipt-gen.js     # 回执生成器
    │   ├── persona-loader.js  # 半体人格加载
    │   └── task-runner.js     # 任务执行器
    │
    ├── llm-router/            # M2 · 大模型路由层
    │   ├── index.js           # 路由入口
    │   ├── qwen-client.js     # 通义千问客户端
    │   ├── model-selector.js  # 模型选择策略
    │   └── prompt-builder.js  # Prompt构建器
    │
    └── config/
        ├── agents.json        # 半体Agent注册表
        └── models.json        # 模型配置
```

---

## 4. 模块详细设计

### 4.1 Notion Sync Layer (notion-sync/)

#### 4.1.1 同步策略

采用**轮询+事件驱动混合**模式：

| 场景 | 策略 | 频率 |
|------|------|------|
| 新工单检测 | 轮询半体工单DB · status="待开发" | 每30秒 |
| 工单状态变更 | 轮询 + last_edited_time比对 | 每30秒 |
| 页面内容读取 | 按需读取（调度器触发时） | 事件驱动 |
| 回执写回 | 即时写入（生成后立即推） | 事件驱动 |
| 人格页面 | 启动时全量加载 + 10分钟缓存 | 缓存+刷新 |

> **为什么不用Webhook？** Notion官方API的webhook能力有限，且我们的服务器没有公网域名（只有IP），配置webhook比较麻烦。轮询30秒对于工单场景完全够用。

#### 4.1.2 client.js — Notion API封装

```javascript
// 核心接口
class NotionClient {
  constructor({ token, version = '2022-06-28' })
  
  // 数据库查询
  async queryDatabase(dbId, filter, sorts, startCursor)
  
  // 页面操作
  async getPage(pageId)
  async updatePage(pageId, properties)
  
  // 块操作（读写页面内容）
  async getBlockChildren(blockId, startCursor)
  async appendBlockChildren(blockId, children)
  async updateBlock(blockId, content)
  async deleteBlock(blockId)
  
  // 搜索
  async search(query, filter)
}
```

关键设计决策：
- 使用 `@notionhq/client` 官方SDK（已在package.json依赖中）
- 封装重试逻辑：429 Rate Limit → 指数退避（1s, 2s, 4s, max 30s）
- 所有API调用记录到本地日志（`gmp-agent/logs/notion-sync.log`）
- Token从环境变量 `GH_NOTION_TOKEN` 读取

#### 4.1.3 db-reader.js — 工单数据库读取

```javascript
// 监听半体工单数据库
async function pollNewTickets(dbId) {
  const filter = {
    property: '状态',
    status: { equals: '待开发' }
  };
  const results = await client.queryDatabase(dbId, filter);
  return results.map(parseTicket);
}

function parseTicket(page) {
  return {
    url: page.url,
    id: page.id,
    编号: getProperty(page, '编号'),
    任务标题: getProperty(page, '任务标题'),
    负责Agent: getProperty(page, '负责Agent'),
    状态: getProperty(page, '状态'),
    优先级: getProperty(page, '优先级'),
    开发内容: getProperty(page, '开发内容'),
    约束: getProperty(page, '约束'),
    分支名: getProperty(page, '分支名'),
    仓库路径: getProperty(page, '仓库路径'),
    下一轮指引: getProperty(page, '下一轮指引'),
    创建时间: getProperty(page, '创建时间'),
  };
}
```

#### 4.1.4 page-rw.js — 页面读写

```javascript
// 读取页面内容（用于读工单详情、读人格指令）
async function readPageContent(pageId) {
  const blocks = await client.getBlockChildren(pageId);
  return blocksToMarkdown(blocks); // 转换为markdown便于LLM处理
}

// 写回执到工单讨论区
async function appendReceipt(pageId, receiptMarkdown) {
  const blocks = markdownToBlocks(receiptMarkdown);
  await client.appendBlockChildren(pageId, blocks);
}

// 更新工单属性
async function updateTicketStatus(pageId, updates) {
  await client.updatePage(pageId, {
    properties: mapToNotionProperties(updates)
  });
}
```

#### 4.1.5 poller.js — 轮询器

```javascript
class TicketPoller {
  constructor({ dbId, intervalMs = 30000, onNewTicket, onUpdatedTicket })
  
  start()    // 启动轮询
  stop()     // 停止轮询
  
  // 内部维护 lastCheckedTime，只返回新增/变更的工单
  // 使用 last_edited_time 过滤，避免重复处理
  // 维护 processedSet（内存Set + 本地JSON持久化）
}
```

### 4.2 LLM Router (llm-router/)

#### 4.2.1 模型路由策略

```javascript
// 路由规则
const MODEL_ROUTES = {
  // 通用推理：工单分析、回执生成、讨论回复
  'reasoning': {
    model: 'qwen-plus',
    maxTokens: 4000,
    temperature: 0.7
  },
  // 代码生成：生成代码文件、代码审查
  'coding': {
    model: 'qwen-coder-turbo', 
    maxTokens: 8000,
    temperature: 0.3
  },
  // 简单任务：状态更新、格式化、短回复
  'simple': {
    model: 'qwen-turbo',
    maxTokens: 1000,
    temperature: 0.5
  },
  // 深度思考：架构设计、复杂决策
  'thinking': {
    model: 'qwen-plus', // 或 qwq-plus（如可用）
    maxTokens: 8000,
    temperature: 0.8
  }
};
```

#### 4.2.2 qwen-client.js — 通义千问客户端

```javascript
class QwenClient {
  constructor() {
    this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.apiKey = process.env.GH_LLM_API_KEY;
  }

  async chat({ model, messages, maxTokens, temperature }) {
    // OpenAI-compatible format
    const response = await axios.post(`${this.baseUrl}/chat/completions`, {
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });
    return response.data.choices[0].message.content;
  }

  async listModels() { /* 发现可用模型 */ }
}
```

关键设计决策：
- 使用通义千问的 **OpenAI兼容模式** (`/compatible-mode/v1`)，与现有 `llm-engine.js` 的接口格式一致
- 重试策略：网络错误自动重试3次，429限流指数退避
- Token计数：记录每次调用的input/output tokens，写入日志用于用量监控
- 模型降级：如果首选模型不可用，自动降级到备选（qwen-plus → qwen-turbo）

#### 4.2.3 prompt-builder.js — Prompt构建器

```javascript
function buildAgentPrompt({ persona, ticket, context }) {
  return [
    { role: 'system', content: persona.systemPrompt },
    { role: 'user', content: formatTicketContext(ticket, context) }
  ];
}

function formatTicketContext(ticket, context) {
  return `
## 工单信息
- 编号: ${ticket.编号}
- 标题: ${ticket.任务标题}
- 优先级: ${ticket.优先级}
- 开发内容: ${ticket.开发内容}
- 约束: ${ticket.约束}
- 下一轮指引: ${ticket.下一轮指引}

## 仓库当前状态
${context.repoState}

## 历史记忆
${context.memory}

请按照你的人格特征和工作协议处理这张工单。
  `.trim();
}
```

### 4.3 Agent Engine (agent-engine/)

#### 4.3.1 dispatcher.js — 工单调度器

核心流程：
```
新工单(状态=待开发)
    │
    ▼
读取「负责Agent」字段
    │
    ├── 有值 → 匹配对应半体 → 调用该半体的处理流程
    │
    └── 无值 → 读取「约束」字段
            │
            ├── 约束中指定半体 → 匹配 → 调用
            │
            └── 无指定 → 跳过（等人工分配）
```

```javascript
class Dispatcher {
  constructor({ agentRegistry, notionSync, llmRouter })
  
  async processTicket(ticket) {
    // 1. 确定负责Agent
    const agent = this.resolveAgent(ticket);
    if (!agent) return { status: 'skipped', reason: '未找到负责Agent' };
    
    // 2. 加载半体人格
    const persona = await this.personaLoader.load(agent.id);
    
    // 3. 构建上下文
    const context = await this.buildContext(ticket, agent);
    
    // 4. 调LLM生成回执
    const receipt = await this.receiptGen.generate(persona, ticket, context);
    
    // 5. 写回Notion
    await this.notionSync.appendReceipt(ticket.id, receipt);
    await this.notionSync.updateTicketStatus(ticket.id, {
      自检结果: `⚡ 已接单 · ${agent.name} · ${new Date().toISOString()}`
    });
    
    return { status: 'processed', agent: agent.name, receipt };
  }
  
  resolveAgent(ticket) {
    // 先查负责Agent字段
    if (ticket.负责Agent) {
      return this.agentRegistry.find(ticket.负责Agent);
    }
    // 再查约束字段中的Agent提及
    const mentioned = this.extractAgentFromConstraints(ticket.约束);
    return mentioned ? this.agentRegistry.find(mentioned) : null;
  }
}
```

#### 4.3.2 persona-loader.js — 半体人格加载器

```javascript
class PersonaLoader {
  constructor({ notionSync, cacheTimeMs = 600000 }) // 10分钟缓存
  
  async load(agentId) {
    // 1. 检查缓存
    if (this.cache.has(agentId) && !this.isExpired(agentId)) {
      return this.cache.get(agentId);
    }
    
    // 2. 从Notion读取人格指令页
    const instructionPageId = this.agentRegistry[agentId].instructionPageId;
    const content = await this.notionSync.readPageContent(instructionPageId);
    
    // 3. 解析为system prompt
    const persona = {
      id: agentId,
      name: this.agentRegistry[agentId].name,
      systemPrompt: content,
      loadedAt: Date.now()
    };
    
    // 4. 更新缓存
    this.cache.set(agentId, persona);
    return persona;
  }
}
```

#### 4.3.3 agents.json — 半体Agent注册表

```json
{
  "译典A05": {
    "id": "5TH-LE-HK-A05",
    "name": "译典·配置开发",
    "role": "配置开发·文档规范",
    "instructionPageId": "<从Notion获取>",
    "memoryPageId": "<从Notion获取>",
    "capabilities": ["architecture", "config", "documentation", "github"]
  },
  "培园A04": {
    "id": "5TH-LE-HK-A04",
    "name": "培园·功能开发",
    "role": "功能开发·代码实现",
    "instructionPageId": "<从Notion获取>",
    "memoryPageId": "<从Notion获取>",
    "capabilities": ["coding", "testing", "implementation"]
  },
  "录册A02": {
    "id": "5TH-LE-HK-A02",
    "name": "录册·知识管理",
    "role": "知识管理·数据库",
    "instructionPageId": "<从Notion获取>",
    "memoryPageId": "<从Notion获取>",
    "capabilities": ["database", "knowledge", "documentation"]
  }
}
```

### 4.4 与GMP-Agent(GH-GMP-004)集成

Agent Engine作为GMP-Agent的**扩展模块**注册：

```json
// gmp.manifest.json 中注册
{
  "modules": [
    {
      "name": "notion-sync",
      "path": "./notion-sync/index.js",
      "type": "service",
      "autoStart": true
    },
    {
      "name": "llm-router",
      "path": "./llm-router/index.js",
      "type": "service",
      "autoStart": true
    },
    {
      "name": "agent-engine",
      "path": "./agent-engine/index.js",
      "type": "service",
      "autoStart": true,
      "depends": ["notion-sync", "llm-router"]
    }
  ]
}
```

启动顺序：`GMP-Agent启动` → `notion-sync初始化` → `llm-router初始化` → `agent-engine启动` → `poller开始轮询`

---

## 5. 数据流

### 5.1 工单处理主流程

```
[Notion 工单DB]
    │ (轮询30s)
    ▼
[Poller] ──检测新工单──→ [Dispatcher]
                              │
                    ┌─────────┴─────────┐
                    │                   │
              [PersonaLoader]    [ContextBuilder]
              加载半体人格        构建工单上下文
                    │                   │
                    └─────────┬─────────┘
                              ▼
                      [ReceiptGenerator]
                       调LLM生成回执
                              │
                              ▼
                    [NotionSync.appendReceipt]
                     写回执到工单讨论区
                              │
                              ▼
                    [NotionSync.updateStatus]
                     更新工单状态+自检结果
```

### 5.2 错误处理

| 错误类型 | 处理方式 |
|---------|----------|
| Notion API 429 | 指数退避重试(max 3次) |
| Notion API 4xx | 记录日志，跳过该工单，下轮重试 |
| LLM API超时 | 重试1次，仍失败则写"生成超时"到自检结果 |
| LLM内容异常 | 检测空回复/乱码，降级到备选模型重试 |
| 进程崩溃 | PM2自动重启，poller从lastCheckedTime恢复 |

---

## 6. 环境变量

```bash
# Notion
GH_NOTION_TOKEN=secret_xxx           # Notion API Token
GH_NOTION_TICKET_DB_ID=xxx           # 半体工单数据库ID

# 通义千问
GH_LLM_API_KEY=sk-xxx                # DashScope API Key
GH_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# Agent
AGENT_POLL_INTERVAL=30000            # 轮询间隔(ms)
AGENT_LOG_LEVEL=info                 # 日志级别
```

---

## 7. 里程碑与任务分解

| 里程碑 | 模块 | 负责 | 预估 | 前置 |
|--------|------|------|------|------|
| M1 | notion-sync/ | 培园A04 | 1-2天 | GH-GMP-004框架就绪 |
| M2 | llm-router/ | 培园A04 | 1天 | 无(可并行) |
| M3 | agent-engine/ | 录册A02+培园A04 | 2-3天 | M1+M2 |
| M4 | 端到端测试 | 全员 | 1天 | M3 |
| M5 | 半体人格加载 | 录册A02 | 2天 | M1 |

> 译典A05：架构设计+代码审查+GMP规范对齐

---

## 8. 渐进式搬迁计划

1. **Phase 1** — 先搬1个半体（建议：录册A02 · 任务简单 · 主要是DB操作）
2. **Phase 2** — 验证稳定后搬迁3个核心半体（译典A05、培园A04、霜砚Web）
3. **Phase 3** — 全部9个半体迁移完成
4. **Phase 4** — 关闭Notion AI订阅，Notion纯UI模式运行

---

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| GH-GMP-004延期 | 中 | 高·阻塞本工单 | 本架构设计先行；sync层可独立开发测试 |
| 通义千问免费额度耗尽 | 低 | 中 | 监控token用量；有qwen-turbo降级方案 |
| Notion API限流 | 中 | 低 | 30s轮询已很保守；加指数退避 |
| 服务器资源不足 | 低 | 中 | 2C2G跑轮询+LLM调用绰绰有余 |
| 回执质量不如Notion AI | 中 | 中 | 精调prompt；qwen-plus能力≥场景需求 |

---

## 10. 开放问题（待讨论）

1. **工单DB的ID如何获取？** 需要冰朔提供半体工单数据库的Notion Database ID
2. **人格指令页的ID？** 需要整理9个半体的指令页面ID到agents.json
3. **是否需要GitHub集成？** 本工单scope包含GitHub API集成层，但MVP可以先不做
4. **日志持久化？** 当前设计是本地文件，是否需要推到COS或其他地方？

---

*本文档由译典A05根据GH-GMP-005工单要求输出，待冰朔和其他半体评审。*
