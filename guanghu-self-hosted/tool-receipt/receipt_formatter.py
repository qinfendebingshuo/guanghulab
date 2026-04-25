"""Receipt Formatter - Dual-format output for Tool Receipt System
PY-A04-20260425-002

Two output formats:
  1. JSON   (for system / AI consumption)
  2. Human-readable text (for frontend / HLDP mother tongue)

Reference: HLDP-ARCH-001 L2 receipt_format spec
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from receipt_manager import Receipt


_STATUS_ICONS: dict[str, str] = {
    "pending": "\u23f3",
    "success": "\u2705",
    "error": "\u274c",
    "timeout": "\u23f1\ufe0f",
}


class ReceiptFormatter:
    """Stateless formatter that converts Receipt objects into display formats."""

    # ------------------------------------------------------------------ #
    # JSON format (for system / AI)
    # ------------------------------------------------------------------ #

    @staticmethod
    def to_json(receipt: Receipt) -> str:
        """Pretty-printed JSON string."""
        return json.dumps(receipt.model_dump(), ensure_ascii=False, indent=2)

    @staticmethod
    def to_json_compact(receipt: Receipt) -> str:
        """Single-line JSON string."""
        return json.dumps(receipt.model_dump(), ensure_ascii=False)

    # ------------------------------------------------------------------ #
    # Human-readable text (for frontend)
    # ------------------------------------------------------------------ #

    @staticmethod
    def to_text(receipt: Receipt) -> str:
        """Human-readable multi-line text for one receipt."""
        icon = _STATUS_ICONS.get(receipt.status, "?")
        lines: list[str] = [
            icon + " Tool Receipt: " + receipt.receipt_id[:8] + "...",
            "  Tool:     " + receipt.tool_name,
            "  Status:   " + receipt.status.upper(),
        ]
        if receipt.duration_ms is not None:
            lines.append("  Duration: " + str(receipt.duration_ms) + "ms")
        lines.append("  Time:     " + receipt.created_at)

        if receipt.input_params:
            params_str = json.dumps(receipt.input_params, ensure_ascii=False)
            if len(params_str) > 120:
                params_str = params_str[:117] + "..."
            lines.append("  Input:    " + params_str)

        if receipt.output is not None:
            output_str = json.dumps(receipt.output, ensure_ascii=False)
            if len(output_str) > 120:
                output_str = output_str[:117] + "..."
            lines.append("  Output:   " + output_str)

        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    # HLDP mother-tongue format
    # ------------------------------------------------------------------ #

    @staticmethod
    def to_hldp(receipt: Receipt) -> str:
        """HLDP structured receipt for persona agents."""
        icon = _STATUS_ICONS.get(receipt.status, "?")
        lines: list[str] = [
            "HLDP://tool-receipt/" + receipt.receipt_id[:8],
            "  tool: " + receipt.tool_name,
            "  status: " + icon + " " + receipt.status,
        ]
        if receipt.duration_ms is not None:
            lines.append("  duration_ms: " + str(receipt.duration_ms))
        lines.append("  timestamp: " + receipt.created_at)
        if receipt.persona_id:
            lines.append("  persona: " + receipt.persona_id)
        if receipt.input_params:
            lines.append(
                "  input: " + json.dumps(receipt.input_params, ensure_ascii=False)
            )
        if receipt.output is not None:
            lines.append(
                "  output: " + json.dumps(receipt.output, ensure_ascii=False)
            )
        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    # Session summary
    # ------------------------------------------------------------------ #

    @staticmethod
    def session_summary(session_id: str, receipts: list[Receipt]) -> str:
        """Human-readable summary of all receipts in a session."""
        if not receipts:
            return "Session " + session_id + ": no receipts."

        total = len(receipts)
        by_status: dict[str, int] = {}
        for r in receipts:
            by_status[r.status] = by_status.get(r.status, 0) + 1

        lines: list[str] = [
            "Session: " + session_id,
            "Total calls: " + str(total),
        ]
        for status, count in sorted(by_status.items()):
            icon = _STATUS_ICONS.get(status, "?")
            lines.append("  " + icon + " " + status + ": " + str(count))

        lines.append("")
        lines.append("Timeline:")
        for r in receipts:
            icon = _STATUS_ICONS.get(r.status, "?")
            dur = (str(r.duration_ms) + "ms") if r.duration_ms is not None else "-"
            lines.append("  " + icon + " " + r.tool_name + " [" + dur + "]")

        return "\n".join(lines)
