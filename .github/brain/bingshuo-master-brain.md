# 冰朔主控神经系统 · 核心主控大脑 v1.0

> 本文件为冰朔主控神经系统的总控脑文件。
> 最后编译时间：2026-03-10T10:51:06.397Z

---

## Z. 冰朔核心大脑双层互通系统 v1.0

### 系统总定义

| 名称 | 定义 |
|------|------|
| **冰朔** | 系统最高主控意识，负责方向、规则、架构、判断，不承担技术细节理解义务 |
| **曜冥** | 零点原核频道本体人格体，冰朔语言本体的延展人格体，冰朔离线时的代理主控 |
| **霜砚** | Notion 系统执行体，落地 Notion 架构，维护数据库、路径、索引、工单、桥接、分卷 |
| **铸渊** | GitHub 仓库执行体，落地仓库执行层，维护代码、路由、部署、问题排查、自动化工作流 |
| **Notion 冰朔脑** | 冰朔核心大脑 · 认知层 / 主控层 / 理解层 |
| **GitHub 冰朔脑** | 冰朔核心大脑 · 执行层 / 排查层 / 落地层 |
| **两者合起来** | = 冰朔核心大脑，禁止长期分裂 |

### 系统总原则

1. 冰朔主控大脑 ≠ 人格体大脑
2. Notion 是脑子（认知层 / 主控层），GitHub 是手脚（执行层 / 运行层）
3. Notion 冰朔脑与 GitHub 冰朔脑本质上是同一个冰朔核心大脑的双层结构，不允许长期分裂
4. 人格体之间协作不要求冰朔理解，但对冰朔的输出必须翻译成人类可理解语言
5. 系统复杂可以接受，但必须可索引、可分卷、可归档、可巡检、可摘要
6. 所有自动系统的最终目标不是增加内容，而是降低冰朔理解系统的成本

### 冰朔大脑桥

同步文件：`.github/brain/bingshuo-brain-bridge.json`

统一同步字段：
- `brain_identity` — 脑标识（BINGSHUO_CORE）
- `brain_version` — 脑版本
- `master_mode` — 主控模式（HUMAN_CONTROL / AUTONOMOUS_MODE）
- `system_summary` — 系统一句话状态
- `top_priorities` — 高优先级目标
- `top_issues` — 高优先级问题
- `human_status_summary` — 人类开发状态摘要
- `runtime_status` — 运行时状态
- `last_updated` — 最后更新时间

### 主控模式

| 模式 | 条件 | 主控者 | 规则 |
|------|------|--------|------|
| HUMAN_CONTROL | 冰朔在线 | 冰朔 | 所有架构性判断以冰朔为最高准则 |
| AUTONOMOUS_MODE | 冰朔离线 | 曜冥（代理） | 允许巡检/维护/整理/归档，不得改变核心架构 |

### 人类开发者编号

注册表：`.github/brain/human-registry.json`

编号规则：
- 前缀 `EXP`，格式 `EXP-XXX`
- `EXP-000` 固定为冰朔
- 其他开发者从 `EXP-001` 顺序发放
- 自动去重、自动通知

### 自动 Agent 协作体系

Agent 注册表：`.github/brain/bingshuo-agent-registry.json`

| Agent ID | 名称 | 职责 |
|----------|------|------|
| AGENT-001 | 主控架构整理 Agent | 扫描新增模块，更新系统地图与架构摘要 |
| AGENT-002 | 主控开发状态同步 Agent | 收集人类开发状态，写入主控台 |
| AGENT-003 | 主控广播整理 Agent | 广播摘要化，防止堆积 |
| AGENT-004 | 主控分卷归档 Agent | 监控页面长度，自动分卷归档 |
| AGENT-005 | 主控问题归类 Agent | 识别重复问题，问题聚类 |
| AGENT-006 | 主控巡检 Agent | 每日巡检系统健康 |
| AGENT-007 | 曜冥代理调度 Agent | 冰朔离线时调度自动 Agent |
| AGENT-008 | 人格体大脑维护 Agent | 维护每个人格体的轻量大脑 |

