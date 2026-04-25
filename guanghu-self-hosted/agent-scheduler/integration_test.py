"""GH-INTG-001 · Agent Scheduler <-> Work Order API Integration Tests

Tests the end-to-end flow:
  1. API health check
  2. Fetch pending orders
  3. Claim order
  4. Status transitions (developing -> self_check -> awaiting_review)
  5. Execution log writing
  6. Error handling & fallback
  7. Auth validation
  8. Connection retry logic

Part of HLDP-ARCH-001 L5 · Agent Dev Hub.
编号前缀: GH-INTG · 培园A04

Run: pytest integration_test.py -v
"""

import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from api_client import (
    APIClientAuthError,
    APIClientConnectionError,
    APIClientError,
    HybridOrderSource,
    WorkOrderAPIClient,
)
from config import load_config


# ===========================================================================
# Fixtures & Helpers
# ===========================================================================

class MockResponse:
    """Lightweight mock for httpx.Response."""

    def __init__(self, status_code: int = 200, body: Any = None, text: str = ""):
        self.status_code = status_code
        self._body = body
        self.text = text or json.dumps(body or {})

    def json(self):
        if self._body is not None:
            return self._body
        return json.loads(self.text)


def make_order(order_id: int = 1, status: str = "pending") -> Dict[str, Any]:
    """Create a mock order dict matching API response shape."""
    return {
        "id": order_id,
        "title": "Test Order " + str(order_id),
        "order_code": "GH-TEST-" + str(order_id).zfill(3),
        "phase_code": "Phase-TEST",
        "priority": "P0",
        "status": status,
        "description": "Integration test order",
        "repo_path": "/guanghu-self-hosted/test/",
        "branch_name": "feat/test-branch",
        "constraints": "Python 3.10+",
        "assigned_agent": "PY-A04",
        "self_check_result": None,
        "review_result": None,
        "next_guide": None,
        "created_at": "2026-04-25T08:00:00Z",
        "updated_at": "2026-04-25T08:00:00Z",
    }


# ===========================================================================
# Test 1: API Health Check
# ===========================================================================

@pytest.mark.asyncio
async def test_health_check_success():
    """Test: API health check returns healthy status."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(
        200, {"status": "ok", "db_connected": True, "service": "guanghu-work-order-api"}
    ))
    client._client = mock_client

    result = await client.health_check()
    assert result["status"] == "ok"
    assert result["db_connected"] is True

    healthy = await client.is_healthy()
    assert healthy is True


@pytest.mark.asyncio
async def test_health_check_unhealthy():
    """Test: API health check returns unhealthy when DB disconnected."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(
        200, {"status": "ok", "db_connected": False}
    ))
    client._client = mock_client

    healthy = await client.is_healthy()
    assert healthy is False


# ===========================================================================
# Test 2: Fetch Pending Orders
# ===========================================================================

@pytest.mark.asyncio
async def test_fetch_pending_orders():
    """Test: fetch pending orders returns list of order dicts."""
    orders = [make_order(1), make_order(2)]
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(
        200, {"orders": orders, "total": 2}
    ))
    client._client = mock_client

    result = await client.fetch_pending_orders("PY-A04")
    assert len(result) == 2
    assert result[0]["id"] == 1
    assert result[0]["status"] == "pending"
    assert result[1]["order_code"] == "GH-TEST-002"


@pytest.mark.asyncio
async def test_fetch_pending_orders_empty():
    """Test: fetch pending orders returns empty when none available."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(
        200, {"orders": [], "total": 0}
    ))
    client._client = mock_client

    result = await client.fetch_pending_orders("PY-A04")
    assert result == []


# ===========================================================================
# Test 3: Claim Order
# ===========================================================================

@pytest.mark.asyncio
async def test_claim_order_success():
    """Test: claim order transitions status to developing."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(200, {
        "claimed": True,
        "order_id": 1,
        "order_code": "GH-TEST-001",
        "agent_code": "PY-A04",
        "previous_status": "pending",
        "new_status": "developing",
        "message": "Order claimed successfully",
    }))
    client._client = mock_client

    result = await client.claim_order(1, "PY-A04")
    assert result["claimed"] is True
    assert result["new_status"] == "developing"
    assert result["order_code"] == "GH-TEST-001"


