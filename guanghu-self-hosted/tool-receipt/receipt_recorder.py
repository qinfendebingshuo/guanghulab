"""receipt_recorder.py — 回执记录器

Phase-0-007 · YD-A05-20260425-005

职责:
    · 记录每次工具调用: tool_name / input / output / status / timestamp / duration
    · 异步写入 PostgreSQL · 不阻塞主流程
    · 支持批量记录 + 单条记录
    · record_receipt() 公开接口

与 Phase-0-006 Boot Protocol 兼容:
    · ReceiptRecord 可嵌入 StepResult.data 字典中
    · ReceiptRecorder 可作为 boot handler 的一部分使用
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from .receipt_store import ReceiptRecord, ReceiptStore

logger = logging.getLogger("tool_receipt.recorder")


class ReceiptRecorder:
    """工具回执异步记录器。

    特性:
        · 异步写入 PostgreSQL，不阻塞主流程
        · 支持单条和批量记录
        · 支持 fire-and-forget 模式（后台写入）
        · 可作为上下文管理器使用，自动管理连接池
    """

    def __init__(
        self,
        store: ReceiptStore | None = None,
        dsn: str | None = None,
        fire_and_forget: bool = True,
    ) -> None:
        """初始化记录器。

        Args:
            store: 外部传入的 ReceiptStore（可选）。
            dsn: PostgreSQL DSN（store 为 None 时使用）。
            fire_and_forget: True 时写入操作不等待完成（默认）。
        """
        self._store = store or ReceiptStore(dsn=dsn)
        self._fire_and_forget = fire_and_forget
        self._background_tasks: set[asyncio.Task[Any]] = set()
        self._connected = False

    async def connect(self) -> None:
        """连接到数据库。"""
        if not self._connected:
            await self._store.connect()
            self._connected = True

    async def close(self) -> None:
        """关闭连接并等待所有后台写入完成。"""
        # 等待所有后台写入任务完成
        if self._background_tasks:
            logger.info("等待 %d 个后台写入任务完成...", len(self._background_tasks))
            await asyncio.gather(*self._background_tasks, return_exceptions=True)
            self._background_tasks.clear()
        await self._store.close()
        self._connected = False

    @asynccontextmanager
    async def session(self) -> AsyncIterator[ReceiptRecorder]:
        """上下文管理器: 自动连接和关闭。

        用法::
            async with ReceiptRecorder().session() as recorder:
                await recorder.record(...)
        """
        await self.connect()
        try:
            yield self
        finally:
            await self.close()

    # ── 核心记录接口 ──────────────────────────────────────

    async def record(
        self,
        session_id: str,
        persona_id: str,
        tool_name: str,
        input_params: dict[str, Any],
        output_result: dict[str, Any],
        status: str,
        error_message: str | None = None,
        duration_ms: int = 0,
        timestamp: datetime | None = None,
    ) -> ReceiptRecord:
        """记录单条工具调用回执。

        Args:
            session_id: 对话会话 ID。
            persona_id: 执行人格体编号（如 AG-SY-01）。
            tool_name: 工具名称。
            input_params: 工具输入参数。
            output_result: 工具输出结果。
            status: 状态（success / failure / timeout）。
            error_message: 失败时的错误信息。
            duration_ms: 调用耗时（毫秒）。
            timestamp: 时间戳（默认当前 UTC 时间）。

        Returns:
            创建的 ReceiptRecord。
        """
        record = ReceiptRecord(
            session_id=session_id,
            persona_id=persona_id,
            tool_name=tool_name,
            input_params=input_params,
            output_result=output_result,
            status=status,
            error_message=error_message,
            timestamp=timestamp or datetime.now(timezone.utc),
            duration_ms=duration_ms,
        )
        await self._write(record)
        return record

    async def record_batch(
        self, records: list[ReceiptRecord]
    ) -> list[ReceiptRecord]:
        """批量记录回执。"""
        await self._write_batch(records)
        return records

    # ── 计时上下文管理器 ──────────────────────────────────

    @asynccontextmanager
    async def timed_call(
        self,
        session_id: str,
        persona_id: str,
        tool_name: str,
        input_params: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """自动计时的工具调用记录器。

        用法::
            async with recorder.timed_call(
                session_id="s1", persona_id="AG-SY-01",
                tool_name="search", input_params={"q": "test"}
            ) as result_container:
                # 执行工具调用...
                result_container["output"] = {"data": "..."}
                result_container["status"] = "success"
        """
        container: dict[str, Any] = {
            "output": {},
            "status": "success",
            "error": None,
        }
        start_ns = time.perf_counter_ns()
        try:
            yield container
        except Exception as exc:
            container["status"] = "failure"
            container["error"] = str(exc)
            raise
        finally:
            elapsed_ms = (time.perf_counter_ns() - start_ns) // 1_000_000
            await self.record(
                session_id=session_id,
                persona_id=persona_id,
                tool_name=tool_name,
                input_params=input_params,
                output_result=container.get("output", {}),
                status=container.get("status", "failure"),
                error_message=container.get("error"),
                duration_ms=elapsed_ms,
            )

    # ── 内部写入 ──────────────────────────────────────────

    async def _write(self, record: ReceiptRecord) -> None:
        """写入单条记录（可 fire-and-forget）。"""
        if not self._connected:
            await self.connect()

        if self._fire_and_forget:
            task = asyncio.create_task(self._safe_insert(record))
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)
        else:
            await self._store.insert(record)

    async def _write_batch(self, records: list[ReceiptRecord]) -> None:
        """批量写入（可 fire-and-forget）。"""
        if not self._connected:
            await self.connect()

        if self._fire_and_forget:
            task = asyncio.create_task(self._safe_insert_batch(records))
            self._background_tasks.add(task)
            task.add_done_callback(self._background_tasks.discard)
        else:
            await self._store.insert_batch(records)

    async def _safe_insert(self, record: ReceiptRecord) -> None:
        """安全写入（捕获异常，不抛出）。"""
        try:
            await self._store.insert(record)
        except Exception as exc:
            logger.error("后台写入回执失败: %s — %s", record.tool_name, exc)

    async def _safe_insert_batch(self, records: list[ReceiptRecord]) -> None:
        """安全批量写入（捕获异常，不抛出）。"""
        try:
            await self._store.insert_batch(records)
        except Exception as exc:
            logger.error("后台批量写入回执失败: %d 条 — %s", len(records), exc)


# ── 模块级便捷函数（公开接口） ────────────────────────────

_default_recorder: ReceiptRecorder | None = None


def _get_default_recorder() -> ReceiptRecorder:
    """获取或创建默认记录器单例。"""
    global _default_recorder
    if _default_recorder is None:
        _default_recorder = ReceiptRecorder(fire_and_forget=True)
    return _default_recorder


async def record_receipt(
    session_id: str,
    persona_id: str,
    tool_name: str,
    input_params: dict[str, Any],
    output_result: dict[str, Any],
    status: str,
    error_message: str | None = None,
    duration_ms: int = 0,
    timestamp: datetime | None = None,
) -> ReceiptRecord:
    """模块级公开接口: 记录单条工具回执。

    首次调用时自动创建连接。
    """
    recorder = _get_default_recorder()
    return await recorder.record(
        session_id=session_id,
        persona_id=persona_id,
        tool_name=tool_name,
        input_params=input_params,
        output_result=output_result,
        status=status,
        error_message=error_message,
        duration_ms=duration_ms,
        timestamp=timestamp,
    )


async def record_receipts(records: list[ReceiptRecord]) -> list[ReceiptRecord]:
    """模块级公开接口: 批量记录工具回执。"""
    recorder = _get_default_recorder()
    return await recorder.record_batch(records)
