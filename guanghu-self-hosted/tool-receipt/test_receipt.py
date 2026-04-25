"""Test suite for Tool Receipt System
PY-A04-20260425-002

Tests cover the full lifecycle: create -> update -> query
Uses SQLite backend for local testing (no PostgreSQL required).

Run: python -m pytest test_receipt.py -v
"""
from __future__ import annotations

import json
import os
import tempfile

import pytest

# Force SQLite mode before importing anything else
os.environ["RECEIPT_USE_SQLITE"] = "true"

from receipt_manager import Receipt, ReceiptStatus, SqliteReceiptManager
from receipt_formatter import ReceiptFormatter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def manager(tmp_path):
    """Create a fresh SqliteReceiptManager per test."""
    db_path = str(tmp_path / "test_receipts.db")
    mgr = SqliteReceiptManager(db_path=db_path)
    mgr.connect()
    yield mgr
    mgr.close()


@pytest.fixture
def formatter():
    return ReceiptFormatter()


# ---------------------------------------------------------------------------
# 1. record_call creates a pending receipt
# ---------------------------------------------------------------------------


def test_record_call_returns_uuid(manager: SqliteReceiptManager):
    """record_call should return a valid UUID string."""
    rid = manager.record_call(
        tool_name="test_tool",
        input_params={"key": "value"},
        session_id="sess-001",
        persona_id="persona-001",
    )
    assert isinstance(rid, str)
    assert len(rid) == 36  # UUID format: 8-4-4-4-12


def test_record_call_creates_pending_receipt(manager: SqliteReceiptManager):
    """Newly created receipt should have status=pending and no output."""
    rid = manager.record_call(
        tool_name="search_web",
        input_params={"query": "hello"},
        session_id="sess-002",
        persona_id="persona-002",
    )
    receipt = manager.get_receipt(rid)
    assert receipt is not None
    assert receipt.status == ReceiptStatus.PENDING
    assert receipt.output is None
    assert receipt.duration_ms is None
    assert receipt.tool_name == "search_web"
    assert receipt.input_params == {"query": "hello"}


# ---------------------------------------------------------------------------
# 2. update_result sets output, status, duration
# ---------------------------------------------------------------------------


def test_update_result_success(manager: SqliteReceiptManager):
    """update_result should transition receipt to success with output."""
    rid = manager.record_call(
        tool_name="calc",
        input_params={"expr": "1+1"},
        session_id="sess-003",
        persona_id="p-003",
    )
    updated = manager.update_result(
        receipt_id=rid,
        output={"result": 2},
        status=ReceiptStatus.SUCCESS,
        duration_ms=42,
    )
    assert updated is not None
    assert updated.status == ReceiptStatus.SUCCESS
    assert updated.output == {"result": 2}
    assert updated.duration_ms == 42


def test_update_result_error(manager: SqliteReceiptManager):
    """update_result should handle error status."""
    rid = manager.record_call(
        tool_name="failing_tool",
        input_params={},
        session_id="sess-004",
        persona_id="p-004",
    )
    updated = manager.update_result(
        receipt_id=rid,
        output={"error": "connection refused"},
        status=ReceiptStatus.ERROR,
        duration_ms=5000,
    )
    assert updated is not None
    assert updated.status == ReceiptStatus.ERROR
    assert updated.output["error"] == "connection refused"


def test_update_result_timeout(manager: SqliteReceiptManager):
    """update_result should handle timeout status."""
    rid = manager.record_call(
        tool_name="slow_tool",
        input_params={"wait": 999},
        session_id="sess-005",
        persona_id="p-005",
    )
    updated = manager.update_result(
        receipt_id=rid,
        output=None,
        status=ReceiptStatus.TIMEOUT,
        duration_ms=30000,
    )
    assert updated is not None
    assert updated.status == ReceiptStatus.TIMEOUT
    assert updated.output is None


# ---------------------------------------------------------------------------
# 3. get_receipt returns None for non-existent ID
# ---------------------------------------------------------------------------


def test_get_receipt_not_found(manager: SqliteReceiptManager):
    """get_receipt with unknown ID should return None."""
    result = manager.get_receipt("00000000-0000-0000-0000-000000000000")
    assert result is None


# ---------------------------------------------------------------------------
# 4. get_session_receipts returns ordered list
# ---------------------------------------------------------------------------


