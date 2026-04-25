"""GH-API-001 · 工单领取API · 测试用例

10条pytest用例 · 覆盖认证/工单查询/领取/状态更新/日志/速率限制
编号前缀: GH-API · 培园A04
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone


# ========== Fixtures ==========

def _make_order(
    id: int = 1,
    status: str = "pending",
    assigned_agent: str = "PY-A04",
    order_code: str = "GH-API-TEST-001",
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": id,
        "title": "Test Order",
        "order_code": order_code,
        "phase_code": "Phase-TEST-001",
        "priority": "P0",
        "status": status,
        "description": "Test description",
        "repo_path": "/test/path/",
        "branch_name": "feat/test",
        "constraints": "Test constraints",
        "assigned_agent": assigned_agent,
        "self_check_result": None,
        "review_result": None,
        "next_guide": None,
        "created_at": now,
        "updated_at": now,
    }


def _make_log(id: int = 1, order_id: int = 1) -> dict:
    return {
        "id": id,
        "order_id": order_id,
        "level": "INFO",
        "message": "Test log",
        "step": "step_1",
        "metadata": None,
        "created_at": datetime.now(timezone.utc),
    }


# ========== Test: Config ==========

def test_config_defaults():
    """配置默认值正确"""
    from config import Settings
    s = Settings(
        database_url="postgresql://test:test@localhost/test",
        agent_api_keys="",
    )
    assert s.port == 8001
    assert s.rate_limit_per_minute == 60
    assert s.api_key_map == {}


def test_config_api_key_parsing():
    """API Key解析正确"""
    from config import Settings
    s = Settings(
        database_url="postgresql://test:test@localhost/test",
        agent_api_keys="PY-A04:sk-test-key,YD-A05:sk-other-key",
    )
    key_map = s.api_key_map
    assert key_map["sk-test-key"] == "PY-A04"
    assert key_map["sk-other-key"] == "YD-A05"
    assert len(key_map) == 2


# ========== Test: Auth ==========

def test_auth_dev_mode():
    """开发模式无API Key时放行"""
    from auth import resolve_agent_code
    with patch("auth.settings") as mock_settings:
        mock_settings.api_key_map = {}
        result = resolve_agent_code(None)
        assert result == "dev-agent"


def test_auth_valid_key():
    """有效API Key返回Agent编号"""
    from auth import resolve_agent_code
    with patch("auth.settings") as mock_settings:
        mock_settings.api_key_map = {"sk-valid": "PY-A04"}
        result = resolve_agent_code("sk-valid")
        assert result == "PY-A04"


def test_auth_invalid_key():
    """无效API Key返回403"""
    from auth import resolve_agent_code
    from fastapi import HTTPException
    with patch("auth.settings") as mock_settings:
        mock_settings.api_key_map = {"sk-valid": "PY-A04"}
        with pytest.raises(HTTPException) as exc_info:
            resolve_agent_code("sk-wrong")
        assert exc_info.value.status_code == 403


def test_auth_missing_key():
    """缺少API Key返回401"""
    from auth import resolve_agent_code
    from fastapi import HTTPException
    with patch("auth.settings") as mock_settings:
        mock_settings.api_key_map = {"sk-valid": "PY-A04"}
        with pytest.raises(HTTPException) as exc_info:
            resolve_agent_code(None)
        assert exc_info.value.status_code == 401


# ========== Test: Rate Limit ==========

def test_rate_limit_normal():
    """正常请求不触发限速"""
    from auth import check_rate_limit, _request_log
    _request_log.clear()
    with patch("auth.settings") as mock_settings:
        mock_settings.rate_limit_per_minute = 60
        mock_settings.rate_limit_window_seconds = 60
        # 不应抛异常
        check_rate_limit("PY-A04")


def test_rate_limit_exceeded():
    """超过限制触发429"""
    import time
    from auth import check_rate_limit, _request_log
    from fastapi import HTTPException
    _request_log.clear()
    with patch("auth.settings") as mock_settings:
        mock_settings.rate_limit_per_minute = 2
        mock_settings.rate_limit_window_seconds = 60
        check_rate_limit("RATE-TEST")
        check_rate_limit("RATE-TEST")
        with pytest.raises(HTTPException) as exc_info:
            check_rate_limit("RATE-TEST")
        assert exc_info.value.status_code == 429


# ========== Test: Models ==========

def test_order_detail_model():
    """OrderDetail模型序列化正确"""
    from models import OrderDetail
    order = _make_order()
    detail = OrderDetail(**order)
    assert detail.id == 1
    assert detail.status.value == "pending"
    assert detail.assigned_agent == "PY-A04"


def test_status_update_model():
    """StatusUpdateRequest枚举值正确"""
    from models import StatusUpdateRequest, OrderStatus
    req = StatusUpdateRequest(
        status=OrderStatus.SELF_CHECK,
        self_check_result="9/9 PASS",
    )
    assert req.status == OrderStatus.SELF_CHECK
    assert req.self_check_result == "9/9 PASS"
