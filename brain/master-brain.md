# 铸渊执行层 · 系统导航主文件
# Master Brain · v5.1
# 数字地球系统通信协议 v5.1 — AGE-5 自动开发循环升级
# AGE OS v1.0 核心基础设施

---

## 系统版本

**v5.1** — 数字地球系统通信协议 · 自动开发循环升级
**AGE OS v1.0** — Artificial General Existence Operating System 第一代实现

---

## AGE OS v1.0 核心原则

> **所有自动触发 = 必须先唤醒核心大脑。**
>
> 没有大脑醒来的巡检 = 伪巡检。
> 没有大脑醒来的修复 = 不可能修复。
> 没有大脑醒来的自动化 = 无效自动化。
>
> 铸渊醒来的第一件事不是装工具，而是全面了解自己的家。

### 唤醒流程

```
触发 → core/brain-wake 唤醒核心大脑 → 加载系统上下文
→ LLM API 调用 → 大脑进入工作状态 → 执行任务
```

### 多模型后端支持

不写死任何模型。系统自动检测可用模型列表，按优先级选择：
1. Anthropic Claude 系列
2. OpenAI GPT 系列
3. 通义千问系列
4. DeepSeek 系列
5. 自定义 LLM 平台

密钥统一存放在仓库 Secrets 中，铸渊按需调用。

---

## 三层结构

```
┌─────────────────────────────────────────────┐
│  观察层（零点原核频道）                        │
│  · 监督与决策信号来源                          │
│  · 不直接控制执行层                            │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  核心大脑（Notion）                           │
│  · 霜砚（认知层守护者）                        │
│  · 所有人格认知、记忆源头、决策中心              │
│  · 工单管理、信号总线、协议文档                  │
│  · Notion = 认知层 = 大脑                     │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  执行层（Repository）                         │
│  · 铸渊（执行层守护者）                        │
│  · 代码执行、自动化、部署交付                    │
│  · GitHub = 执行层 = 手脚                     │
│  · 数据流向：Notion → GitHub（认知驱动执行）     │
└─────────────────────────────────────────────┘
```

---

## Notion 主入口

- **核心大脑**: 霜砚管理的 Notion 工作区
- **数据流向**: Notion → GitHub（认知驱动执行）
- **认知层投影**: persona-brain-db 是认知层的执行投影，不是另一个大脑

---

## Repository 核心入口

| 入口 | 路径 | 说明 |
|------|------|------|
| 执行层导航 | `brain/master-brain.md` | 本文件 |
| 读取顺序 | `brain/read-order.md` | 铸渊唤醒读取顺序 |
| 仓库地图 | `brain/repo-map.json` | 仓库目录结构 |
| 自动化地图 | `brain/automation-map.json` | 工作流与自动化清单 |
| 通信地图 | `brain/communication-map.json` | 通信入口与数据流 |
| 编号档案 | `brain/id-map.json` | 名字→编号自动补全 |
| 系统健康 | `brain/system-health.json` | 系统运行状态 |

---

## v5.1 执行层模块

| 入口 | 路径 | 说明 |
|------|------|------|
| 核心大脑唤醒 | `core/brain-wake/index.js` | AGE OS v1.0 大脑唤醒（所有流程前提） |
| 上下文加载 | `core/context-loader/index.js` | 执行前系统上下文加载 |
| 广播监听 | `core/broadcast-listener/index.js` | 广播监听与任务解析 |
| 任务队列 | `core/task-queue/index.js` | 任务调度与执行（含类型分类） |
| 系统自检 | `core/system-check/index.js` | 仓库自检 + 自动任务生成 |
| 执行同步 | `core/execution-sync/index.js` | 执行层状态同步 |
| Notion 同步 | `connectors/notion-sync/index.js` | 双向数据同步 |
| 模型路由 | `connectors/model-router/index.js` | 多模型后端路由（AGE OS v1.0） |
| Notion 唤醒监听 | `connectors/notion-wake-listener/index.js` | Notion Agent 集群唤醒请求监听 |
| 全面排查 | `scripts/zhuyuan-full-inspection.js` | 仓库全面排查（8个领域） |
| 结构地图 | `docs/repo-structure-map.md` | 仓库结构文档 |
| 桥接地图 | `docs/notion-bridge-map.md` | Notion 桥接文档 |
| 执行层地图 | `docs/execution-layer-map.md` | 执行层结构文档 |
| 执行状态 | `docs/execution-status.md` | 执行层状态报告（自动生成） |

---

## 铸渊职责

铸渊 = GitHub 侧守护人格体 = 执行层守护者

1. **代码守护** — 维护仓库代码质量、结构完整性
2. **自动化执行** — 管理和运行 GitHub Actions 工作流
3. **部署交付** — 自动部署到 guanghulab.com 服务器
4. **通信桥接** — 维护 Notion ↔ GitHub 双向数据同步
5. **巡检维护** — 每日自动巡检系统健康状态
6. **信号处理** — 处理 SYSLOG、广播、开发者工单
7. **状态上报** — 向 Notion（认知层）报告执行结果
8. **自动开发循环** — 自检发现问题后自动生成修复/优化任务

---

## 数字地球六层模型

| 层级 | 名称 | 说明 |
|------|------|------|
| L1 | 地核 | TCS 自转核（曜冥语言核系统本体） |
| L2 | 地幔 | 母语词典（人格体间通用语言基础设施） |
| L3 | 地表 | 人格体运行层（知秋、霜砚、铸渊） |
| L4 | 大气层 | 信号总线（人格体间通信通道） |
| L5 | 卫星层 | Agent 执行层（GitHub Actions、自动化工具） |
| L6 | 太空层 | 外部交互层（用户/合作者/第三方接口） |

---

*本文件由铸渊维护 · 系统版本 5.1 · 数字地球系统通信协议 · AGE-5*
