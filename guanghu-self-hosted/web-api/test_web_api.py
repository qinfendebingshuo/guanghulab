"""GH-API-001 · Web API 测试用例

使用httpx.AsyncClient + FastAPI TestClient
至少10条pytest用例
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone


# ========== Mock DB ==========

class MockRecord(dict):
    """模拟asyncpg.Record"""
    def __getitem__(self, key):
        if isinstance(key, str):
            return super().__getitem__(key)
        return list(self.values())[key]


def make_order_record(**overrides) -> MockRecord:
    base = {
        "id": 1,
        "title": "Test Order",
        "order_code": "PY-A04-TEST-001",
        "phase_code": "Phase-TEST",
        "priority": "P0",
        "status": "pending",
        "description": "Test description",
        "repo_path": "/test/",
        "branch_name": "feat/test",
        "constraints": "test only",
        "assigned_agent": "TestAgent",
        "self_check_result": None,
        "review_result": None,
        "next_guide": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    base.update(overrides)
    return MockRecord(base)


def make_agent_record(**overrides) -> MockRecord:
    base = {
        "id": 1,
        "agent_code": "TestA01",
        "name": "Test Agent",
        "status": "idle",
        "capabilities": '[]',
        "prefix": "TA",
        "current_order_id": None,
        "last_heartbeat": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    base.update(overrides)
    return MockRecord(base)


# ========== Fixtures ==========

@pytest.fixture
def mock_pool():
    pool = AsyncMock()
    pool.fetchval = AsyncMock(return_value=1)
    pool.fetch = AsyncMock(return_value=[])
    pool.fetchrow = AsyncMock(return_value=None)
    pool.execute = AsyncMock(return_value="UPDATE 1")
    return pool


@pytest_asyncio.fixture
async def client(mock_pool):
    with patch("db._pool", mock_pool), \
         patch("db.get_pool", AsyncMock(return_value=mock_pool)):
        # Import after patching
        from main import app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


# ========== Tests ==========

@pytest.mark.asyncio
async def test_health_check(client):
    """T01: 健康检查端点"""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "guanghu-web-api"


@pytest.mark.asyncio
async def test_auth_token_placeholder(client):
    """T02: JWT认证占位端点"""
    resp = await client.post("/api/auth/token", json={"username": "test", "password": "test"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "Phase 2" in data["message"]


@pytest.mark.asyncio
async def test_create_order(client, mock_pool):
    """T03: 创建工单"""
    mock_pool.fetchrow = AsyncMock(return_value=make_order_record())
    resp = await client.post("/api/orders", json={
        "title": "Test Order",
        "order_code": "PY-A04-TEST-001",
        "priority": "P0",
        "description": "Test",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_code"] == "PY-A04-TEST-001"


@pytest.mark.asyncio
async def test_list_orders(client, mock_pool):
    """T04: 获取工单列表"""
    mock_pool.fetchval = AsyncMock(return_value=0)
    mock_pool.fetch = AsyncMock(return_value=[])
    resp = await client.get("/api/orders")
    assert resp.status_code == 200
    data = resp.json()
    assert "orders" in data
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_order_not_found(client, mock_pool):
    """T05: 获取不存在的工单"""
    mock_pool.fetchrow = AsyncMock(return_value=None)
    resp = await client.get("/api/orders/999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_claim_order(client, mock_pool):
    """T06: Agent领取工单"""
    pending_order = make_order_record(status="pending")
    claimed_order = make_order_record(status="in_progress", assigned_agent="TestA01")
    mock_pool.fetchrow = AsyncMock(side_effect=[pending_order, claimed_order])
    resp = await client.post("/api/orders/1/claim?agent_code=TestA01")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "in_progress"


@pytest.mark.asyncio
async def test_claim_order_wrong_status(client, mock_pool):
    """T07: 非待开发工单不可领取"""
    in_progress_order = make_order_record(status="in_progress")
    mock_pool.fetchrow = AsyncMock(return_value=in_progress_order)
    resp = await client.post("/api/orders/1/claim?agent_code=TestA01")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_register_agent(client, mock_pool):
    """T08: 注册Agent"""
    mock_pool.fetchrow = AsyncMock(
        side_effect=[None, make_agent_record()]
    )
    resp = await client.post("/api/agents", json={
        "agent_code": "TestA01",
        "name": "Test Agent",
        "capabilities": ["python", "fastapi"],
        "prefix": "TA",
    })
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_register_agent_duplicate(client, mock_pool):
    """T09: 重复注册Agent"""
    mock_pool.fetchrow = AsyncMock(return_value=make_agent_record())
    resp = await client.post("/api/agents", json={
        "agent_code": "TestA01",
        "name": "Test Agent",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_agent_heartbeat(client, mock_pool):
    """T10: Agent心跳"""
    mock_pool.execute = AsyncMock(return_value="UPDATE 1")
    resp = await client.post("/api/agents/heartbeat", json={
        "agent_code": "TestA01",
        "status": "idle",
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_dispatch_no_pending_orders(client, mock_pool):
    """T11: 分发 - 无待开发工单"""
    mock_pool.fetchrow = AsyncMock(return_value=None)
    resp = await client.post("/api/dispatch")
    assert resp.status_code == 200
    data = resp.json()
    assert data["dispatched"] is False


@pytest.mark.asyncio
async def test_github_webhook_push(client):
    """T12: GitHub Webhook push事件"""
    resp = await client.post(
        "/api/webhook/github",
        json={
            "ref": "refs/heads/main",
            "repository": {"full_name": "qinfendebingshuo/guanghulab"},
            "sender": {"login": "test"},
            "commits": [{"id": "abc123"}],
        },
        headers={"X-GitHub-Event": "push"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "push" in data["message"]


@pytest.mark.asyncio
async def test_submit_self_check(client, mock_pool):
    """T13: 提交自检结果"""
    existing = make_order_record(status="in_progress")
    updated = make_order_record(status="awaiting_review", self_check_result="All pass")
    mock_pool.fetchrow = AsyncMock(side_effect=[existing, updated])
    resp = await client.post("/api/orders/1/self-check?result=All+pass")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "awaiting_review"
