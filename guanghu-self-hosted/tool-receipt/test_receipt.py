"""Test Suite for Tool Receipt System
PY-A04-20260425-002

Uses SQLite backend for local testing (no PostgreSQL required).
Covers: create -> update -> query complete flow.

Run:  python -m pytest test_receipt.py -v
  or: python test_receipt.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

# Ensure module directory is on the path
sys.path.insert(0, os.path.dirname(__file__))

from receipt_manager import Receipt, ReceiptStatus, SqliteReceiptManager
from receipt_formatter import ReceiptFormatter


class TestSqliteReceiptManager(unittest.TestCase):
    """Test receipt CRUD operations with SQLite backend."""

    def setUp(self) -> None:
        self._tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self._tmp.close()
        self.mgr = SqliteReceiptManager(db_path=self._tmp.name)
        self.mgr.connect()

    def tearDown(self) -> None:
        self.mgr.close()
        os.unlink(self._tmp.name)

    # ---- record_call ----

    def test_record_call_returns_uuid(self) -> None:
        rid = self.mgr.record_call(
            tool_name="search",
            input_params={"query": "hello"},
            session_id="sess-001",
            persona_id="AG-SY-01",
        )
        self.assertIsInstance(rid, str)
        self.assertEqual(len(rid), 36)  # UUID format

    def test_record_call_creates_pending_receipt(self) -> None:
        rid = self.mgr.record_call(
            tool_name="search",
            input_params={"query": "hello"},
            session_id="sess-001",
            persona_id="AG-SY-01",
        )
        receipt = self.mgr.get_receipt(rid)
        self.assertIsNotNone(receipt)
        self.assertEqual(receipt.status, ReceiptStatus.PENDING)
        self.assertEqual(receipt.tool_name, "search")
        self.assertEqual(receipt.input_params, {"query": "hello"})
        self.assertIsNone(receipt.output)
        self.assertIsNone(receipt.duration_ms)

    # ---- update_result ----

    def test_update_result_success(self) -> None:
        rid = self.mgr.record_call(
            tool_name="web_fetch",
            input_params={"url": "https://example.com"},
            session_id="sess-002",
            persona_id="AG-SY-01",
        )
        receipt = self.mgr.update_result(
            receipt_id=rid,
            output={"html": "<h1>Hello</h1>"},
            status=ReceiptStatus.SUCCESS,
            duration_ms=150,
        )
        self.assertIsNotNone(receipt)
        self.assertEqual(receipt.status, ReceiptStatus.SUCCESS)
        self.assertEqual(receipt.output, {"html": "<h1>Hello</h1>"})
        self.assertEqual(receipt.duration_ms, 150)

    def test_update_result_error(self) -> None:
        rid = self.mgr.record_call(
            tool_name="db_query",
            input_params={"sql": "SELECT 1"},
            session_id="sess-003",
            persona_id="AG-ZY-01",
        )
        receipt = self.mgr.update_result(
            receipt_id=rid,
            output={"error": "connection refused"},
            status=ReceiptStatus.ERROR,
            duration_ms=30,
        )
        self.assertEqual(receipt.status, ReceiptStatus.ERROR)

    def test_update_result_timeout(self) -> None:
        rid = self.mgr.record_call(
            tool_name="slow_api",
            input_params={},
            session_id="sess-004",
            persona_id="AG-SY-01",
        )
        receipt = self.mgr.update_result(
            receipt_id=rid,
            output=None,
            status=ReceiptStatus.TIMEOUT,
            duration_ms=30000,
        )
        self.assertEqual(receipt.status, ReceiptStatus.TIMEOUT)
        self.assertIsNone(receipt.output)

    def test_update_nonexistent_returns_none(self) -> None:
        receipt = self.mgr.update_result(
            receipt_id="00000000-0000-0000-0000-000000000000",
            output=None,
            status=ReceiptStatus.ERROR,
        )
        self.assertIsNone(receipt)

    # ---- get_receipt ----

    def test_get_nonexistent_returns_none(self) -> None:
        receipt = self.mgr.get_receipt("00000000-0000-0000-0000-000000000000")
        self.assertIsNone(receipt)

    # ---- get_session_receipts ----

    def test_get_session_receipts(self) -> None:
        sid = "sess-batch-001"
        self.mgr.record_call("tool_a", {"k": 1}, session_id=sid, persona_id="P1")
        self.mgr.record_call("tool_b", {"k": 2}, session_id=sid, persona_id="P1")
        self.mgr.record_call("tool_c", {"k": 3}, session_id=sid, persona_id="P1")
        # Different session - should not appear
        self.mgr.record_call("tool_d", {"k": 4}, session_id="other", persona_id="P1")

        receipts = self.mgr.get_session_receipts(sid)
        self.assertEqual(len(receipts), 3)
        self.assertEqual(receipts[0].tool_name, "tool_a")
        self.assertEqual(receipts[2].tool_name, "tool_c")

    def test_get_session_receipts_empty(self) -> None:
        receipts = self.mgr.get_session_receipts("nonexistent-session")
        self.assertEqual(receipts, [])

    # ---- full flow: create -> update -> query ----

    def test_full_flow(self) -> None:
        """End-to-end: record_call -> update_result -> get_session_receipts."""
        sid = "sess-full-001"
        pid = "AG-SY-01"

        # Step 1: record call
        rid = self.mgr.record_call("notion_search", {"query": "HLDP"}, sid, pid)
        r = self.mgr.get_receipt(rid)
        self.assertEqual(r.status, ReceiptStatus.PENDING)

        # Step 2: update with success
        r = self.mgr.update_result(
            rid,
            output={"results": ["page-1", "page-2"]},
            status=ReceiptStatus.SUCCESS,
            duration_ms=85,
        )
        self.assertEqual(r.status, ReceiptStatus.SUCCESS)
        self.assertEqual(r.duration_ms, 85)

        # Step 3: query session
        receipts = self.mgr.get_session_receipts(sid)
        self.assertEqual(len(receipts), 1)
        self.assertEqual(receipts[0].receipt_id, rid)

    def test_chinese_content(self) -> None:
        """Verify UTF-8 handling with Chinese characters."""
        rid = self.mgr.record_call(
            tool_name="notion_search",
            input_params={"query": "\u5149\u4e4b\u6e56\u67b6\u6784"},
            session_id="sess-zh-001",
            persona_id="AG-SY-01",
        )
        receipt = self.mgr.update_result(
            receipt_id=rid,
            output={"title": "\u5149\u6e56\u81ea\u7814\u7cfb\u7edf\u67b6\u6784"},
            status=ReceiptStatus.SUCCESS,
            duration_ms=42,
        )
        self.assertIn("\u5149\u4e4b\u6e56", receipt.input_params["query"])
        self.assertIn("\u5149\u6e56", receipt.output["title"])


class TestReceiptFormatter(unittest.TestCase):
    """Test formatter output formats."""

    def _make_receipt(self, **overrides) -> Receipt:
        defaults = dict(
            receipt_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            session_id="sess-fmt-001",
            persona_id="AG-SY-01",
            tool_name="web_search",
            input_params={"query": "test"},
            output={"results": ["item1"]},
            status=ReceiptStatus.SUCCESS,
            created_at="2026-04-25T12:00:00+00:00",
            updated_at="2026-04-25T12:00:01+00:00",
            duration_ms=200,
        )
        defaults.update(overrides)
        return Receipt(**defaults)

    def test_to_json_valid(self) -> None:
        r = self._make_receipt()
        j = ReceiptFormatter.to_json(r)
        data = json.loads(j)
        self.assertEqual(data["tool_name"], "web_search")
        self.assertEqual(data["status"], "success")

    def test_to_json_compact(self) -> None:
        r = self._make_receipt()
        j = ReceiptFormatter.to_json_compact(r)
        self.assertNotIn("\n", j)
        data = json.loads(j)
        self.assertEqual(data["receipt_id"], r.receipt_id)

    def test_to_text_contains_fields(self) -> None:
        r = self._make_receipt()
        text = ReceiptFormatter.to_text(r)
        self.assertIn("web_search", text)
        self.assertIn("SUCCESS", text)
        self.assertIn("200ms", text)
        self.assertIn("a1b2c3d4", text)

    def test_to_text_pending_icon(self) -> None:
        r = self._make_receipt(
            status=ReceiptStatus.PENDING, output=None, duration_ms=None
        )
        text = ReceiptFormatter.to_text(r)
        self.assertTrue(text.startswith("\u23f3"))

    def test_to_hldp_format(self) -> None:
        r = self._make_receipt()
        hldp = ReceiptFormatter.to_hldp(r)
        self.assertIn("HLDP://tool-receipt/", hldp)
        self.assertIn("tool: web_search", hldp)
        self.assertIn("success", hldp)

    def test_session_summary_empty(self) -> None:
        text = ReceiptFormatter.session_summary("empty-sess", [])
        self.assertIn("no receipts", text)

    def test_session_summary_with_receipts(self) -> None:
        receipts = [
            self._make_receipt(
                tool_name="tool_a",
                status=ReceiptStatus.SUCCESS,
                duration_ms=100,
            ),
            self._make_receipt(
                tool_name="tool_b",
                status=ReceiptStatus.ERROR,
                duration_ms=50,
            ),
            self._make_receipt(
                tool_name="tool_c",
                status=ReceiptStatus.SUCCESS,
                duration_ms=200,
            ),
        ]
        text = ReceiptFormatter.session_summary("sess-sum", receipts)
        self.assertIn("Total calls: 3", text)
        self.assertIn("success: 2", text)
        self.assertIn("error: 1", text)
        self.assertIn("tool_a", text)


if __name__ == "__main__":
    unittest.main()
