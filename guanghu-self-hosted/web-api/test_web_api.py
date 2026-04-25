"""GH-API-002 · Web API 测试用例 · 对齐GH-DB-001 schema

使用httpx.AsyncClient + FastAPI TestClient
15条pytest用例 · 覆盖工单/Agent/聊天/分发/Webhook
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
import uuid


# ========== Mock DB ==========

class MockRecord(dict):
    """模拟asyncpg.Record"""
    def __getitem__(self, key):
        if isinstance(key, str):
            return super().__getitem__(key)
        return list(self.values())[key]


def _new_uuid():
    return uuid.uuid4()


def make_order_record(**overrides) -> MockRecord:
    base = {
        "id": _new_uuid(),
        "code": "GH-API-TEST-001",
        "title": "Test Order",
        "status": "pending",
        "priority": "P0",
        "phase": "Phase-TEST",
        "dev_content": "Test dev content",
        "repo_path": "/test/",
        "branch_name": "feat/test",
        "constraints": "test only",
        "assigned_agent": None,
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
        "id": _new_uuid(),
        "code": "A01",
        "name": "Test Agent",
        "role": "test",
        "status": "offline",
        "last_heartbeat": None,
        "boot_config_ref": None,
        "persona_db_ref": None,
        "created_at": datetime.now(timezone.utc),
    }
    base.update(overrides)
    return MockRecord(base)


def make_chat_record(**overrides) -> MockRecord:
    base = {
        "id": _new_uuid(),
        "sender": "A04",
        "receiver": "SY-WEB",
        "content": "Hello from test",
        "msg_type": "text",
        "created_at": datetime.now(timezone.utc),
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
        from main import app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


# ========== Tests ==========

@pytest.mark.asyncio
async def test_health_check(client):
    """T01: 健康检查端点 · version=0.2.0"""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.2.0"


@pytest.mark.asyncio
async def test_auth_token_placeholder(client):
    """T02: JWT认证占位端点"""
    resp = await client.post(
        "/api/auth/token",
        json={"username": "test", "password": "test"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_create_order(client, mock_pool):
    """T03: 创建工单 · UUID主键 · code字段 · dev_content"""
    order = make_order_record()
    mock_pool.fetchrow = AsyncMock(return_value=order)
    resp = await client.post("/api/orders", json={
        "title": "Test Order",
        "code": "GH-API-TEST-001",
        "priority": "P0",
        "dev_content": "Test content",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "GH-API-TEST-001"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_orders(client, mock_pool):
    """T04: 获取工单列表(work_orders)"""
    mock_pool.fetchval = AsyncMock(return_value=0)
    mock_pool.fetch = AsyncMock(return_value=[])
    resp = await client.get("/api/orders")
    assert resp.status_code == 200
    data = resp.json()
    assert "orders" in data
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_order_not_found(client, mock_pool):
    """T05: 获取不存在的工单 · UUID路径"""
    mock_pool.fetchrow = AsyncMock(return_value=None)
    test_uuid = str(_new_uuid())
    resp = await client.get("/api/orders/" + test_uuid)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_claim_order(client, mock_pool):
    """T06: Agent领取工单 · agent code -> UUID解析"""
    agent_id = _new_uuid()
    pending_order = make_order_record(status="pending")
    claimed_order = make_order_record(status="developing", assigned_agent=agent_id)
    agent_lookup = MockRecord({"id": agent_id})
    agent_code_lookup = MockRecord({"code": "A04"})
    mock_pool.fetchrow = AsyncMock(side_effect=[
        pending_order,
        agent_lookup,
        claimed_order,
        agent_code_lookup,
    ])
    oid = str(pending_order["id"])
    resp = await client.post("/api/orders/" + oid + "/claim?agent_code=A04")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_claim_order_wrong_status(client, mock_pool):
    """T07: 非pending工单不可领取 · developing状态"""
    order = make_order_record(status="developing")
    mock_pool.fetchrow = AsyncMock(return_value=order)
    oid = str(order["id"])
    resp = await client.post("/api/orders/" + oid + "/claim?agent_code=A04")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_register_agent(client, mock_pool):
    """T08: 注册Agent · code/name/role"""
    agent = make_agent_record()
    mock_pool.fetchrow = AsyncMock(side_effect=[None, agent])
    resp = await client.post("/api/agents", json={
        "code": "A01",
        "name": "Test Agent",
        "role": "test developer",
    })
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_register_agent_duplicate(client, mock_pool):
    """T09: 重复注册Agent"""
    mock_pool.fetchrow = AsyncMock(return_value=make_agent_record())
    resp = await client.post("/api/agents", json={
        "code": "A01",
        "name": "Test Agent",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_agent_heartbeat(client, mock_pool):
    """T10: Agent心跳 · code/status"""
    mock_pool.execute = AsyncMock(return_value="UPDATE 1")
    resp = await client.post("/api/agents/heartbeat", json={
        "code": "A01",
        "status": "online",
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


@pytest.mark.asyncio
async def test_create_chat_message(client, mock_pool):
    """T13: 创建聊天消息 · chat_messages表"""
    msg = make_chat_record()
    mock_pool.fetchrow = AsyncMock(return_value=msg)
    resp = await client.post("/api/chat/messages", json={
        "sender": "A04",
        "receiver": "SY-WEB",
        "content": "Hello from test",
        "msg_type": "text",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["sender"] == "A04"
    assert data["receiver"] == "SY-WEB"


@pytest.mark.asyncio
async def test_list_chat_messages(client, mock_pool):
    """T14: 获取聊天消息列表"""
    mock_pool.fetchval = AsyncMock(return_value=0)
    mock_pool.fetch = AsyncMock(return_value=[])
    resp = await client.get("/api/chat/messages")
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_conversation(client, mock_pool):
    """T15: 获取两方对话"""
    mock_pool.fetchval = AsyncMock(return_value=0)
    mock_pool.fetch = AsyncMock(return_value=[])
    resp = await client.get("/api/chat/conversation?party_a=A04&party_b=SY-WEB")
    assert resp.status_code == 200
    data = resp.json()
    assert "messages" in data
