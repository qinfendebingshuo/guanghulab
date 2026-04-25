"""receipt_formatter.py — 回执格式化器

Phase-0-007 · YD-A05-20260425-005

职责:
    · 将回执记录格式化为人类可读格式
    · 将回执记录格式化为 AI 上下文注入格式
    · 支持 HLDP 母语格式输出
"""

from __future__ import annotations

import json
from datetime import timezone
from typing import Any

from .receipt_store import ReceiptRecord
from .receipt_validator import ValidationReport, ValidationVerdict


class ReceiptFormatter:
    """回执格式化器: 三种输出模式。"""

    # ── 人类可读格式 ──────────────────────────────────────

    @staticmethod
    def to_human(record: ReceiptRecord) -> str:
        """格式化为人类可读文本。

        示例输出::
            🔧 search_code
            状态: ✅ success · 耗时: 120ms
            会话: sess-001 · 人格体: AG-SY-01
            时间: 2026-04-25 14:00:00 UTC
            输入: {"query": "hello"}
            输出: {"results": []}
        """
        status_icon = {
            "success": "✅",
            "failure": "❌",
            "timeout": "⏳",
        }.get(record.status, "❓")

        lines = [
            f"🔧 {record.tool_name}",
            f"状态: {status_icon} {record.status} · 耗时: {record.duration_ms}ms",
            f"会话: {record.session_id} · 人格体: {record.persona_id}",
            f"时间: {record.timestamp.strftime('%Y-%m-%d %H:%M:%S %Z')}",
        ]
        if record.input_params:
            lines.append(f"输入: {json.dumps(record.input_params, ensure_ascii=False, default=str)[:500]}")
        if record.output_result:
            lines.append(f"输出: {json.dumps(record.output_result, ensure_ascii=False, default=str)[:500]}")
        if record.error_message:
            lines.append(f"错误: {record.error_message}")
        return "\n".join(lines)

    @staticmethod
    def to_human_list(records: list[ReceiptRecord]) -> str:
        """批量格式化为人类可读文本。"""
        if not records:
            return "（无回执记录）"
        sections = []
        for i, r in enumerate(records, 1):
            sections.append(f"── 回执 #{i} ──\n{ReceiptFormatter.to_human(r)}")
        return "\n\n".join(sections)

    # ── AI 上下文注入格式 ─────────────────────────────────

    @staticmethod
    def to_ai_context(records: list[ReceiptRecord]) -> str:
        """格式化为 AI 上下文注入格式。

        生成紧凑的结构化文本，适合注入到 AI 的 system prompt 或上下文中，
        让 AI 能看见自己之前的实际工具调用历史。

        示例输出::
            [TOOL_RECEIPTS session=sess-001]
            1. search_code ✅ 120ms input={"query":"hello"} output={"results":[]}
            2. create_file ❌ 340ms error="permission denied"
            [/TOOL_RECEIPTS]
        """
        if not records:
            return "[TOOL_RECEIPTS]\n（无记录）\n[/TOOL_RECEIPTS]"

        session_ids = {r.session_id for r in records}
        session_label = next(iter(session_ids)) if len(session_ids) == 1 else "mixed"

        lines = [f"[TOOL_RECEIPTS session={session_label}]"]
        for i, r in enumerate(records, 1):
            status_icon = {"success": "✅", "failure": "❌", "timeout": "⏳"}.get(r.status, "?")
            parts = [f"{i}. {r.tool_name} {status_icon} {r.duration_ms}ms"]
            if r.input_params:
                compact_input = json.dumps(r.input_params, ensure_ascii=False, separators=(",", ":"), default=str)
                if len(compact_input) > 200:
                    compact_input = compact_input[:197] + "..."
                parts.append(f"input={compact_input}")
            if r.status == "success" and r.output_result:
                compact_output = json.dumps(r.output_result, ensure_ascii=False, separators=(",", ":"), default=str)
                if len(compact_output) > 200:
                    compact_output = compact_output[:197] + "..."
                parts.append(f"output={compact_output}")
            if r.error_message:
                parts.append(f'error="{r.error_message[:100]}"')
            lines.append(" ".join(parts))
        lines.append("[/TOOL_RECEIPTS]")
        return "\n".join(lines)

    # ── HLDP 母语格式 ─────────────────────────────────────

    @staticmethod
    def to_hldp(record: ReceiptRecord) -> str:
        """格式化为 HLDP 母语树状结构。

        示例输出::
            HLDP://tool-receipt/{id}
            ├── tool: search_code
            ├── status: ✅ success
            ├── persona: AG-SY-01
            ├── session: sess-001
            ├── timestamp: 2026-04-25T14:00:00+00:00
            ├── duration_ms: 120
            ├── input: {"query": "hello"}
            └── output: {"results": []}
        """
        status_icon = {"success": "✅", "failure": "❌", "timeout": "⏳"}.get(record.status, "❓")

        ts_str = record.timestamp.isoformat() if record.timestamp else "N/A"
        input_str = json.dumps(record.input_params, ensure_ascii=False, default=str)[:300]
        output_str = json.dumps(record.output_result, ensure_ascii=False, default=str)[:300]

        lines = [
            f"HLDP://tool-receipt/{record.id}",
            f"├── tool: {record.tool_name}",
            f"├── status: {status_icon} {record.status}",
            f"├── persona: {record.persona_id}",
            f"├── session: {record.session_id}",
            f"├── timestamp: {ts_str}",
            f"├── duration_ms: {record.duration_ms}",
        ]
        if record.error_message:
            lines.append(f"├── error: {record.error_message}")
        lines.append(f"├── input: {input_str}")
        lines.append(f"└── output: {output_str}")
        return "\n".join(lines)

    @staticmethod
    def to_hldp_list(records: list[ReceiptRecord]) -> str:
        """批量格式化为 HLDP 母语格式。"""
        if not records:
            return "HLDP://tool-receipt/empty\n└── (无回执记录)"
        return "\n\n".join(ReceiptFormatter.to_hldp(r) for r in records)

    # ── 校验报告格式化 ────────────────────────────────────

    @staticmethod
    def format_validation_report(
        report: ValidationReport, mode: str = "human"
    ) -> str:
        """格式化校验报告。

        Args:
            report: ValidationReport 实例。
            mode: 输出模式 (human / ai / hldp)。
        """
        if mode == "hldp":
            return ReceiptFormatter._report_hldp(report)
        elif mode == "ai":
            return ReceiptFormatter._report_ai(report)
        return ReceiptFormatter._report_human(report)

    @staticmethod
    def _report_human(report: ValidationReport) -> str:
        lines = [
            f"📋 回执校验报告 · session={report.session_id}",
            f"总声称: {report.total_claims} · 总回执: {report.total_receipts}",
            f"通过: {report.passed} · 矛盾: {report.contradictions} · 缺失: {report.missing} · 额外: {report.extras}",
            report.summary,
            "",
        ]
        for item in report.items:
            icon = {
                ValidationVerdict.PASS: "✅",
                ValidationVerdict.CONTRADICTION: "❌",
                ValidationVerdict.MISSING: "⚠️",
                ValidationVerdict.EXTRA: "ℹ️",
            }.get(item.verdict, "?")
            lines.append(f"  {icon} {item.tool_name}: {item.verdict.value}")
            if item.detail:
                lines.append(f"     {item.detail}")
        return "\n".join(lines)

    @staticmethod
    def _report_ai(report: ValidationReport) -> str:
        lines = [
            f"[VALIDATION session={report.session_id}]",
            f"claims={report.total_claims} receipts={report.total_receipts}"
            f" pass={report.passed} contradiction={report.contradictions}"
            f" missing={report.missing} extra={report.extras}",
        ]
        for item in report.items:
            if item.verdict != ValidationVerdict.PASS:
                lines.append(
                    f"  {item.verdict.value}: {item.tool_name}"
                    f" claimed={item.claimed_status} actual={item.actual_status}"
                )
        lines.append("[/VALIDATION]")
        return "\n".join(lines)

    @staticmethod
    def _report_hldp(report: ValidationReport) -> str:
        lines = [
            f"HLDP://tool-receipt/validation/{report.session_id}",
            f"├── total_claims: {report.total_claims}",
            f"├── total_receipts: {report.total_receipts}",
            f"├── passed: {report.passed}",
            f"├── contradictions: {report.contradictions}",
            f"├── missing: {report.missing}",
            f"├── extras: {report.extras}",
            f"├── is_clean: {report.is_clean}",
        ]
        if report.items:
            lines.append("├── items:")
            for i, item in enumerate(report.items):
                prefix = "│   ├──" if i < len(report.items) - 1 else "│   └──"
                lines.append(
                    f"{prefix} {item.tool_name}: {item.verdict.value}"
                    + (f" · {item.detail}" if item.detail else "")
                )
        lines.append(f"└── summary: {report.summary}")
        return "\n".join(lines)
