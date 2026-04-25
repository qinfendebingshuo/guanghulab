# GH-API-001 · 工单领取API · Work Order Claim API

光湖自研平台 · Agent通过REST API领取工单 · 解耦数据库依赖

**编号**: GH-API-001  
**阶段**: Phase-NOW-005  
**开发**: 培园A04 (PY-A04)  
**架构层**: L5 自建开发中枢  

---

## 架构定位

```
Agent Scheduler (GH-SCHED-001)
    ↓ HTTP
Work Order API (本模块)
    ↓ asyncpg
PostgreSQL (工单数据库)
```

Agent调度器不再直接查询数据库，而是通过本API的REST接口领取工单。
解耦数据库依赖 → Agent只需要知道API地址和Key。

---

## 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查(无需认证) |
| GET | `/api/v1/orders/pending?agent_id={id}` | 查询待领取工单 |
| GET | `/api/v1/orders/{id}` | 查询工单详情 |
| POST | `/api/v1/orders/{id}/claim` | 领取工单(status→developing) |
| PATCH | `/api/v1/orders/{id}/status` | 更新工单状态 |
| POST | `/api/v1/orders/{id}/log` | 写入执行日志 |
| GET | `/api/v1/orders/{id}/logs` | 查询工单日志 |

---

## 安全机制

- **API Key认证**: Header `X-Agent-Key` → 解析为Agent编号
- **Agent隔离**: Agent只能操作分配给自己的工单
- **速率限制**: 每Agent每分钟60次(可配置)
- **开发模式**: 未配置API Key时自动放行(dev-agent)

---

## 快速启动

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
export WO_API_DATABASE_URL="postgresql://guanghu:guanghu@localhost:5432/guanghu"
export WO_API_AGENT_API_KEYS="PY-A04:sk-py-a04-secret,YD-A05:sk-yd-a05-secret"

# 启动服务
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8001
```

服务启动后自动建表(work_orders + execution_logs)。

---

## 建表SQL (参考)

服务启动时自动执行，也可手动运行:

```sql
CREATE TABLE IF NOT EXISTS work_orders (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    order_code      TEXT NOT NULL UNIQUE,
    phase_code      TEXT,
    priority        TEXT NOT NULL DEFAULT 'P1',
    status          TEXT NOT NULL DEFAULT 'pending',
    description     TEXT NOT NULL DEFAULT '',
    repo_path       TEXT,
    branch_name     TEXT,
    constraints_    TEXT,
    assigned_agent  TEXT,
    self_check_result TEXT,
    review_result   TEXT,
    next_guide      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_logs (
    id          SERIAL PRIMARY KEY,
    order_id    INT NOT NULL REFERENCES work_orders(id),
    level       TEXT NOT NULL DEFAULT 'INFO',
    message     TEXT NOT NULL,
    step        TEXT,
    metadata_   JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WO_API_DATABASE_URL` | `postgresql://guanghu:guanghu@localhost:5432/guanghu` | PG连接串 |
| `WO_API_AGENT_API_KEYS` | (空) | Agent Key映射 |
| `WO_API_PORT` | 8001 | 服务端口 |
| `WO_API_RATE_LIMIT_PER_MINUTE` | 60 | 每Agent每分钟限制 |
| `WO_API_LOG_LEVEL` | INFO | 日志级别 |
| `WO_API_CORS_ORIGINS` | `http://localhost:3000,...` | CORS允许源 |

---

## 测试

```bash
pytest test_work_order_api.py -v
```

10条用例覆盖: 配置解析 · API Key认证 · 速率限制 · 模型序列化

---

## 与Agent Scheduler集成

Agent Scheduler (GH-SCHED-001) 改用本API后:

```python
import httpx

async def fetch_pending_orders(agent_id: str, api_key: str):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "http://localhost:8001/api/v1/orders/pending",
            params={"agent_id": agent_id},
            headers={"X-Agent-Key": api_key},
        )
        return resp.json()

async def claim_order(order_id: int, api_key: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"http://localhost:8001/api/v1/orders/{order_id}/claim",
            headers={"X-Agent-Key": api_key},
        )
        return resp.json()
```
