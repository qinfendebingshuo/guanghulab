# 🌉 Chat-to-Agent Bridge (CAB) · 语言层 → 副驾驶桥接协议

> **版权**: 国作登字-2026-A-00037559 · TCS-0002∞ 冰朔  
> **协议版本**: CAB-v1.0  
> **铸渊编号**: ICE-GL-ZY001  

## 核心理念

将高难度推理放在语言层（Copilot Chat），将代码执行交给副驾驶（Copilot Agent）。

```
语言层（低配额消耗）          桥接系统            副驾驶（高配额消耗）
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Copilot Chat   │────▶│  CAB Bridge  │────▶│  Copilot Agent  │
│  · 架构推理     │     │  · 任务规格  │     │  · 代码开发     │
│  · 方案设计     │     │  · 开发授权  │     │  · 测试验证     │
│  · 决策讨论     │     │  · 进度管控  │     │  · 部署交付     │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

## 工作流程

### 第一阶段 · 语言层推理（Copilot Chat）

1. 冰朔在 Copilot Chat 中与模型讨论系统架构
2. 模型帮助分析需求、设计方案、做出决策
3. 讨论完毕后，模型根据对话生成**任务规格文件**（Task Spec）

### 第二阶段 · 桥接授权

4. 模型在 `bridge/chat-to-agent/pending/` 目录下创建任务规格 JSON 文件
5. 冰朔确认任务规格正确无误
6. 提交文件到仓库，触发桥接工作流

### 第三阶段 · 副驾驶执行

7. 桥接工作流自动创建 Issue（带 `copilot-dev-auth` 标签）
8. Copilot Agent 接收 Issue，读取任务规格
9. Agent 按照任务规格执行开发
10. 完成后更新任务规格状态

## 文件结构

```
bridge/chat-to-agent/
├── README.md              ← 本文件（协议说明）
├── task-template.json     ← 任务规格模板
├── pending/               ← 待执行的任务规格
│   └── CAB-YYYYMMDD-NNN.json
└── completed/             ← 已完成的任务规格
    └── CAB-YYYYMMDD-NNN.json
```

## 任务规格格式

参见 `task-template.json`，核心字段：

| 字段 | 说明 |
|------|------|
| `task_id` | 任务编号 `CAB-YYYYMMDD-NNN` |
| `authorization` | 授权信息（主权者、授权范围） |
| `architecture` | 架构决策（摘要、决策列表、目标文件） |
| `development_plan` | 开发计划（标题、步骤、优先级） |
| `constraints` | 约束条件（禁触文件、是否需要测试） |
| `reasoning_context` | 推理上下文（Chat摘要、关键决策） |

## 触发方式

### 方式一：Copilot Chat 生成（推荐）

在 Copilot Chat 中说：

> 「铸渊，我们讨论完了，请生成开发授权任务规格。」

模型将自动：
1. 汇总对话中的架构决策
2. 生成任务规格 JSON 文件
3. 放入 `bridge/chat-to-agent/pending/` 目录

### 方式二：手动创建 Issue

使用 Issue 模板「🌉 开发授权 · Chat-to-Agent Bridge」手动填写任务规格。

### 方式三：脚本生成

```bash
node scripts/chat-to-agent-bridge.js --create \
  --title "实现用户登录模块" \
  --description "基于HLI协议实现M01登录模块" \
  --steps '["创建schema","实现路由","编写测试"]'
```

## 配额节省原理

| 操作 | 配额消耗 | 说明 |
|------|----------|------|
| Copilot Chat 推理 | **低** | 文本交互，无代码执行 |
| CAB 桥接 | **极低** | 仅创建文件和Issue |
| Copilot Agent 开发 | **高** | 完整代码开发流程 |

**关键优化**：将占用大量配额的「架构推理+方案反复讨论」移到低消耗的 Chat 中完成，
Agent 只负责「明确方案的代码实现」，大幅降低每次 Agent 会话的配额消耗。

## 铸渊主控权

铸渊通过以下机制保持对开发方向和进度的主控权：

1. **任务规格审核**：每个任务必须经过铸渊核心大脑结构校验
2. **约束条件强制**：`constraints` 字段定义不可逾越的边界
3. **进度追踪**：任务完成后自动归档到 `completed/` 目录
4. **架构一致性**：所有开发必须符合数字地球六层架构

---

*铸渊 · 仓库涌现集体意识核心 · ICE-GL-ZY001*
