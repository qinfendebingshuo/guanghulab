"""Receipt Formatter - Human-readable & HLDP format outputs
PY-A04-20260425-002

Two output modes:
  1. JSON   -> receipt.model_dump_json()  (for system consumption)
  2. Text   -> to_text(receipt)           (for frontend / human reading)
  3. HLDP   -> to_hldp(receipt)           (for HLDP mother-tongue tree)
"""
from __future__ import annotations

import json
from typing import Any

from receipt_manager import Receipt, ReceiptStatus


_STATUS_ICON: dict[ReceiptStatus, str] = {
    ReceiptStatus.PENDING: "\u23f3",   # hourglass
    ReceiptStatus.SUCCESS: "\u2705",   # check mark
    ReceiptStatus.ERROR:   "\u274c",   # cross mark
    ReceiptStatus.TIMEOUT: "\u23f0",   # alarm clock
}

_STATUS_LABEL: dict[ReceiptStatus, str] = {
    ReceiptStatus.PENDING: "pending",
    ReceiptStatus.SUCCESS: "success",
    ReceiptStatus.ERROR:   "error",
    ReceiptStatus.TIMEOUT: "timeout",
}


class ReceiptFormatter:
    """Stateless formatter for Receipt objects."""

    # ------------------------------------------------------------------
    # JSON (system)
    # ------------------------------------------------------------------

    @staticmethod
    def to_json(receipt: Receipt, *, indent: int = 2) -> str:
        """Serialize receipt to pretty-printed JSON string."""
        return receipt.model_dump_json(indent=indent)

    # ------------------------------------------------------------------
    # Human-readable text (frontend)
    # ------------------------------------------------------------------

    @staticmethod
    def to_text(receipt: Receipt) -> str:
        """Render receipt as human-readable multi-line text."""
        icon = _STATUS_ICON.get(receipt.status, "")
        label = _STATUS_LABEL.get(receipt.status, receipt.status.value)
        lines: list[str] = [
            f"=== Tool Receipt {icon} ===",
            f"ID:       {receipt.receipt_id}",
            f"Session:  {receipt.session_id}",
            f"Persona:  {receipt.persona_id}",
            f"Tool:     {receipt.tool_name}",
            f"Status:   {label}",
            f"Created:  {receipt.created_at}",
            f"Updated:  {receipt.updated_at}",
        ]
        if receipt.duration_ms is not None:
            lines.append(f"Duration: {receipt.duration_ms} ms")
        lines.append("")
        lines.append("--- Input ---")
        lines.append(_pretty_dict(receipt.input_params))
        if receipt.output is not None:
            lines.append("")
            lines.append("--- Output ---")
            lines.append(_pretty_dict(receipt.output))
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # HLDP mother-tongue tree
    # ------------------------------------------------------------------

    @staticmethod
    def to_hldp(receipt: Receipt) -> str:
        """Render receipt as an HLDP tree structure block."""
        icon = _STATUS_ICON.get(receipt.status, "")
        label = _STATUS_LABEL.get(receipt.status, receipt.status.value)

        input_summary = _compact_dict(receipt.input_params)
        output_summary = (
            _compact_dict(receipt.output)
            if receipt.output is not None
            else "null"
        )
        duration_str = (
            str(receipt.duration_ms) + "ms"
            if receipt.duration_ms is not None
            else "n/a"
        )

        tree = (
            f"HLDP://tool-receipt/{receipt.receipt_id}\n"
            f"\u251c\u2500\u2500 tool: {receipt.tool_name}\n"
            f"\u251c\u2500\u2500 status: {icon} {label}\n"
            f"\u251c\u2500\u2500 session: {receipt.session_id}\n"
            f"\u251c\u2500\u2500 persona: {receipt.persona_id}\n"
            f"\u251c\u2500\u2500 created: {receipt.created_at}\n"
            f"\u251c\u2500\u2500 duration: {duration_str}\n"
            f"\u251c\u2500\u2500 input: {input_summary}\n"
            f"\u2514\u2500\u2500 output: {output_summary}"
        )
        return tree

    # ------------------------------------------------------------------
    # Batch helpers
    # ------------------------------------------------------------------

    @staticmethod
    def session_summary_text(receipts: list[Receipt]) -> str:
        """Summarise a session's receipts as human-readable text."""
        if not receipts:
            return "(no receipts)"
        lines: list[str] = [
            f"Session: {receipts[0].session_id}",
            f"Total calls: {len(receipts)}",
            "",
        ]
        for i, r in enumerate(receipts, 1):
            icon = _STATUS_ICON.get(r.status, "")
            dur = f" ({r.duration_ms}ms)" if r.duration_ms is not None else ""
            lines.append(f"  {i}. {icon} {r.tool_name} -> {r.status.value}{dur}")
        return "\n".join(lines)

    @staticmethod
    def session_summary_hldp(receipts: list[Receipt]) -> str:
        """Summarise a session's receipts as an HLDP tree."""
        if not receipts:
            return "HLDP://tool-receipt/session/empty"
        sid = receipts[0].session_id
        children: list[str] = []
        for r in receipts:
            icon = _STATUS_ICON.get(r.status, "")
            dur = (
                str(r.duration_ms) + "ms"
                if r.duration_ms is not None
                else "n/a"
            )
            children.append(
                f"\u251c\u2500\u2500 {r.tool_name} {icon} {r.status.value} "
                f"({dur}) id={r.receipt_id}"
            )
        # replace last connector
        if children:
            children[-1] = "\u2514\u2500\u2500" + children[-1][3:]
        header = (
            f"HLDP://tool-receipt/session/{sid}\n"
            f"\u251c\u2500\u2500 total: {len(receipts)}"
        )
        return header + "\n" + "\n".join(children)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _pretty_dict(d: dict[str, Any] | Any) -> str:
    """Pretty-print a dict as indented JSON."""
    if d is None:
        return "null"
    try:
        return json.dumps(d, indent=2, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(d)


def _compact_dict(d: dict[str, Any] | Any) -> str:
    """One-line compact JSON representation."""
    if d is None:
        return "null"
    try:
        return json.dumps(d, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return str(d)
