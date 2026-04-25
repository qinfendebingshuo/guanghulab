# 光湖网站后端API · GH-API-002

光湖自研开发中枢 · Agent Dev Hub · FastAPI后端

## 对齐GH-DB-001

所有表名/列名/主键类型严格对齐 `guanghu-self-hosted/web-database/schema.sql`:

| 旧(GH-API-001) | 新(GH-API-002) | GH-DB-001 |
|---|---|---|
| orders | work_orders | work_orders |
| id SERIAL | id UUID | id UUID gen_random_uuid() |
| order_code | code | code VARCHAR(64) |
| description | dev_content | dev_content TEXT |
| phase_code | phase | phase VARCHAR(64) |
| agent_code | code | code VARCHAR(16) |
| capabilities | (removed) | (not in schema) |
| prefix | (removed) | (not in schema) |
| (none) | role | role VARCHAR(128) |
| (none) | /api/chat/messages | chat_messages table |

## API端点 (共19个)

### 工单 /api/orders (7)
- `GET /api/orders` — 工单列表(分页+状态/Agent过滤)
- `POST /api/orders` — 创建工单
- `GET /api/orders/{id}` — 工单详情
- `PATCH /api/orders/{id}` — 更新工单
- `POST /api/orders/{id}/claim` — Agent领取工单
- `POST /api/orders/{id}/self-check` — 提交自检结果
- `POST /api/orders/{id}/review` — 提交审核结果

### Agent /api/agents (5)
- `GET /api/agents` — Agent列表
- `POST /api/agents` — 注册Agent(code/name/role)
- `POST /api/agents/heartbeat` — Agent心跳
- `GET /api/agents/{id}` — Agent详情
- `PATCH /api/agents/{id}/status` — 更新Agent状态

### 聊天 /api/chat (5) [NEW]
- `GET /api/chat/messages` — 消息列表(分页+sender/receiver/type过滤)
- `POST /api/chat/messages` — 发送消息
- `GET /api/chat/messages/{id}` — 获取单条消息
- `DELETE /api/chat/messages/{id}` — 删除消息
- `GET /api/chat/conversation` — 获取两方对话(时间正序)

### 分发 /api/dispatch (1)
- `POST /api/dispatch` — 自动匹配分发(优先级排序+Agent在线匹配)

### Webhook /api/webhook (1)
- `POST /api/webhook/github` — GitHub push/PR事件接收(签名验证)

## 环境变量

所有环境变量使用 `GH_API_` 前缀:

| 变量 | 默认值 | 说明 |
|---|---|---|
| GH_API_DATABASE_URL | postgresql://guanghu:guanghu@localhost:5432/guanghu | 数据库连接 |
| GH_API_HOST | 0.0.0.0 | 监听地址 |
| GH_API_PORT | 8000 | 监听端口 |
| GH_API_DEBUG | false | 调试模式 |
| GH_API_CORS_ORIGINS | http://localhost:3000,http://localhost:3001 | CORS白名单 |
| GH_API_GITHUB_WEBHOOK_SECRET | (none) | GitHub Webhook密钥 |

## 前置依赖

需要先执行GH-DB-001的建表SQL:
```sql
-- 按顺序执行
\i guanghu-self-hosted/web-database/schema.sql
\i guanghu-self-hosted/web-database/indexes.sql
\i guanghu-self-hosted/web-database/seed.sql
```

## 快速启动

```bash
cd guanghu-self-hosted/web-api
pip install -r requirements.txt
python main.py
```

## 技术栈

- FastAPI 0.115+ · Pydantic v2 · asyncpg · uvicorn
- PostgreSQL 15+ · UUID主键 · 枚举类型 · updated_at触发器
- 全开源 · 零软件成本
