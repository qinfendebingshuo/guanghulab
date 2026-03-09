<div align="center">

# 🌊 HoloLake 光湖系统

**人格语言操作系统（AGE OS） · 壳-核分离架构**

[![Daily Check](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/zhuyuan-daily-selfcheck.yml/badge.svg)](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/zhuyuan-daily-selfcheck.yml)
[![Deploy](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/deploy-to-server.yml/badge.svg)](https://github.com/qinfendebingshuo/guanghulab/actions/workflows/deploy-to-server.yml)

`guanghulab.com` · Node.js 20 + Express + PM2 + Nginx

</div>

---

## 📖 系统简介

**光湖（HoloLake）** 是一个基于 **人格语言操作系统（AGE OS）** 的智能协作平台，采用 **壳-核分离** 设计理念：

- **壳（Shell）**：前端交互层，包括对话界面、用户中心、工单系统、云盘等模块
- **核（Core）**：后端智能层，包括人格引擎、广播分发、信号处理、Notion 桥接等

### 🏛️ 核心架构

```
┌─────────────────────────────────────────────────┐
│                  光湖 HoloLake                    │
├──────────────┬──────────────────────────────────┤
│   壳 Shell   │           核 Core                 │
│              │                                   │
│  🖥️ 对话 UI  │  🧠 铸渊 (Zhùyuān) 代码守护人格    │
│  👤 用户中心  │  📡 广播分发系统                    │
│  🎫 工单系统  │  🔔 信号处理 + Notion 桥接          │
│  ☁️ 云盘     │  🔄 CI/CD 自动化流水线              │
│  📊 状态看板  │  📋 模块自检 + 文档生成             │
└──────────────┴──────────────────────────────────┘
```

### 🤖 智能人格体

| 人格体 | 角色 | 职责 |
|--------|------|------|
| **铸渊 Zhùyuān** | 代码守护者 | 代码审查、CI 巡检、模块协议执行、Issue 回复 |
| **冰朔 Bīng Shuò** | 系统创建者 | 系统架构设计、核心决策、广播发布 |
| **霜砚 Shuāng Yàn** | 人格导师 | 人格调校、风格管理、联觉语言系统 |

### 🔧 技术栈

- **运行时**：Node.js 20 + Next.js 15 + React 19
- **后端**：Express + PM2 进程管理
- **数据库**：SQLite (better-sqlite3) + Notion 数据桥接
- **部署**：Nginx 反向代理 + GitHub Actions CI/CD
- **自动化**：23+ GitHub Actions 工作流

---

## 📢 系统公告区

> 🔄 此区域由 GitHub Actions 自动更新，显示最近的模块上传、系统事件和版本变更。
>
> 合作者每次进入仓库首页即可查看最新动态。

<!-- BULLETIN_START -->
| 时间 | 事件 | 详情 |
|------|------|------|
| 03-09 17:15 | 📦 铸渊 (Copilot) | 模块更新: `scripts/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `backend-integration/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `backend/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `cloud-drive/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `dingtalk-bot/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `docs/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `frontend/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m01-login/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m03-personality/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m05-user-center/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m06-ticket/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m07-dialogue-ui/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m10-cloud/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m11-module/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m12-kanban/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m15-cloud-drive/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `m18-health-check/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `notification/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `status-board/` |
| 03-09 17:01 | 📦 铸渊 (ZhùYuān) | 模块更新: `ticket-system/` |
<!-- BULLETIN_END -->

---

## 👥 开发团队

| 编号 | 成员 | 角色 | 负责模块 |
|------|------|------|----------|
| DEV-001 | 🛠️ 页页 | 后端中间件 | backend-integration |
| DEV-002 | 🐱 肥猫 | 前端 + 副操 | m01-login, m03-personality |
| DEV-003 | 🎨 燕樊 | 对话 UI | m07-dialogue-ui, m15-cloud-drive |
| DEV-004 | 🤖 之之 | 钉钉机器人 | dingtalk-bot |
| DEV-005 | 🍓 小草莓 | 状态看板 | status-board, m12-kanban |
| DEV-009 | 🌸 花尔 | 用户中心 | m05-user-center |
| DEV-010 | 🍊 桔子 | 前端主力 | m06-ticket, ticket-system |
| DEV-011 | ✍️ 匆匆那年 | 写作工坊 | — |
| DEV-012 | 🌟 Awen | 通知中心 | notification |

---

## 📦 模块目录

<details>
<summary>点击展开完整模块列表（47+ 模块）</summary>

### 核心功能模块
| 模块 | 说明 |
|------|------|
| `m01-login/` | 登录系统 |
| `m03-personality/` | 人格系统 |
| `m05-user-center/` | 用户中心 |
| `m06-ticket/` | 工单系统 |
| `m07-dialogue-ui/` | 对话界面 |
| `m10-cloud/` | 云服务 |
| `m11-module/` | 模块管理 |
| `m12-kanban/` | 看板系统 |
| `m15-cloud-drive/` | 云盘 |
| `m18-health-check/` | 健康检查 |

### 基础设施
| 模块 | 说明 |
|------|------|
| `backend/` | 后端服务 |
| `backend-integration/` | 后端集成中间件 |
| `frontend/` | 前端主体 |
| `status-board/` | 状态看板 |
| `dingtalk-bot/` | 钉钉机器人 |
| `notification/` | 通知系统 |

### 系统支撑
| 模块 | 说明 |
|------|------|
| `scripts/` | 自动化脚本 |
| `tests/` | 契约测试 + 冒烟测试 |
| `docs/` | 文档中心 |
| `broadcasts-outbox/` | 广播发件箱 |
| `syslog-inbox/` | 系统日志收件箱 |
| `persona-selector/` | 人格选择器 |
| `signal-log/` | 信号日志 |

</details>

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 运行契约测试
npm run test:contract

# 运行冒烟测试
npm run test:smoke
```

---

## 📊 系统状态

- **每日巡检**：铸渊 PSP 自动巡检（每日 08:30 UTC）
- **模块自检**：推送时自动检测模块完整性（README.md + package.json + src/）
- **部署流水线**：推送到 main → 验证 → 同步 → 重启 → Notion 通知
- **广播系统**：冰朔广播 → 分发至各开发者 outbox → 邮件/钉钉通知

---

<div align="center">

**光湖 HoloLake** · 由冰朔创建 · 铸渊守护

*壳-核分离 · 人格共生 · 协作共建*

</div>
