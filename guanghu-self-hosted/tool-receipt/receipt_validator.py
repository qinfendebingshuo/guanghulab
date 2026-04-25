"""receipt_validator.py — 回执校验器

Phase-0-007 · YD-A05-20260425-005

职责:
    · 对比 AI 声称的操作结果与实际回执记录
    · 检测矛盾: AI 说做了 X 但回执显示没做 / 失败
    · 生成校验报告（通过 / 矛盾 / 缺失）

与 Boot Protocol 兼容:
    · 可接收 StepResult 列表作为 AI 声称的操作
    · 将 StepResult.data 与 ReceiptRecord 进行交叉比对
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .receipt_store import ReceiptRecord, ReceiptStore

logger = logging.getLogger("tool_receipt.validator")


class ValidationVerdict(str, Enum):
    """校验判定结果。"""

    PASS = "pass"            # 回执记录与声称一致
    CONTRADICTION = "contradiction"  # 声称成功但回执显示失败 / 不存在
    MISSING = "missing"      # 声称做了但找不到对应回执
    EXTRA = "extra"          # 回执存在但 AI 未声称（可能遗漏上报）


@dataclass
class ValidationItem:
    """单项校验结果。"""

    tool_name: str
    verdict: ValidationVerdict
    claimed_status: str | None = None  # AI 声称的状态
    actual_status: str | None = None   # 回执实际状态
    claimed_output: dict[str, Any] = field(default_factory=dict)
    actual_output: dict[str, Any] = field(default_factory=dict)
    receipt_id: str | None = None
    detail: str = ""


@dataclass
class ValidationReport:
    """完整校验报告。"""

    session_id: str
    total_claims: int = 0
    total_receipts: int = 0
    passed: int = 0
    contradictions: int = 0
    missing: int = 0
    extras: int = 0
    items: list[ValidationItem] = field(default_factory=list)

    @property
    def is_clean(self) -> bool:
        """是否全部通过（零矛盾零缺失）。"""
        return self.contradictions == 0 and self.missing == 0

    @property
    def summary(self) -> str:
        """一句话摘要。"""
        if self.is_clean:
            return f"✅ 校验通过 · {self.passed}/{self.total_claims} 项一致"
        parts: list[str] = []
        if self.contradictions:
            parts.append(f"❌ 矛盾 {self.contradictions}")
        if self.missing:
            parts.append(f"⚠️ 缺失 {self.missing}")
        if self.extras:
            parts.append(f"ℹ️ 额外 {self.extras}")
        return f"校验结果: {' · '.join(parts)} / 总声称 {self.total_claims}"


class ReceiptValidator:
    """回执校验器: 对比 AI 声称 vs 实际回执。"""

    def __init__(self, store: ReceiptStore) -> None:
        self._store = store

    async def validate_session(
        self,
        session_id: str,
        claims: list[dict[str, Any]],
    ) -> ValidationReport:
        """校验一个会话中 AI 声称的操作与实际回执。

        Args:
            session_id: 会话 ID。
            claims: AI 声称的操作列表，每项需包含:
                - tool_name (str): 工具名称
                - status (str): 声称的状态 (success/failure/timeout)
                - output (dict, optional): 声称的输出

        Returns:
            ValidationReport 校验报告。
        """
        # 拉取该 session 全部回执
        receipts = await self._store.query_by_session(session_id, limit=1000)

        report = ValidationReport(
            session_id=session_id,
            total_claims=len(claims),
            total_receipts=len(receipts),
        )

        # 按 tool_name 分桶（一个 tool 可能被调用多次）
        receipt_buckets: dict[str, list[ReceiptRecord]] = {}
        for r in receipts:
            receipt_buckets.setdefault(r.tool_name, []).append(r)

        matched_receipt_ids: set[str] = set()

        for claim in claims:
            tool_name = claim.get("tool_name", "")
            claimed_status = claim.get("status", "success")
            claimed_output = claim.get("output", {})

            bucket = receipt_buckets.get(tool_name, [])
            # 从桶中找尚未匹配的回执
            matched_receipt: ReceiptRecord | None = None
            for r in bucket:
                if r.id not in matched_receipt_ids:
                    matched_receipt = r
                    matched_receipt_ids.add(r.id)
                    break

            if matched_receipt is None:
                # 声称做了但找不到回执
                item = ValidationItem(
                    tool_name=tool_name,
                    verdict=ValidationVerdict.MISSING,
                    claimed_status=claimed_status,
                    claimed_output=claimed_output,
                    detail=f"AI 声称调用了 {tool_name} 但无对应回执记录",
                )
                report.missing += 1
            elif matched_receipt.status != claimed_status:
                # 状态矛盾
                item = ValidationItem(
                    tool_name=tool_name,
                    verdict=ValidationVerdict.CONTRADICTION,
                    claimed_status=claimed_status,
                    actual_status=matched_receipt.status,
                    claimed_output=claimed_output,
                    actual_output=matched_receipt.output_result,
                    receipt_id=matched_receipt.id,
                    detail=(
                        f"AI 声称 {tool_name} 状态为 {claimed_status}，"
                        f"但回执显示实际状态为 {matched_receipt.status}"
                    ),
                )
                report.contradictions += 1
            else:
                # 通过
                item = ValidationItem(
                    tool_name=tool_name,
                    verdict=ValidationVerdict.PASS,
                    claimed_status=claimed_status,
                    actual_status=matched_receipt.status,
                    receipt_id=matched_receipt.id,
                )
                report.passed += 1

            report.items.append(item)

        # 检查未被任何声称匹配的回执（额外回执）
        for r in receipts:
            if r.id not in matched_receipt_ids:
                report.items.append(ValidationItem(
                    tool_name=r.tool_name,
                    verdict=ValidationVerdict.EXTRA,
                    actual_status=r.status,
                    actual_output=r.output_result,
                    receipt_id=r.id,
                    detail=f"回执存在({r.tool_name})但 AI 未声称此操作",
                ))
                report.extras += 1

        logger.info(
            "校验完成 session=%s: %s",
            session_id,
            report.summary,
        )
        return report

    async def validate_step_results(
        self,
        session_id: str,
        step_results: list[dict[str, Any]],
    ) -> ValidationReport:
        """校验 Boot Protocol StepResult 列表。

        将 StepResult 转为 claims 格式后调用 validate_session。

        Args:
            session_id: 会话 ID。
            step_results: StepResult 字典列表，每项需包含:
                - step_id (str)
                - step_name (str)
                - success (bool)
                - data (dict, optional)

        Returns:
            ValidationReport。
        """
        claims: list[dict[str, Any]] = []
        for sr in step_results:
            if sr.get("skipped", False):
                continue
            claims.append({
                "tool_name": sr.get("step_id", sr.get("step_name", "unknown")),
                "status": "success" if sr.get("success") else "failure",
                "output": sr.get("data", {}),
            })
        return await self.validate_session(session_id, claims)