def test_get_session_receipts(manager: SqliteReceiptManager):
    """get_session_receipts should return all receipts for that session."""
    sid = "sess-batch"
    r1 = manager.record_call("tool_a", {"a": 1}, sid, "p-b")
    r2 = manager.record_call("tool_b", {"b": 2}, sid, "p-b")
    r3 = manager.record_call("tool_c", {"c": 3}, sid, "p-b")
    # also create one in a different session
    manager.record_call("tool_x", {}, "other-sess", "p-x")

    receipts = manager.get_session_receipts(sid)
    assert len(receipts) == 3
    assert receipts[0].receipt_id == r1
    assert receipts[1].receipt_id == r2
    assert receipts[2].receipt_id == r3


# ---------------------------------------------------------------------------
# 5. Formatter: to_text produces readable string
# ---------------------------------------------------------------------------


def test_formatter_to_text(manager: SqliteReceiptManager, formatter: ReceiptFormatter):
    """to_text should include key fields in human-readable format."""
    rid = manager.record_call("my_tool", {"x": 42}, "s1", "p1")
    receipt = manager.get_receipt(rid)
    text = formatter.to_text(receipt)
    assert "Tool Receipt" in text
    assert "my_tool" in text
    assert "pending" in text
    assert '"x": 42' in text or '"x":42' in text


# ---------------------------------------------------------------------------
# 6. Formatter: to_hldp produces HLDP tree
# ---------------------------------------------------------------------------


def test_formatter_to_hldp(manager: SqliteReceiptManager, formatter: ReceiptFormatter):
    """to_hldp should produce an HLDP:// prefixed tree structure."""
    rid = manager.record_call("hldp_tool", {"k": "v"}, "s2", "p2")
    manager.update_result(rid, {"ok": True}, ReceiptStatus.SUCCESS, 100)
    receipt = manager.get_receipt(rid)
    hldp = formatter.to_hldp(receipt)
    assert hldp.startswith("HLDP://tool-receipt/")
    assert "hldp_tool" in hldp
    assert "success" in hldp
    assert "100ms" in hldp


# ---------------------------------------------------------------------------
# 7. Formatter: to_json produces valid JSON
# ---------------------------------------------------------------------------


def test_formatter_to_json(manager: SqliteReceiptManager, formatter: ReceiptFormatter):
    """to_json should produce parseable JSON with all fields."""
    rid = manager.record_call("json_tool", {"n": 1}, "s3", "p3")
    receipt = manager.get_receipt(rid)
    raw = formatter.to_json(receipt)
    parsed = json.loads(raw)
    assert parsed["tool_name"] == "json_tool"
    assert parsed["status"] == "pending"


# ---------------------------------------------------------------------------
# 8. Full lifecycle: create -> update -> query -> format
# ---------------------------------------------------------------------------


def test_full_lifecycle(manager: SqliteReceiptManager, formatter: ReceiptFormatter):
    """End-to-end: create receipt, update, query, and format."""
    # create
    rid = manager.record_call(
        tool_name="lifecycle_tool",
        input_params={"action": "test", "count": 5},
        session_id="lifecycle-sess",
        persona_id="lifecycle-persona",
    )
    r1 = manager.get_receipt(rid)
    assert r1.status == ReceiptStatus.PENDING

    # update
    r2 = manager.update_result(
        receipt_id=rid,
        output={"processed": 5, "errors": 0},
        status=ReceiptStatus.SUCCESS,
        duration_ms=250,
    )
    assert r2.status == ReceiptStatus.SUCCESS
    assert r2.duration_ms == 250

    # query session
    session_list = manager.get_session_receipts("lifecycle-sess")
    assert len(session_list) == 1
    assert session_list[0].receipt_id == rid

    # format text
    text = formatter.to_text(r2)
    assert "lifecycle_tool" in text
    assert "250 ms" in text

    # format hldp
    hldp = formatter.to_hldp(r2)
    assert "250ms" in hldp
    assert "success" in hldp

    # format json
    j = json.loads(formatter.to_json(r2))
    assert j["duration_ms"] == 250


# ---------------------------------------------------------------------------
# 9. Session summary formatters
# ---------------------------------------------------------------------------


def test_session_summary(manager: SqliteReceiptManager, formatter: ReceiptFormatter):
    """session_summary_text and session_summary_hldp should work."""
    sid = "summary-sess"
    r1 = manager.record_call("tool_1", {}, sid, "p")
    r2 = manager.record_call("tool_2", {}, sid, "p")
    manager.update_result(r1, {"ok": True}, ReceiptStatus.SUCCESS, 10)
    manager.update_result(r2, None, ReceiptStatus.TIMEOUT, 30000)

    receipts = manager.get_session_receipts(sid)
    text = formatter.session_summary_text(receipts)
    assert "Total calls: 2" in text
    assert "tool_1" in text
    assert "tool_2" in text

    hldp = formatter.session_summary_hldp(receipts)
    assert hldp.startswith("HLDP://tool-receipt/session/")
    assert "total: 2" in hldp
