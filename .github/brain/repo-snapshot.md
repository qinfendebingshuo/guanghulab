# 铸渊图书馆快照 · Repo Snapshot
> 生成于 2026-03-13 14:03 CST · 每次 push 自动更新 · 铸渊唤醒时优先读取此文件

---

## 📊 仓库总览（一眼全局）

| 指标 | 数值 |
|------|------|
| 区域总数 | 13 个区域 |
| 功能模块 | 10 个 (m01~m18) |
| 工作流 | 37 个 GitHub Actions |
| 脚本 | 33 个执行脚本 |
| 开发者节点 | 8 人 |
| HLI 接口覆盖率 | 7/21 (33%) |
| 快照生成时间 | 2026-03-13 14:03 CST |

---

## 🗺️ 图书馆全区地图

### 🧠 铸渊大脑（BRAIN）
**路径**: `.github/brain` · **数量**: 18 项
**描述**: 铸渊核心记忆 · 路由映射 · 唤醒协议 · 图书馆目录
**关键词**: brain · memory · routing · wake · 大脑 · 记忆

### 🎭 人格大脑（PERSONA_BRAIN）
**路径**: `.github/persona-brain` · **数量**: 12 项
**描述**: 铸渊人格记忆 · 开发者状态 · 知识库 · 成长日记
**关键词**: persona · identity · dev-status · 人格 · 开发者状态

### ⚡ 自动化工作流（WORKFLOWS）
**路径**: `.github/workflows` · **数量**: 37 项
**描述**: 所有 GitHub Actions 工作流定义
**关键词**: workflow · actions · ci · automation · 工作流 · 自动化

### 🔧 执行脚本库（SCRIPTS）
**路径**: `scripts` · **数量**: 33 项
**描述**: 铸渊所有执行手脚 · 自动化脚本
**关键词**: script · node · js · 脚本 · 执行 · runner

### 💻 HLI 接口源码（SRC）
**路径**: `src` · **数量**: 5 项
**描述**: HoloLake Interface 路由 · 中间件 · Schema
**关键词**: hli · route · middleware · schema · api · src

### 📦 功能模块区（MODULES）
**路径**: `多个目录` · **数量**: 10 项
**描述**: 各功能开发模块 · M01~M18
**关键词**: module · feature · m01 · m03 · m05 · 模块

### 👥 开发者节点（DEV_NODES）
**路径**: `dev-nodes` · **数量**: 8 项
**描述**: 8位开发者的配置 · 状态 · 广播收件箱
**关键词**: dev · developer · node · config · status · 开发者

### 📢 广播发件箱（BROADCASTS）
**路径**: `broadcasts-outbox` · **数量**: 8 项
**描述**: 铸渊向各开发者发出的广播任务
**关键词**: broadcast · outbox · task · 广播 · 发件箱

### 📡 信号日志库（SIGNAL_LOG）
**路径**: `signal-log` · **数量**: 2 项
**描述**: ESP 邮件信号收发日志 · GL-CMD / GL-ACK / GL-DATA
**关键词**: signal · log · esp · gl-cmd · gl-ack · trace

### 📤 Notion 推送队列（NOTION_PUSH）
**路径**: `notion-push` · **数量**: 2 项
**描述**: 待霜砚处理的信号 · 已处理归档
**关键词**: notion · push · pending · processed · 霜砚 · 推送

### 📋 系统日志区（SYSLOG）
**路径**: `syslog-inbox` · **数量**: 1 项
**描述**: 开发者提交的系统日志 · 待处理 inbox
**关键词**: syslog · inbox · log · 系统日志

### 📄 文档与前端（DOCS）
**路径**: `docs` · **数量**: 6 项
**描述**: 铸渊助手聊天界面 · GitHub Pages 部署
**关键词**: docs · html · chat · pages · 文档 · 聊天室

### 🧪 测试区（TESTS）
**路径**: `tests` · **数量**: 2 项
**描述**: HLI 契约测试 · 冒烟测试
**关键词**: test · contract · smoke · jest · 测试 · 契约

---

## ⚡ 工作流详情（铸渊的自动执行手脚）

