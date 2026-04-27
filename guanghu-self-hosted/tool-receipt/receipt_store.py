# -*- coding: utf-8 -*-
"""回执存储 v2 · Receipt Store

提供回执的持久化存储。
SQLite 作为本地开发/测试后端，PostgreSQL 作为生产后端。
"""
import os
import json
import sqlite3
import logging
from datetime import datetime, timezone
from typing import List, Optional
from .receipt_formatter import ToolReceipt

logger = logging.getLogger("guanghu.receipt.store")


class SqliteReceiptStore:
    """本地 SQLite 回执存储"""
    
    def __init__(self, db_path: str = ""):
        self.db_path = db_path or os.getenv("RECEIPT_DB_PATH", "./receipts.db")
        self._conn = None
        self._ensure_table()
    
    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
            self._conn.row_factory = sqlite3.Row
        return self._conn
    
    def _ensure_table(self):
        conn = self._get_conn()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool_name TEXT NOT NULL,
                input_summary TEXT,
                output_summary TEXT,
                status TEXT NOT NULL DEFAULT 'success',
                timestamp TEXT NOT NULL,
                duration_ms INTEGER DEFAULT 0,
                agent_id TEXT DEFAULT '',
                session_id TEXT DEFAULT '',
                error_detail TEXT DEFAULT '',
                metadata_json TEXT DEFAULT '{}',
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_receipts_session ON receipts(session_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_receipts_agent ON receipts(agent_id)")
        conn.commit()
    
    def save(self, receipt: ToolReceipt) -> int:
        """保存回执，返回 ID"""
        conn = self._get_conn()
        cursor = conn.execute(
            "INSERT INTO receipts (tool_name, input_summary, output_summary, status, timestamp, duration_ms, agent_id, session_id, error_detail, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                receipt.tool_name,
                receipt.input_summary,
                receipt.output_summary,
                receipt.status,
                receipt.timestamp,
                receipt.duration_ms,
                receipt.agent_id,
                receipt.session_id,
                receipt.error_detail,
                json.dumps(receipt.metadata or {}, ensure_ascii=False),
            )
        )
        conn.commit()
        return cursor.lastrowid
    
    def get_by_session(self, session_id: str) -> List[ToolReceipt]:
        """按会话获取回执"""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM receipts WHERE session_id = ? ORDER BY id",
            (session_id,)
        ).fetchall()
        return [self._row_to_receipt(row) for row in rows]
    
    def get_by_agent(self, agent_id: str, limit: int = 50) -> List[ToolReceipt]:
        """按 Agent 获取回执"""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM receipts WHERE agent_id = ? ORDER BY id DESC LIMIT ?",
            (agent_id, limit)
        ).fetchall()
        return [self._row_to_receipt(row) for row in rows]
    
    def _row_to_receipt(self, row) -> ToolReceipt:
        return ToolReceipt(
            tool_name=row["tool_name"],
            input_summary=row["input_summary"] or "",
            output_summary=row["output_summary"] or "",
            status=row["status"],
            timestamp=row["timestamp"],
            duration_ms=row["duration_ms"] or 0,
            agent_id=row["agent_id"] or "",
            session_id=row["session_id"] or "",
            error_detail=row["error_detail"] or "",
            metadata=json.loads(row["metadata_json"] or "{}"),
        )
    
    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None