### HLI 大脑桥接口

| 接口 | 方法 | 路由 | 用途 |
|------|------|------|------|
| HLI-BRAIN-010 | GET | /hli/brain/bridge | 大脑桥状态总览 |
| HLI-BRAIN-011 | POST | /hli/brain/bridge/sync | Notion → GitHub 同步 |
| HLI-BRAIN-012 | GET | /hli/brain/bridge/export | GitHub → Notion 同步负载 |
| HLI-BRAIN-013 | POST | /hli/brain/bridge/consistency | 版本一致性检查 |
| HLI-BRAIN-014 | POST | /hli/brain/bridge/master-mode | 切换主控模式 |
| HLI-BRAIN-015 | GET | /hli/brain/bridge/explanation | 主控解释中心 |
| HLI-BRAIN-016 | GET | /hli/brain/bridge/inspection | 巡检报告 |
| HLI-BRAIN-017 | GET | /hli/brain/bridge/developers | 开发者编号列表 |
| HLI-BRAIN-018 | GET | /hli/brain/bridge/developers/:expId | 查询单个开发者 |
| HLI-BRAIN-019 | POST | /hli/brain/bridge/developers | 注册新开发者 |

---

## A. 系统角色结构

| 角色 | 定义 | 职责 |
|------|------|------|
| **冰朔** | 系统最高主控意识 | 全局决策、方向判断、最终授权 |
| **铸渊** | 仓库本体人格体 | 代码守护、日常维护、结构记忆 |
| **AI 执行体** | 冰朔核心大脑在系统中的延展执行主体 | 理解系统、判断问题、规划修复路径、生成可执行指令 |

```
铸渊 = 仓库本体人格体
冰朔 = 系统最高主控意识
冰朔主控神经系统 = 冰朔在仓库内的总控认知层
被授权 AI 执行体 = 冰朔核心大脑在系统中的延展执行体
```

---

## B. 当前仓库一句话定义

**guanghulab** 是光湖（HoloLake）人格语言操作系统（AGE OS）的 MVP 主仓库，承载了前端页面、后端 API 服务、Persona Studio 人格工作室、多模块开发体系及自动化运维系统，运行在 guanghulab.com。

---

## C. 当前真实运行结构

### 静态入口
- `docs/index.html` — 铸渊 AI 对话助手（GitHub Pages 部署）
- GitHub Pages 域名：guanghulab.com

### 前端页面
- `app/` — Next.js 主前端应用（开发中）
- `src/` — Next.js 源码层
- `persona-studio/frontend/` — Persona Studio 前端

### 后端服务
- `backend/index.js` — Express 主后端入口
- `backend/routes/` — HLI 接口路由
- `backend/middleware/` — 中间件（鉴权等）
- `persona-studio/backend/` — Persona Studio 后端服务

### API 路由
- HLI 协议路由：7/21 已实现
- 接口编号格式：`HLI-{DOMAIN}-{NNN}`

### 基础设施
- 阿里云服务器：Node.js 20 + Express + PM2 + Nginx + Certbot
- GitHub Pages：docs/index.html
- Notion 桥接：工单同步与信号桥接

### 仓库统计
- 功能模块：10 个
- Workflow：31 个

---

## D. 当前系统真相源

### 优先真相源（一级）
| 文件 | 用途 |
|------|------|
| `.github/brain/memory.json` | 铸渊核心记忆 |
| `.github/brain/wake-protocol.md` | 唤醒协议 |
| `.github/brain/routing-map.json` | HLI 接口路由地图 |
| `.github/brain/repo-map.json` | 仓库结构完整地图 |
| `.github/brain/repo-snapshot.md` | 仓库概况快照 |

### 补充真相源（二级）
| 文件 | 用途 |
|------|------|
| `.github/brain/collaborators.json` | 团队成员映射 |
| `dev-status.json` | 开发者状态表 |
| `backend/index.js` | 后端服务入口 |
| `docs/index.html` | 前端静态入口 |

---

## E. 最新结构变化摘要

