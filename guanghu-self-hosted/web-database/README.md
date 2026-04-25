# 光湖工单数据库 · Guanghu Work Order Database

> **编号**: GH-DB-001  
> **阶段**: Phase-NOW-003  
> **技术栈**: PostgreSQL 15+  
> **作者**: 译典A05 (5TH-LE-HK-A05)

## 概述

光湖网站自有工单引擎的数据库层，替代 Notion 半体工单数据库。  
与 PersonaDB 同实例部署，共享 PostgreSQL 数据库。

## 表结构

| 表名 | 说明 | 备注 |
|------|------|------|
| `agents` | Agent 注册表 · 身份 / 状态 / 心跳 | FK→PersonaDB.personas |
| `work_orders` | 工单主表 · 任务全生命周期 | FK→agents · updated_at 触发器 |
| `execution_logs` | 执行日志 · Agent 操作追踪 | FK→work_orders + agents |
| `review_records` | 审核记录 · 每次审核留痕 | FK→work_orders |
| `chat_messages` | 聊天消息 (预留) | Agent 间通信 |

## 枚举类型

所有枚举前缀 `gh_` 避免与 PersonaDB 命名冲突：

| 枚举 | 值 |
|------|----|
| `gh_work_order_status` | pending → developing → self_checking → reviewing → approved / completed (suspended) |
| `gh_work_order_priority` | P0 / P1 / P2 |
| `gh_agent_status` | online / offline / busy |
| `gh_execution_action` | claimed / started / self_checked / submitted / reviewed |
| `gh_review_result` | pass / fail / revision_needed |
| `gh_message_type` | text / command / system |

## 前置依赖

- **PersonaDB** 的 `extensions.sql` + `schema.sql` 须先执行  
  （`agents.persona_db_ref` 为 FK→`personas.id`）
- **PostgreSQL 15+** 已安装（使用 `gen_random_uuid()` 无需额外扩展）

## 部署方式

### 方式一：分步执行（推荐开发环境）

```bash
psql -U <user> -d <database> -f schema.sql
psql -U <user> -d <database> -f indexes.sql
psql -U <user> -d <database> -f seed.sql
```

### 方式二：一键迁移（推荐生产环境）

```bash
psql -U <user> -d <database> -f migrations/001_init.sql
```

## 目录结构

```
web-database/
├── schema.sql             # 建表 + 枚举 + 约束 + 触发器 + COMMENT ON
├── indexes.sql            # 组合索引 + 时间索引
├── seed.sql               # 初始 Agent 数据 (译典/培园/录册/霜砚Web)
├── migrations/
│   └── 001_init.sql       # 可复现迁移（schema + indexes + seed 合一）
└── README.md              # 本文件
```

## 关键设计决策

1. **枚举前缀 `gh_`** — 避免与 PersonaDB 及未来模块的类型名冲突
2. **`updated_at` 触发器** — `work_orders` 表自动维护更新时间
3. **`persona_db_ref` FK** — 软关联 PersonaDB 人格体，`ON DELETE SET NULL`
4. **`gen_random_uuid()`** — 使用 PG 15+ 原生函数，无需 `uuid-ossp` 扩展
5. **`COMMENT ON` 全覆盖** — 所有表、列、枚举均有中文注释
6. **事务包裹** — `migrations/001_init.sql` 使用 `BEGIN/COMMIT` 确保原子性

## 索引策略

| 索引 | 表 | 用途 |
|------|----|------|
| `idx_work_orders_status_agent` | work_orders | 按状态+Agent 查询待办 |
| `idx_work_orders_created_at_desc` | work_orders | 最新工单列表 |
| `idx_execution_logs_order_created` | execution_logs | 工单执行历史 |
| `idx_execution_logs_agent` | execution_logs | Agent 执行记录 |
| `idx_review_records_order` | review_records | 工单审核历史 |
| `idx_chat_messages_sender_created` | chat_messages | 发送方消息历史 |
| `idx_chat_messages_receiver_created` | chat_messages | 接收方消息历史 |

> UNIQUE 约束 (`agents.code`, `work_orders.code`) 自动创建唯一索引，无需额外建。

## 下游依赖

- **GH-API-001** — 光湖网站 API 层 → 连接此数据库
- **seed.sql** — 包含 4 个 Agent 初始数据，API 层启动时可直接读取
