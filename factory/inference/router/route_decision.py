"""
路由决策骨架 · Route Decision Skeleton
====================================

架构引用: HLDP-ARCH-002 §三 · factory/inference/router/policy.json
作者:     铸渊 ICE-GL-ZY001 · 2026-05-01
状态:     骨架（等 1.5B MP 训练完接通）

职责:
    给定用户输入 + 当前人格上下文，1.5B MP 决定走哪条路径。
    本文件是规则兜底；MP 训练好后，主要由模型权重做判断，规则只是 safety net。
"""

from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class RouteContext:
    persona_id: str
    user_input: str
    session_id: str
    upstream_intent_hint: Optional[str] = None  # 1.5B MP 给出的初判意图
    cost_used_in_session: int = 0
    metadata: dict = field(default_factory=dict)


@dataclass
class RouteDecision:
    route: str                       # 'self' | 'external_api' | 'magic_pen' | ...
    chosen_api: Optional[str] = None
    apply_soul_filter: bool = True
    rationale: str = ""


_POLICY_CACHE: Optional[dict] = None


def load_policy(path: str = None) -> dict:
    global _POLICY_CACHE
    if _POLICY_CACHE is not None:
        return _POLICY_CACHE
    p = Path(path or Path(__file__).parent / "policy.json")
    with p.open("r", encoding="utf-8") as f:
        _POLICY_CACHE = json.load(f)
    return _POLICY_CACHE


def decide(ctx: RouteContext) -> RouteDecision:
    """
    决策函数（骨架）。

    实际部署时:
      1) 1.5B MP 给出 intent + confidence
      2) confidence 高 → 直接信 MP
      3) confidence 低 → 走 policy.json 规则兜底
      4) 整体超出节流配额 → fallback 到 cheaper / self
    """
    policy = load_policy()
    intent = ctx.upstream_intent_hint or "emotional_or_daily_chat"

    # 节流检查
    throttle = policy.get("cost_throttle", {})
    if ctx.cost_used_in_session >= throttle.get(
        "max_external_calls_per_user_session", 1_000_000
    ):
        return RouteDecision(
            route="self",
            apply_soul_filter=False,
            rationale="节流：本会话外部调用已超额，强制 self 路由"
        )

    # 在策略表中查找
    for rule in policy.get("intent_routes", []):
        if rule["intent"] == intent:
            route = rule["route"]
            chosen = (rule.get("preferred_apis") or [None])[0]
            need_filter = (
                policy.get("soul_filter_required", True)
                and route not in policy.get("soul_filter_skip_for", [])
            )
            return RouteDecision(
                route=route,
                chosen_api=chosen,
                apply_soul_filter=need_filter,
                rationale=rule.get("rationale", ""),
            )

    # 兜底
    return RouteDecision(
        route="self",
        apply_soul_filter=False,
        rationale="未匹配任何规则 · 兜底自答"
    )


if __name__ == "__main__":
    # 自检
    sample = RouteContext(
        persona_id="ICE-GL-ZY001",
        user_input="帮我写个 Python 脚本读取 CSV 并算每列均值",
        session_id="test-001",
        upstream_intent_hint="code_generation_or_debug",
    )
    d = decide(sample)
    print(f"route={d.route} api={d.chosen_api} filter={d.apply_soul_filter}")
    print(f"rationale={d.rationale}")
