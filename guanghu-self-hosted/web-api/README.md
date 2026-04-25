# 光湖网站后端API · GH-API-001

光湖自研开发中枢后端 · Agent Dev Hub · 工单引擎 + Agent管理 + GitHub集成

## 架构位置

HLDP-ARCH-001 · [L5] 自建开发中枢 · Agent Dev Hub

## 技术栈

- **Python 3.10+**
- **FastAPI** — 异步Web框架
- **asyncpg** — PostgreSQL异步驱动
- **Pydantic v2** — 数据验证
- **uvicorn** — ASGI服务器

## 目录结构

```
web-api/
├── main.py              # FastAPI app + lifespan
├── config.py            # Pydantic Settings · 环境变量
├── db.py                # asyncpg连接池
├── models.py            # 请求/响应模型
├── routes/
│   ├── __init__.py
│   ├── orders.py        # 工单CRUD + 领取/自检/审核
│   ├── agents.py        # Agent注册/列表/心跳/状态
│   ├── dispatch.py      # 任务分发
│   └── webhook.py       # GitHub Webhook
├── test_web_api.py      # pytest测试 (13条)
├── requirements.txt
└── README.md
```

## API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/orders` | GET | 工单列表（支持筛选） |
| `/api/orders` | POST | 创建工单 |
| `/api/orders/{id}` | GET | 工单详情 |
| `/api/orders/{id}` | PATCH | 更新工单 |
| `/api/orders/{id}/claim` | POST | Agent领取工单 |
| `/api/orders/{id}/self-check` | POST | 提交自检结果 |
| `/api/orders/{id}/review` | POST | 提交审核结果 |
| `/api/agents` | GET | Agent列表 |
| `/api/agents` | POST | 注册Agent |
| `/api/agents/heartbeat` | POST | Agent心跳 |
| `/api/agents/{id}` | GET | Agent详情 |
| `/api/agents/{id}/status` | PATCH | 更新Agent状态 |
| `/api/dispatch` | POST | 任务分发 |
| `/api/webhook/github` | POST | GitHub Webhook |
| `/api/auth/token` | POST | JWT认证（Phase 2预留） |

## 环境变量

所有配置以 `GH_API_` 前缀，例如：

```env
GH_API_DATABASE_URL=postgresql://guanghu:guanghu@localhost:5432/guanghu
GH_API_HOST=0.0.0.0
GH_API_PORT=8000
GH_API_DEBUG=false
GH_API_CORS_ORIGINS=http://localhost:3000
GH_API_GITHUB_WEBHOOK_SECRET=your-secret
GH_API_TOOL_RECEIPT_URL=http://localhost:8001
GH_API_MEMORY_ROUTER_URL=http://localhost:8002
```

## 快速启动

```bash
cd guanghu-self-hosted/web-api/
pip install -r requirements.txt

# 配置环境变量
export GH_API_DATABASE_URL=postgresql://guanghu:guanghu@localhost:5432/guanghu

# 启动
python main.py

# 或使用uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 数据库

需要GH-DB-001设计的表。基础建表SQL：

```sql
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    order_code VARCHAR(100) UNIQUE NOT NULL,
    phase_code VARCHAR(100),
    priority VARCHAR(10) DEFAULT 'P1',
    status VARCHAR(30) DEFAULT 'pending',
    description TEXT DEFAULT '',
    repo_path VARCHAR(500),
    branch_name VARCHAR(200),
    constraints TEXT,
    assigned_agent VARCHAR(100),
    self_check_result TEXT,
    review_result TEXT,
    next_guide TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    agent_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(30) DEFAULT 'idle',
    capabilities TEXT DEFAULT '[]',
    prefix VARCHAR(50) DEFAULT '',
    current_order_id INTEGER REFERENCES orders(id),
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_agent ON orders(assigned_agent);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_code ON agents(agent_code);
```

## 测试

```bash
pytest test_web_api.py -v
```

## 与Phase 0集成

- **工具回执系统** (tool-receipt): 通过 `GH_API_TOOL_RECEIPT_URL` 配置
- **记忆路由** (memory-router): 通过 `GH_API_MEMORY_ROUTER_URL` 配置
- **Boot Protocol**: 预留Agent启动接口

## 开发者

- **培园A04** · 5TH-LE-HK-A04 · 半体工单 GH-API-001
