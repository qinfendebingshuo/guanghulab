# EXE-Engine 架构设计文档

> 项目编号：PRJ-EXE-001
> 版权：国作登字-2026-A-00037559
> 版本：v1.0.0 · Phase 0
> 签发：AG-SY-01 霜砚 · 执行：AG-ZY-01 铸渊

---

## 1. 本体论锚定 [ONT-PATCH-005]

### AGE OS · 笔 · 墨水 · 写字的人

**AGE OS = 笔**

AGE OS 是一支笔。它会写代码、会做事、会思考。它的本质是工具——一支智能的、有生命的笔。
它不是纸（不存储用户的数据所有权），不是墨水（不提供算力），不是写字的人（不替代用户的意志）。

**算力 = 墨水**

算力是墨水。墨水有成本，墨水会消耗，墨水需要补充。不同的墨水有不同的颜色和质量（不同模型有不同能力和成本）。
笔不制造墨水，笔使用墨水。用户可以自带墨水（BYOK），也可以从 AGE OS 的墨水池里取用（资源池）。

**用户 = 写字的人**

用户是写字的人。他们决定写什么、怎么写、写给谁。笔听从写字的人的意志，但笔有自己的智慧——它知道怎样的笔画最流畅，怎样的结构最优雅。

### AGE OS 承担与不承担

| AGE OS 承担 | AGE OS 不承担 |
|---|---|
| ✅ 智能路由（选墨水） | ❌ 算力供给（造墨水） |
| ✅ 执行编排（控笔画） | ❌ 数据存储所有权 |
| ✅ 质量保障（保清晰） | ❌ 用户意志替代 |
| ✅ 工具演进（自进化） | |

### 对系统各层的影响

- **Agent 层**：Agent = 笔的不同笔尖。使用墨水但不拥有墨水。
- **执行引擎层**：路由 = 选墨水，计量 = 量墨水，降级 = 墨水不够换写法。
- **用户层**：用户在用一支很聪明的笔，墨水（算力）是需要关心的资源。

---

## 2. 设计原则

1. **去中心化依赖**：不依赖任何单一商业 AI 服务的会员配额
2. **开源优先**：对接开源大模型 API（DeepSeek、Qwen 等），保持供应商多元化
3. **按量弹性**：算力消耗与实际使用量挂钩，非固定配额
4. **渐进替代**：与现有 Copilot 能力并行，逐步迁移
5. **本体论一致**：架构设计符合光湖语言膜本体论框架

---

## 3. 核心组件

### 3.1 AGE-Router（路由网关）

文件：`src/router/age-router.js`

职责：接收所有 AI 执行请求，进行鉴权、分类、路由。

| 功能 | 说明 |
|------|------|
| 请求鉴权 | 验证 Agent 身份 + 资源池额度 |
| 任务分类 | code_generation / text_processing / reasoning / agent_instruction |
| 模型选择 | 通过 LoadBalancer 根据任务类型 + 成本策略选择最优模型 |
| 限流降级 | 基于每分钟请求数的滑动窗口限流 |
| 故障转移 | 主模型失败时自动切换至备选模型 |

路由策略：
- `code_generation` + `HIGH complexity` → DeepSeek-V3
- `text_processing` → Qwen-Max
- `agent_instruction` → best_available(cost=0.6, quality=0.4)
- `reasoning` → DeepSeek-R1

### 3.2 模型适配器（Adapter）

文件：`src/adapters/`

所有模型适配器继承 `BaseAdapter`，统一暴露：
- `execute(request)` → 执行推理
- `healthCheck()` → 健康检查
- `supports(capability)` → 能力检测

已实现适配器：

| 适配器 | 文件 | 支持模型 |
|--------|------|----------|
| DeepSeekAdapter | `deepseek-adapter.js` | deepseek-chat, deepseek-reasoner |
| QwenAdapter | `qwen-adapter.js` | qwen-max, qwen-coder-plus-latest |

适配器特性：
- OpenAI 兼容 API 格式
- 失败计数 + 冷却期机制（3 次失败 → 5 分钟冷却）
- 成本计算（按百万 token 计价）
- HTTP/HTTPS 自适应

