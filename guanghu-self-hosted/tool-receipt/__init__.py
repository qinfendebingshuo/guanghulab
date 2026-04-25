"""tool_receipt — 工具回执系统 · Tool Receipt System

Phase-0-007 · YD-A05-20260425-005
HLDP-ARCH-001 [L-2] 工具回执系统

核心目标:
    每次工具调用的全过程可见 · AI能看见 · 人类也能看见 · 编了会被自己的回执打脸。

三层防线对齐:
    · 第一层(微调·改大脑): 不在本模块范围
    · 第二层(Boot Protocol·改规则): 灯塔公理已在Phase-0-006实现
    · 第三层(回执系统·改环境): 本模块 → 每步操作有回执 → 编了会被证据链打脸

公开接口::
    from tool_receipt import record_receipt, record_receipts
    from tool_receipt import ReceiptRecorder
    from tool_receipt import ReceiptStore
    from tool_receipt import ReceiptValidator
    from tool_receipt import ReceiptFormatter

用法::
    import asyncio
    from tool_receipt import record_receipt

    receipt = asyncio.run(record_receipt(
        session_id="sess-001",
        persona_id="AG-SY-01",
        tool_name="search_code",
        input_params={"query": "hello"},
        output_result={"results": []},
        status="success",
        duration_ms=120,
    ))
"""

from __future__ import annotations

__version__ = "1.0.0"

from .receipt_store import (
    ReceiptRecord,
    ReceiptStore,
)
from .receipt_recorder import (
    ReceiptRecorder,
    record_receipt,
    record_receipts,
)
from .receipt_validator import (
    ValidationVerdict,
    ValidationReport,
    ReceiptValidator,
)
from .receipt_formatter import (
    ReceiptFormatter,
)

__all__ = [
    "ReceiptRecord", "ReceiptStore",
    "ReceiptRecorder", "record_receipt", "record_receipts",
    "ValidationVerdict", "ValidationReport", "ReceiptValidator",
    "ReceiptFormatter",
]
