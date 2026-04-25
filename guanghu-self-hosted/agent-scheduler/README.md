# Agent Scheduler · GH-SCHED-001 + GH-INTG-001

光湖自研平台 · Agent调度器 · 工单领取API集成

Part of HLDP-ARCH-001 L5 · Agent Dev Hub

## 架构

```
┌─────────────────────┐     REST API      ┌──────────────────────┐
│   Agent Scheduler   │ ◀──────────────▶  │  Work Order API      │
│   (scheduler.py)    │   /api/v1/*       │  (GH-API-001)        │
│                     │                    │  Port: 8001          │
│   api_client.py     │   X-Agent-Key     │  auth.py + routes.py │
│   (httpx async)     │                    │  asyncpg + PostgreSQL│
└─────────────────────┘                    └──────────────────────┘
        │ fallback                                   │
        ▼                                            ▼
  ┌───────────┐                              ┌──────────────┐
  │ Direct DB │  (when API unavailable)       │  PostgreSQL  │
  │ (asyncpg) │                              │  guanghu_dev │
  └───────────┘                              └──────────────┘
```

## 模块清单

| 文件 | 大小 | 功能 |
|------|------|------|
| `config.py` | ~3.5KB | 配置 · 环境变量 · PG/LLM/Git/API四块 |
| `scheduler.py` | ~14KB | 核心引擎 · async轮询 · 执行闭环 |
| `api_client.py` | ~11KB | Work Order API客户端 · httpx async · 重试 · 降级 |
| `boot_integration.py` | ~4KB | Boot Protocol对接 · JSON身份加载 |
| `llm_client.py` | ~7KB | httpx异步 · 3次重试+指数退避 |
| `git_ops.py` | ~6KB | asyncio.subprocess · clone/checkout/push |
| `self_checker.py` | ~9KB | 7项自检 · AST语法 · 目录隔离 |
| `test_scheduler.py` | ~8KB | 10条测试 · 覆盖config/boot/llm/git/selfcheck |
| `integration_test.py` | ~10KB | 10条集成测试 · API client + Hybrid fallback |
| `requirements.txt` | ~0.2KB | 依赖清单 |

## API集成 (GH-INTG-001)

### WorkOrderAPIClient

`api_client.py` 提供与 `WorkOrderDB` 相同的接口，但通过 REST API 通信：

```python
from api_client import WorkOrderAPIClient

async with WorkOrderAPIClient(
    base_url="http://localhost:8001",
    api_key="sk-py-a04-secret",
) as client:
    # 查询待领取工单
    orders = await client.fetch_pending_orders("PY-A04")

    # 领取工单
    claim = await client.claim_order(order_id=1, agent_code="PY-A04")

    # 更新状态
    await client.update_order_status(1, "self_check", self_check_result="OK")

    # 写执行日志
    await client.write_execution_log(1, "PY-A04", {
        "step": "develop", "message": "Code pushed"
    })
```

### HybridOrderSource (降级策略)

`HybridOrderSource` 封装了 API + DB 双通道：
- API 可用时走 REST
- API 不可用时自动降级到直连 DB
- 定期探活恢复 API 通道

```python
from api_client import WorkOrderAPIClient, HybridOrderSource
from scheduler import WorkOrderDB

hybrid = HybridOrderSource(
    api_client=WorkOrderAPIClient(...),
    db_fallback=WorkOrderDB(...),
)
orders = await hybrid.fetch_pending_orders("PY-A04")
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WO_USE_API` | `true` | 启用API模式 |
| `WO_API_BASE_URL` | `http://localhost:8001` | Work Order API地址 |
| `WO_API_KEY` | (空) | API Key (X-Agent-Key) |
| `WO_API_TIMEOUT` | `30` | 请求超时(秒) |
| `WO_API_MAX_RETRIES` | `3` | 最大重试次数 |
| `WO_API_RETRY_DELAY` | `2.0` | 重试基础延迟(秒) |
| `WO_API_FALLBACK_DB` | `true` | API不可用时降级到直连DB |

## 快速启动

```bash
# 1. 启动 Work Order API
cd ../work-order-api
pip install -r requirements.txt
uvicorn main:app --port 8001

# 2. 启动 Agent Scheduler (API模式)
cd ../agent-scheduler
pip install -r requirements.txt
export WO_USE_API=true
export WO_API_BASE_URL=http://localhost:8001
export WO_API_KEY=sk-py-a04-secret
python scheduler.py

# 3. 运行集成测试
pytest integration_test.py -v
```

## 端到端流程

```
1. 工单创建 (status=pending)
       ↓
2. Scheduler轮询 → API: GET /orders/pending
       ↓
3. Scheduler领取 → API: POST /orders/{id}/claim
       ↓ status → developing
4. Scheduler开发 → LLM + Git
       ↓
5. Scheduler自检 → API: PATCH /orders/{id}/status (self_check)
       ↓ status → self_check
6. Scheduler提审 → API: PATCH /orders/{id}/status (awaiting_review)
       ↓ status → awaiting_review
7. 审核通过 → status → completed
```

## 开发信息

- **编号**: GH-INTG-001 (集成) + GH-SCHED-001 (调度器)
- **开发者**: 培园A04
- **分支**: `feat/gh-sched-api-integration`
- **依赖**: GH-API-001 (工单领取API)