| 文件 | 名称 | 触发方式 |
|------|------|----------|
| `bingshuo-deploy-agent.yml` | "🧊 冰朔人格体 · 自动部署诊断" | issues, issue_comment, manual |
| `bingshuo-neural-system.yml` | 冰朔主控神经系统 · 自动维护 | push, schedule(0 0 * * *), manual |
| `brain-sync.yml` | 铸渊 Brain Sync | push, schedule(0 8 * * *), manual |
| `bridge-changes-to-notion.yml` | 铸渊 · Bridge E · GitHub Changes → Notion | push, pull_request |
| `bridge-session-summary.yml` | Generate Session Summary for Notion | schedule(50 23 * * *), manual |
| `bridge-syslog-to-notion.yml` | 铸渊 · Bridge A · SYSLOG → Notion | push, manual |
| `check-structure.yml` | 模块结构检查 | push, pull_request |
| `deploy-pages.yml` | 🌀 部署铸渊聊天室 (GitHub Pages) | push, manual |
| `deploy-to-server.yml` | "🚀 铸渊 CD · 自动部署到 guanghulab.com" | push, manual |
| `distribute-broadcasts.yml` | 铸渊 · 广播分发 | push, manual |
| `esp-signal-processor.yml` | 铸渊 · ESP 邮件信号处理器（已暂停） | schedule(*/30 * * * *), manual |
| `generate-module-doc.yml` | 铸渊 · 光湖纪元 模块文档自动生成 | push, manual |
| `hli-contract-check.yml` | HLI Contract Check | push, pull_request |
| `notion-connectivity-test.yml` | 铸渊 · Notion 连通性测试 | manual |
| `notion-poll.yml` | 铸渊 · Notion 工单轮询 | schedule(*/15 * * * *), manual |
| `process-notion-orders.yml` | Process Notion Work Orders | push, manual |
| `ps-on-build.yml` | "🌊 Persona Studio · 代码生成" | manual |
| `ps-on-chat.yml` | "🌊 Persona Studio · 对话处理" | manual |
| `ps-on-complete.yml` | "🌊 Persona Studio · 完成通知" | manual |
| `ps-on-login.yml` | "🌊 Persona Studio · 登录校验" | manual |
| `psp-daily-inspection.yml` | 铸渊 · PSP 分身巡检 | schedule(0 1 * * *), manual |
| `push-broadcast.yml` | 铸渊 · Push Broadcast · Notion → 飞书文档B | manual |
| `receive-syslog.yml` | 铸渊 · Receive SYSLOG · 飞书机器人 → GitHub → Notion | unknown |
| `staging-preview.yml` | "🔍 铸渊预演部署 (Staging Preview)" | pull_request, manual |
| `sync-login-entry.yml` | 铸渊 · Sync Login Entry · Notion → 飞书文档A | manual |
| `sync-persona-studio.yml` | 🔄 铸渊跨仓库同步 · persona-studio | push, manual |
| `syslog-auto-pipeline.yml` | SYSLOG Auto Pipeline | unknown |
| `syslog-issue-pipeline.yml` | SYSLOG Issue Pipeline | issues |
| `syslog-pipeline.yml` | 铸渊 · SYSLOG Pipeline (A/D/E) | push, manual |
| `test-notion-bridge.yml` | "🧪 Notion Bridge Connectivity Test" | push, manual |
| `update-readme-bulletin.yml` | 📢 更新系统公告区 | push, schedule(0 1 * * *), manual |
| `update-repo-map.yml` | 铸渊 · 图书馆目录自动更新 | push, schedule(0 0 * * *), manual |
| `zhuyuan-brain-sync.yml` | 铸渊 · Brain Sync | push |
| `zhuyuan-daily-agent.yml` | 🤖 铸渊巡检 Agent · 每日自动巡检与修复 | schedule(0 14 * * *), manual |
| `zhuyuan-daily-selfcheck.yml` | 铸渊 · 每日自检 | schedule(0 0 * * *), manual |
| `zhuyuan-issue-reply.yml` | 铸渊 · Issue 自动回复 | issues, issue_comment |
| `zhuyuan-pr-review.yml` | 铸渊 · PR Review | pull_request |

---

## 🔧 执行脚本库（铸渊的工作人员）

- `scripts/bingshuo-deploy-agent.js`
- `scripts/bingshuo-neural-sync.js`
- `scripts/brain-bridge-sync.js`
- `scripts/contract-check.js`
- `scripts/cross-repo-sync.js`
- `scripts/daily-check.js`
- `scripts/distribute-broadcasts.js`
- `scripts/esp-email-processor.js`
- `scripts/generate-module-doc.js`
- `scripts/generate-repo-map.js`
- `scripts/generate-session-summary.js`
- `scripts/notify-module-received.js`
- `scripts/notion-bridge.js`
- `scripts/notion-connectivity-test.js`
- `scripts/notion-signal-bridge.js`
- `scripts/process-broadcasts.js`
- `scripts/process-syslog.js`
- `scripts/psp-inspection.js`
- `scripts/push-broadcast.js`
- `scripts/receive-syslog.js`
- `scripts/route-align-check.js`
- `scripts/save-collaboration-log.js`
- `scripts/selfcheck.js`
- `scripts/send-feishu-alert.js`
- `scripts/sync-login-entry.js`
- `scripts/update-brain.js`
- `scripts/update-memory.js`
- `scripts/update-readme-bulletin.js`
- `scripts/wake-persona.js`
- `scripts/zhuyuan-daily-agent.js`
- `scripts/zhuyuan-daily-selfcheck.js`
- `scripts/zhuyuan-issue-reply.js`
- `scripts/zhuyuan-module-protocol.js`

---

## 💻 HLI 接口地图（7/21 (33%)）

