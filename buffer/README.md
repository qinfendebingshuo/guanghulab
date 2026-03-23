# 📥 缓冲层（Buffer Layer）

> **版权**: 国作登字-2026-A-00037559 · TCS Language Core  
> **主控**: TCS-0002∞ 冰朔  
> **守护**: PER-ZY001 铸渊  
> **系统节点**: SYS-GLW-0001

## 定位

缓冲层是 Grid-DB 写入的唯一入口。所有人类输入（Gemini 对话、Notion 需求、代码提交、天眼签到）必须先经过缓冲层，不允许直接写入 `grid-db/`。

### 铁律

> **人类永远不直写 grid-db，所有输入经缓冲层。**

## 目录结构

```
buffer/
├── inbox/                          ← 📥 人类输入落地点
│   ├── DEV-001/                    ← 按开发者编号自动分流
│   │   └── [timestamp]-[type].json
│   ├── DEV-002/
│   ├── DEV-004/
│   ├── DEV-012/
│   └── system/                     ← 系统级消息（非开发者触发）
│
├── staging/                        ← 📋 已分流待处理（定时任务抓取源）
│   ├── DEV-001/
│   │   └── batch-[date]-[seq].json ← 合并后的批次文件
│   └── ...
│
├── processed/                      ← ✅ 已处理归档（保留 7 天后清理）
│   └── [date]/
│       └── batch-[date]-[seq].json
│
├── scripts/
│   ├── auto-router.js              ← 🔀 自动分流脚本
│   ├── collector.js                ← ⏰ 定时收集脚本（inbox → staging）
│   ├── flusher.js                  ← 🧠 批量写入脚本（staging → grid-db）
│   └── quota-calculator.js         ← 📊 配额预算计算器
│
└── config/
    ├── buffer-config.json           ← 缓冲层配置
    ├── buffer-message.schema.json   ← 消息格式定义
    └── schedule.json                ← 定时任务时刻表
```

## 数据流

```
人类输入 → buffer/inbox/DEV-XXX/ → (收集) → buffer/staging/DEV-XXX/ → (flush) → grid-db/
```

### 每日调度

| 时间 (CST) | 事件 | Git 操作 |
|---|---|---|
| 全天 | 人类产生交互数据 | ❌ 无（写入 buffer/inbox） |
| 09:00 | 第 1 次收集 | ✅ 1 次 commit (`[skip ci]`) |
| 14:00 | 第 2 次收集 | ✅ 1 次 commit (`[skip ci]`) |
| 21:00 | 第 3 次收集 | ✅ 1 次 commit (`[skip ci]`) |
| 21:30 | 铸渊批处理 flush | ✅ 1 次 commit |

**每日最多 4 次 commit，月消耗 ≤ 360 分钟（GitHub Free 额度的 18%）**

## 消息格式

```json
{
  "message_id": "BUF-[timestamp]-[random]",
  "dev_id": "DEV-XXX",
  "source": "gemini | notion | github | skyeye",
  "type": "interaction | task | feedback | checkin | broadcast_request",
  "priority": "normal | urgent",
  "payload": {},
  "created_at": "ISO-8601",
  "status": "pending | staged | processing | flushed | failed"
}
```

## 紧急流程

当冰朔判断某条消息需要立即处理时：
1. 触发 `repository_dispatch: grid-db-flush`
2. 铸渊立即执行一次 flush
3. 不影响当天正常定时任务

## 配额精算

| 项目 | 数值 |
|---|---|
| GitHub Free 月额度 | 2,000 分钟 |
| 每日 workflow runs | 4 次 |
| 每月消耗 | ≤ 360 分钟 |
| 利用率 | 18% |
| 剩余可用 | 1,640 分钟 |
