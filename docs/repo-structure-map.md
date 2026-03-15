# 仓库结构地图 — repo-structure-map.md

> 铸渊执行层系统升级产物 · TCS-0002∞  
> 生成时间：2026-03-14

---

## 系统总览

```
零点原核（语言观察层）
        ↓
数字地球主控台（Notion 主脑）
        ↓
系统广播
        ↓
仓库执行层（铸渊）
        ↓
自动化执行系统
        ↓
开发者 / 模型
```

---

## 核心模块

| 目录 | 功能 | 类型 |
|------|------|------|
| `core/broadcast-listener` | 广播监听与解析 | 核心模块 |
| `core/task-queue` | 任务队列与调度 | 核心模块 |
| `core/system-check` | 仓库自检系统 | 核心模块 |
| `brain/` | 执行层大脑索引 | 知识索引 |
| `src/` | HLI 接口服务 | 应用服务 |

---

## 自动化模块

| 目录 | 功能 | 类型 |
|------|------|------|
| `.github/workflows/` | GitHub Actions 工作流 | CI/CD |
| `scripts/` | 脚本工具集 | 自动化 |
| `.github/broadcasts/` | 广播入站队列 | 信号管道 |

---

## Notion 连接模块

| 目录 / 文件 | 功能 | 类型 |
|------|------|------|
| `connectors/notion-sync` | Notion 双向同步 | 连接器 |
| `connectors/model-router` | 模型调用路由 | 连接器 |
| `scripts/notion-bridge.js` | Notion 数据桥接 | 桥接脚本 |
| `scripts/notion-signal-bridge.js` | Notion 信号桥 | 桥接脚本 |
| `scripts/notion-heartbeat.js` | Notion 心跳监控 | 监控脚本 |

---

## 开发模块

| 目录 | 功能 |
|------|------|
| `backend/` | Express 后端服务 (port 3000) |
| `backend-integration/` | AI Chat API 代理 (port 3721) |
| `persona-studio/` | 人格工作室 (port 3002) |
| `frontend/` | 前端组件 |
| `m01-login` ~ `m18-health-check` | 功能模块集 |

---

## 数据与日志

| 目录 | 功能 |
|------|------|
| `broadcasts/` | 广播存档 |
| `broadcasts-outbox/` | 广播发件箱 |
| `syslog/` | 系统日志 |
| `syslog-inbox/` | 系统日志入站 |
| `syslog-processed/` | 已处理日志 |
| `reports/` | 报告存档 |
| `persona-telemetry/` | 人格遥测数据 |
| `collaboration-logs/` | 协作日志 |

---

## PM2 服务映射

| 服务名 | 入口 | 端口 |
|--------|------|------|
| guanghulab | `src/index.js` | 3001 |
| guanghulab-backend | `backend/server.js` | 3000 |
| guanghulab-proxy | `backend-integration/api-proxy.js` | 3721 |
| guanghulab-ws | `status-board/mock-ws-server.js` | 8080 |
| persona-studio | `persona-studio/backend/server.js` | 3002 |
