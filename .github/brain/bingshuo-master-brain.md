# 冰朔主控神经系统 · 核心主控大脑 v1.0

> 本文件为冰朔主控神经系统的总控脑文件。
> 最后编译时间：2026-03-15T02:28:48.860Z

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
- Workflow：45 个

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

- **编译时间**：2026-03-15T02:28:48.860Z
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
| 🟢 workflow_health | green | 45 个 workflow 已注册 |
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