@pytest.mark.asyncio
async def test_claim_order_conflict():
    """Test: claim already-claimed order raises error with 409."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(
        409, {"detail": "Order status is 'developing', not 'pending'"}
    ))
    client._client = mock_client

    with pytest.raises(APIClientError) as exc_info:
        await client.claim_order(1)
    assert exc_info.value.status_code == 409


# ===========================================================================
# Test 4: Status Transition Flow (E2E)
# ===========================================================================

@pytest.mark.asyncio
async def test_status_transition_e2e():
    """Test: full status flow pending->developing->self_check->awaiting_review."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    call_count = 0
    transitions = [
        "developing", "self_check", "awaiting_review",
    ]

    async def mock_request(method, path, **kwargs):
        nonlocal call_count
        if method == "PATCH" and "/status" in path:
            body = kwargs.get("json", {})
            idx = min(call_count, len(transitions) - 1)
            prev = "pending" if call_count == 0 else transitions[call_count - 1]
            call_count += 1
            return MockResponse(200, {
                "updated": True,
                "order_id": 1,
                "order_code": "GH-TEST-001",
                "previous_status": prev,
                "new_status": body.get("status", transitions[idx]),
                "message": "Status updated",
            })
        return MockResponse(200, {})

    mock_client = AsyncMock()
    mock_client.request = mock_request
    client._client = mock_client

    # Transition: developing
    r1 = await client.update_order_status(1, "developing")
    assert r1["new_status"] == "developing"

    # Transition: self_check
    r2 = await client.update_order_status(1, "self_check")
    assert r2["new_status"] == "self_check"

    # Transition: awaiting_review with self_check_result
    r3 = await client.update_order_status(
        1, "awaiting_review", self_check_result="8/8 PASSED",
    )
    assert r3["new_status"] == "awaiting_review"
    assert call_count == 3


# ===========================================================================
# Test 5: Execution Log Writing
# ===========================================================================

@pytest.mark.asyncio
async def test_write_execution_log():
    """Test: write execution log via API."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(200, {
        "logged": True, "order_id": 1, "log_id": 42, "message": "Log written",
    }))
    client._client = mock_client

    result = await client.write_execution_log(1, "PY-A04", {
        "step": "step_2_develop",
        "message": "Code generated and pushed",
        "files_count": 5,
    })
    assert result["logged"] is True
    assert result["log_id"] == 42


# ===========================================================================
# Test 6: Hybrid Fallback (API down -> DB)
# ===========================================================================

@pytest.mark.asyncio
async def test_hybrid_fallback_to_db():
    """Test: HybridOrderSource falls back to DB when API is unreachable."""
    api_client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(
        side_effect=Exception("Connection refused")
    )
    api_client._client = mock_client
    api_client.max_retries = 1
    api_client.retry_delay_seconds = 0.01

    # Mock DB fallback
    db_mock = AsyncMock()
    db_mock.fetch_pending_orders = AsyncMock(return_value=[make_order(99)])

    hybrid = HybridOrderSource(api_client=api_client, db_fallback=db_mock)

    result = await hybrid.fetch_pending_orders("PY-A04")
    assert len(result) == 1
    assert result[0]["id"] == 99
    assert hybrid._api_healthy is False
    db_mock.fetch_pending_orders.assert_called_once_with("PY-A04")


# ===========================================================================
# Test 7: Auth Error (no retry)
# ===========================================================================

@pytest.mark.asyncio
async def test_auth_error_no_retry():
    """Test: 401/403 errors are NOT retried."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="bad-key",
        max_retries=3,
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(
        401, {"detail": "Invalid API key"}
    ))
    client._client = mock_client

    with pytest.raises(APIClientAuthError):
        await client.fetch_pending_orders("PY-A04")

    # Should only be called once (no retry on auth errors)
    assert mock_client.request.call_count == 1


# ===========================================================================
# Test 8: Connection Retry with Backoff
# ===========================================================================

@pytest.mark.asyncio
async def test_connection_retry_then_success():
    """Test: connection fails twice, succeeds on third attempt."""
    client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
        max_retries=3,
        retry_delay_seconds=0.01,
    )
    call_count = 0

    async def mock_request(method, path, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise Exception("Connection timeout")
        return MockResponse(200, {
            "status": "ok", "db_connected": True,
        })

    mock_client = AsyncMock()
    mock_client.request = mock_request
    client._client = mock_client

    result = await client.health_check()
    assert result["status"] == "ok"
    assert call_count == 3


# ===========================================================================
# Test 9: Hybrid Recovery
# ===========================================================================

@pytest.mark.asyncio
async def test_hybrid_api_recovery():
    """Test: HybridOrderSource recovers when API comes back online."""
    api_client = WorkOrderAPIClient(
        base_url="http://localhost:8001",
        api_key="test-key",
    )
    mock_client = AsyncMock()
    mock_client.request = AsyncMock(return_value=MockResponse(
        200, {"status": "ok", "db_connected": True}
    ))
    api_client._client = mock_client

    hybrid = HybridOrderSource(api_client=api_client, db_fallback=None)
    hybrid._api_healthy = False  # Simulate previous failure

    recovered = await hybrid.recover_api()
    assert recovered is True
    assert hybrid._api_healthy is True


# ===========================================================================
# Test 10: Config loads API settings
# ===========================================================================

def test_config_api_settings():
    """Test: config correctly loads API client settings."""
    config = load_config()
    assert hasattr(config, "api")
    assert config.api.base_url != ""
    assert config.api.timeout_seconds > 0
    assert config.api.max_retries >= 1
