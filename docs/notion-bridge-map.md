# Notion 桥接地图 — notion-bridge-map.md

> 铸渊执行层系统升级产物 · TCS-0002∞  
> 生成时间：2026-03-14

---

## 连接总览

```
Notion 主脑（数字地球主控台）
        ↕
connectors/notion-sync（双向同步模块）
        ↕
仓库执行层（铸渊）
```

---

## API 调用路径

| 脚本 | 方向 | Notion 数据库 | 环境变量 |
|------|------|---------------|----------|
| `scripts/notion-bridge.js` | 仓库 → Notion | SYSLOG Inbox / Changes Log | `NOTION_TOKEN`, `SYSLOG_DB_ID`, `CHANGES_DB_ID` |
| `scripts/notion-signal-bridge.js` | Notion → 仓库 | 工单数据库 / 信号日志 | `NOTION_API_TOKEN`, `WORKORDER_DB_ID`, `SIGNAL_LOG_DB_ID` |
| `scripts/notion-heartbeat.js` | Notion ↔ 仓库 | 工单数据库 | `NOTION_TOKEN`, `NOTION_TICKET_DB_ID` |
| `scripts/brain-bridge-sync.js` | Notion ↔ 仓库 | 大脑同步 | `NOTION_TOKEN` |
| `connectors/notion-sync/index.js` | 双向统一接口 | 广播 / 日志 | `NOTION_TOKEN`, `BROADCAST_DB_ID` |

---

## 数据同步逻辑

### 仓库 → Notion（上行）

1. **SYSLOG 上报**：`syslog-inbox/` → `notion-bridge.js` → Notion SYSLOG 数据库
2. **变更同步**：Git commits/PRs → `notion-bridge.js` → Notion Changes Log
3. **执行日志**：任务完成 → `connectors/notion-sync` → Notion 广播数据库
4. **心跳回写**：工单状态 → `notion-heartbeat.js` → Notion 工单数据库

### Notion → 仓库（下行）

1. **广播监听**：Notion 广播 → `connectors/notion-sync` → `core/broadcast-listener`
2. **工单派发**：Notion 工单 → `notion-signal-bridge.js` → 本地任务执行
3. **人格唤醒**：Notion 触发 → `persona-invoke.yml` → 人格体执行

---

## 连接方式

| 连接类型 | 实现 | 说明 |
|----------|------|------|
| Notion API | HTTPS REST | Notion API v2022-06-28 |
| 轮询机制 | Cron / workflow_dispatch | 定时拉取 + 手动触发 |
| 心跳监控 | 5 分钟间隔 Cron | 超时自动重试（最多 3 次） |
| 信号桥 | 工单状态驱动 | `已发送` → 执行 → `已完成` |

---

## 关联工作流

| 工作流 | 触发方式 | 功能 |
|--------|----------|------|
| `notion-heartbeat.yml` | cron `*/5 * * * *` | 工单心跳监控 |
| `bridge-syslog-to-notion.yml` | push (syslog-inbox) | SYSLOG 上报 |
| `bridge-changes-to-notion.yml` | push (main) | 变更同步 |
| `brain-sync.yml` | workflow_dispatch | 大脑数据同步 |
| `process-notion-orders.yml` | workflow_dispatch | 工单处理 |
| `persona-invoke.yml` | workflow_dispatch | 人格唤醒执行 |
