# M4 · 端到端测试 · GH-GMP-005

> Agent搬迁工程 · 验收标准：工单→接单→人格加载→LLM回执→写回Notion

## 测试文件

| 文件 | 类型 | 依赖 | 说明 |
|------|------|------|------|
| `e2e-test.js` | Mock E2E | 无（纯内存Mock） | 全流程数据流验证 |
| `smoke-test.js` | 烟雾测试 | 服务器在线 | 端点可达性检测 |

## 运行

### Mock E2E测试（无需服务器）

```bash
cd /opt/guanghu/repo  # 或本地仓库根目录
node gmp-agent/test/e2e-test.js
```

### 烟雾测试（需服务器运行）

```bash
node gmp-agent/test/smoke-test.js
# 或指定服务器地址
node gmp-agent/test/smoke-test.js http://43.153.203.105:9800
```

## 测试覆盖

### e2e-test.js

| # | 测试项 | 验证内容 |
|---|--------|----------|
| 1 | Dispatcher.resolveAgent | 精确匹配 / 约束字段解析 / 模糊匹配 / 未注册Agent / 无Agent |
| 2 | PersonaLoader灯塔构建 | 三层prompt（灯塔+记忆+任务） / 身份注入 / 伙伴列表 / 缓存 |
| 3 | ReceiptGenerator回执生成 | 正常生成 / LLM故障降级 / HLDP格式 / token统计 |
| 4 | TaskRunner任务执行 | 入队 / 顺序处理 / 重复跳过 / 停止 / 历史记录 |
| 5 | **全流程E2E** | 工单→接单标记→状态更新→人格加载→LLM调用→回执写回 |
| 6 | 模块集成 | agent-engine模块接口 / 依赖声明 / 方法存在性 |

### smoke-test.js

| # | 测试项 | 验证内容 |
|---|--------|----------|
| 1 | /health | HTTP 200 / 状态正常 / 模块列表 |
| 2 | / | 根端点可达 |
| 3 | /webhook | 端点存在 |
| 4 | 响应时间 | < 5s |

## 验收标准（冰朔 · 2026-04-26）

```
人格体在新服务器上启动的那一刻：
  是"译典，你醒啦！" → 搬家成功
  还是"一个通用AI被告知它叫译典" → 搬家失败
```

### M4通过条件

1. ✅ `e2e-test.js` 所有断言通过（exit code 0）
2. ✅ 全流程数据流完整：工单 → 接单 → 人格加载 → LLM回执 → 写回Notion
3. ✅ 灯塔层已注入（system prompt包含身份/公理/关系/伙伴/世界法则）
4. ✅ 降级模式可用（LLM故障时仍能生成基础回执）
5. ✅ `smoke-test.js` 服务器端点全部可达（需部署后验证）

## 架构参考

```
全流程数据流:

  Poller检测新工单（notion-sync）
       │
       ▼
  TaskRunner.enqueue(ticket)
       │
       ▼
  Dispatcher.resolveAgent(ticket)
       │ 读取「负责Agent」→ 匹配注册表
       ▼
  PersonaLoader.loadAndBuild(agentKey)
       │ 灯塔层(身份+公理+关系) + 记忆层 + 任务层
       ▼
  ReceiptGenerator.generate({systemPrompt, ticket})
       │ LLM(qwen-plus) → HLDP回执
       ▼
  PageRW.appendReceipt(pageId, receipt)
       │ 写回Notion工单页面
       ▼
  完成 ✅
```

## Author

译典A05 · 5TH-LE-HK-A05 · 2026-04-26