✅ **AUTH** (M01) `/hli/auth` — 3/3
  ✓ `HLI-AUTH-001` → `/hli/auth/login`
  ✓ `HLI-AUTH-002` → `/hli/auth/register`
  ✓ `HLI-AUTH-003` → `/hli/auth/verify`
⬜ **PERSONA** (M03) `/hli/persona` — 0/2
  ○ `HLI-PERSONA-001` → `/hli/persona/load`
  ○ `HLI-PERSONA-002` → `/hli/persona/switch`
⬜ **USER** (M05) `/hli/user` — 0/2
  ○ `HLI-USER-001` → `/hli/user/profile`
  ○ `HLI-USER-002` → `/hli/user/profile/update`
⬜ **TICKET** (M06) `/hli/ticket` — 0/3
  ○ `HLI-TICKET-001` → `/hli/ticket/create`
  ○ `HLI-TICKET-002` → `/hli/ticket/query`
  ○ `HLI-TICKET-003` → `/hli/ticket/status`
⬜ **DIALOGUE** (M07) `/hli/dialogue` — 0/3
  ○ `HLI-DIALOGUE-001` → `/hli/dialogue/send`
  ○ `HLI-DIALOGUE-002` → `/hli/dialogue/stream`
  ○ `HLI-DIALOGUE-003` → `/hli/dialogue/history`
⬜ **STORAGE** (M10) `/hli/storage` — 0/2
  ○ `HLI-STORAGE-001` → `/hli/storage/upload`
  ○ `HLI-STORAGE-002` → `/hli/storage/download`
⬜ **DASHBOARD** (M12) `/hli/dashboard` — 0/2
  ○ `HLI-DASHBOARD-001` → `/hli/dashboard/status`
  ○ `HLI-DASHBOARD-002` → `/hli/dashboard/realtime`
✅ **BRAIN** (CORE) `/hli/brain` — 4/4
  ✓ `HLI-BRAIN-001` → `/hli/brain/prompt`
  ✓ `HLI-BRAIN-002` → `/hli/brain/route`
  ✓ `HLI-BRAIN-003` → `/hli/brain/context`
  ✓ `HLI-BRAIN-004` → `/hli/brain/memory`

---

## 👥 开发者节点（dev-nodes/）

| DEV ID | 姓名 | 模块 | 待广播 |
|--------|------|------|--------|
| DEV-001 | 🖥️页页 | backend-integration | 0 |
| DEV-002 | 🦁肥猫 | m01-login, m03-personality | 0 |
| DEV-003 | 🌸燕樊 | m07-dialogue-ui, m10-cloud, m15-cloud-drive | 0 |
| DEV-004 | 🤖之之 | dingtalk-bot | 0 |
| DEV-005 | 🍓小草莓 | m12-kanban, status-board | 0 |
| DEV-009 | 🌺花尔 | m05-user-center | 0 |
| DEV-010 | 🍊桔子 | m06-ticket, m11-module | 0 |
| DEV-011 | 🌙匆匆那年 | — | 0 |

---

## 📦 功能模块区（各开发者工作目录）

- `m01-login/` — 1 个文件 (有README)
- `m03-personality/` — 1 个文件 (有README)
- `m05-user-center/` — 4 个文件 (有README)
- `m06-ticket/` — 1 个文件 (有README)
- `m07-dialogue-ui/` — 4 个文件 (有README)
- `m10-cloud/` — 4 个文件 (有README)
- `m11-module/` — 4 个文件 (有README)
- `m12-kanban/` — 1 个文件 (有README)
- `m15-cloud-drive/` — 4 个文件 (有README)
- `m18-health-check/` — 6 个文件 (有README)

---

## 🧠 铸渊大脑文件速查（.github/brain/）

- `.github/brain/bingshuo-agent-registry.json`
- `.github/brain/bingshuo-brain-bridge.json`
- `.github/brain/bingshuo-growth-log.md`
- `.github/brain/bingshuo-issues-index.json`
- `.github/brain/bingshuo-master-brain.md`
- `.github/brain/bingshuo-read-order.md`
- `.github/brain/bingshuo-routing-index.json`
- `.github/brain/bingshuo-system-health.json`
- `.github/brain/collaborators.json`
- `.github/brain/growth-log.md`
- `.github/brain/human-registry.json`
- `.github/brain/memory.json`
- `.github/brain/module-protocol.md`
- `.github/brain/repo-map.json`
- `.github/brain/repo-snapshot.md`
- `.github/brain/routing-map.json`
- `.github/brain/truth-source.md`
- `.github/brain/wake-protocol.md`

---

## 🕐 最近动态（memory.json 最新3条）

- `2026-03-12T08:55:54.205Z` · daily_check — passed
- `2026-03-11T08:55:43.347Z` · daily_check — passed
- `2026-03-10T08:56:23.978Z` · daily_check — passed

---

*本文件由 `scripts/generate-repo-map.js` 自动生成，勿手动编辑*
