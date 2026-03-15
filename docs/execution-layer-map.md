# 执行层结构地图 — execution-layer-map.md

> 铸渊执行层自动开发循环升级产物 · TCS-0002∞  
> 生成时间：2026-03-14 · v5.1

---

## 执行层系统结构

```
零点原核（语言观察层）
        ↓
数字地球主控台（Notion 主脑 / 曜冥）
        ↓
系统广播
        ↓
仓库执行层（铸渊）
        ↓
自动开发循环
        ↓
自动化执行系统
```

---

## 核心执行模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 上下文加载 | `core/context-loader/index.js` | 执行前加载系统上下文与身份认知 |
| 广播监听 | `core/broadcast-listener/index.js` | 监听并解析 Notion 广播为可执行任务 |
| 任务队列 | `core/task-queue/index.js` | 任务入队、调度、优先级管理、类型分类 |
| 系统自检 | `core/system-check/index.js` | 仓库结构完整性检查 + 自动任务生成 |
| 执行同步 | `core/execution-sync/index.js` | 生成执行状态报告并同步到 Notion |

---

## 自动化模块

| 工作流 | 触发方式 | 职责 |
|--------|----------|------|
| `daily-maintenance.yml` | cron `0 2 * * *` | 每日巡检与 system-health 更新 |
| `zhuyuan-daily-selfcheck.yml` | cron `0 0 * * *` | 铸渊每日自检 |
| `execution-sync.yml` | cron `0 3 * * *` | 执行层状态同步到 Notion |
| `notion-heartbeat.yml` | cron `*/5 * * * *` | 工单心跳监控 |
| `brain-sync.yml` | workflow_dispatch | 大脑数据同步 |

---

## Notion 连接模块

| 模块 | 路径 | 方向 | 职责 |
|------|------|------|------|
| Notion 同步 | `connectors/notion-sync/index.js` | 双向 | 广播拉取 / 日志写回 / 状态同步 |
| 模型路由 | `connectors/model-router/index.js` | 出站 | 统一模型调用入口 |
| Notion 桥接 | `scripts/notion-bridge.js` | 上行 | SYSLOG 上报 / 变更同步 |
| 信号桥 | `scripts/notion-signal-bridge.js` | 下行 | 工单轮询 / 信号执行 |
| 心跳监控 | `scripts/notion-heartbeat.js` | 双向 | 超时检测 / 自动重试 |

---

## 任务执行模块

| 脚本 | 职责 |
|------|------|
| `scripts/process-broadcasts.js` | 处理广播（JSON 规则 + MD 成长日志） |
| `scripts/daily-check.js` | 文件完整性 / HLI 覆盖率 / Schema 验证 |
| `scripts/zhuyuan-daily-selfcheck.js` | 大脑文件验证 / FAQ 去重 / 记忆修剪 |
| `scripts/distribute-broadcasts.js` | 广播分发 |
| `scripts/generate-repo-map.js` | 仓库结构索引生成 |
| `scripts/generate-system-health.js` | 系统健康报告生成 |

---

## 执行闭环（自动开发循环 v5.1）

```
context-loader（上下文加载）
        ↓
system-check（自检 + 自动任务生成）
        ↓
execution-sync（状态采集与报告）
        ↓
broadcast-listener（广播监听）
        ↓
task-queue（任务排队 · 类型: system/dev/maintenance/auto）
        ↓
执行器运行
        ↓
connectors/notion-sync（状态回写）
        ↓
Notion 主脑更新
        ↓
生成下一任务（自动开发循环）
```