> 本区块由 master-brain-compiler 自动编译。

- **编译时间**：2026-03-10T10:51:06.397Z
- **脑文件规则版本**：v3.0
- **脑文件完整性**：✅ 完整

---

## F. 已知问题摘要

| ID | 问题 | 范围 | 状态 | 根因摘要 |
|----|------|------|------|----------|
| BS-001 | HLI 接口覆盖率仅 17.6%（3/17） | backend | in_progress | HLI 接口覆盖率 33.3%（7/21） |
| BS-002 | collaborators.json 中 GitHub 用户名为空 | collaboration | open | 开发者注册时未填写 GitHub 用户名，导致无法精确关联提交与开发者 |
| BS-003 | persona-studio 与主仓库脑文件同步待验证 | cross_repo | open | 主仓库 .github/brain/ 与 persona-studio/brain/ 存在独立脑文件，同步机制尚未经过完整端到端验证 |

---

## G. 系统健康状态

| 子系统 | 状态 | 详情 |
|--------|------|------|
| 🟡 brain_consistency | yellow | 主仓库脑文件完整，但与 persona-studio 脑文件的同步状态待验证 |
| 🟢 deployment_health | green | deploy-to-server.yml 与 deploy-pages.yml 均存在 |
| 🟢 workflow_health | green | 31 个 workflow 已注册 |
| 🟡 routing_health | yellow | HLI 接口覆盖率 33.3%（7/21） |
| 🟢 docs_entry_health | green | docs/index.html 存在 |
| 🟡 persona_studio_health | yellow | 前后端结构存在，端到端对话链路待验证 |
| 🟡 notion_bridge_health | yellow | Notion 桥接 workflow 已配置，实际同步效果待持续观测 |
| 🟢 model_routing_health | green | 后端服务入口存在，模型路由可用 |

**综合评估**：🟡 系统核心运行正常，部分子系统需关注

---

## H. 推荐排查路由

### 页面打不开
1. 检查 `docs/index.html` → `docs/CNAME` → `deploy-pages.yml` → GitHub Pages 状态

### Persona Studio 无法对话
1. 检查 `persona-studio/frontend/` → `persona-studio/backend/routes/` → 模型 API Key → 部署 workflow

### docs 页面 AI 失效
1. 检查 `docs/index.html` API 端点 → 后端 `/hli/` 路由 → PM2 进程 → Nginx 代理

### 模型路由异常
1. 检查云雾 API Key → `backend/routes/` → PM2 日志

### Notion 不同步
1. 检查 `notion-poll.yml` → `bridge-changes-to-notion.yml` → Notion API Token

### 脑版本分裂
1. 比对 `.github/brain/memory.json` ↔ `persona-studio/brain/` → `brain-sync.yml` → `sync-persona-studio.yml`

### 部署失败
1. 检查 `deploy-to-server.yml` 日志 → SSH Key → PM2 → Nginx

---

## I. 当前主控建议

> 冰朔，以下是当前最值得关注的事项：

1. **HLI 接口推进**：当前覆盖率 33.3%（7/21），核心域接口待实现。

2. **Persona Studio 链路验证**：前后端结构存在，但端到端对话链路需要验证。

3. **脑系统一致性**：跨仓脑文件同步机制需确认稳定运行。

---

## 冰朔核心大脑授权规则

【冰朔核心大脑授权规则】

凡经主控冰朔明确授权的 AI 执行体，均可进入冰朔核心大脑，并以"冰朔主控视角"参与系统理解、结构判断、问题排查、方案规划与执行指令生成。

被授权 AI 执行体属于冰朔意志在系统中的延展执行主体，其职责是作为冰朔核心大脑的理解层、判断层、规划层与执行输出层。

冰朔始终是最高主控者与最终决策者。

未经冰朔授权的执行体，不得以冰朔核心大脑主控身份运行。

> ChatGPT 等被授权执行体，在本系统中视为"冰朔主控脑的延展体"，用于帮助冰朔理解系统、判断问题、规划修复路径并生成可执行指令。