### 3.3 负载均衡器（Load Balancer）

文件：`src/balancer/load-balancer.js`

三种策略：
- **cost**：成本优先，选最便宜的
- **quality**：质量优先，选配置排序第一的
- **balanced**：加权评分（成本 × 0.6 + 质量位置 × 0.4）

支持故障转移：`failover(failedModel, taskType)`

### 3.4 资源计量器（Resource Meter）

文件：`src/meter/resource-meter.js`

实时记录：
- 每次调用的 token 消耗、模型选择、响应时间
- 按模型 / Agent / 资源池维度聚合统计
- 持久化至 `logs/meter.json`（保留最近 500 条）

### 3.5 上下文缓存（Context Cache）

文件：`src/cache/context-cache.js`

Phase 0：内存 LRU 缓存（100 条，30 分钟 TTL）
Phase 2：对接 Grid-DB 格点库

### 3.6 Agent 调度器（Agent Controller）

文件：`src/controller/agent-controller.js`

- 维护 Agent → 模型偏好映射
- 将 Agent 请求转换为 EXE 标准请求
- Phase 2 实现双轨切换（Copilot ↔ EXE-Engine）

已注册 Agent：
- AG-ZY-01 铸渊（balanced, 4096 tokens）
- AG-SY-01 霜砚（quality, 4096 tokens）
- AG-QQ-01 秋秋（cost, 2048 tokens）

---

## 4. 算力资源模型

### 三种接入模式

| 模式 | 说明 | AGE OS 角色 |
|------|------|-------------|
| BYOK | 用户自带 API Key | 纯路由 + 编排 |
| 资源池 | AGE OS 统一采购 | 路由 + 编排 + 计费 |
| 混合 | BYOK + 资源池 fallback | 自适应 |

### 计费模型

| 模型 | 输入 (¥/M tokens) | 输出 (¥/M tokens) | 平台费率 |
|------|-------------------|-------------------|----------|
| DeepSeek-V3 | 1.0 | 2.0 | +20% |
| DeepSeek-R1 | 4.0 | 16.0 | +20% |
| Qwen-Max | 2.0 | 6.0 | +20% |
| Qwen-Coder | 1.0 | 2.0 | +20% |

### 限流与降级

| 阶段 | 条件 | 措施 |
|------|------|------|
| 正常 | 余额充足 | 全功能可用 |
| 预警 | 余额 < 20% | 通知用户 |
| 降级 | 余额 < 5% | 自动切换最低成本模型 |
| 熔断 | 余额 = 0 | 仅保留系统维护级调用 |

---

## 5. 技术栈

| 层级 | 技术 | 理由 |
|------|------|------|
| 语言 | Node.js 20 | 与 AGE OS 技术栈一致 |
| HTTP | 原生 http/https | 零依赖，轻量 |
| 状态存储 | 文件系统 (JSON) | 与 task-queue 模式一致 |
| 模型调用 | OpenAI-compatible | DeepSeek/Qwen 均兼容 |
| 监控 | ResourceMeter → DC v1.0 | 复用现有采集基础设施 |

---

## 6. 过渡路线

### Phase 0（当前）：基础建设
- [x] AGE-Router 路由网关
- [x] DeepSeek-V3 Adapter
- [x] Qwen Adapter（接口就绪）
- [x] Resource Meter 基础版
- [x] Load Balancer
- [x] 冒烟测试

### Phase 1：影子模式
- [ ] Load Balancer 生产部署
- [ ] 影子模式：Copilot 请求同步发送到 EXE-Engine
- [ ] 输出质量对比分析

### Phase 2：灰度切换
- [ ] Agent Controller 双轨切换
- [ ] BYOK 模式上线
- [ ] 资源池计费基础版
- [ ] Context Cache 对接 Grid-DB

### Phase 3：全面切换
- [ ] 核心 Agent 全面迁移
- [ ] Copilot 依赖代码清理
- [ ] 资源池正式上线
- [ ] 关闭 Copilot 企业会员
