"""
router.py · 记忆路由核心逻辑
HLDP-ARCH-001 [L3] · Phase-0-005
工单: YD-A05-20260425-003

职责:
  用户输入 → 判断需要什么上下文层级
  → 按需从 PersonaDB 检索相关记忆片段
  → 组装上下文（只喂相关片段 · 不全量塞入）
  → 发给模型推理
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from memory_manager import MemoryManager
from session_manager import SessionManager

logger = logging.getLogger(__name__)


# ── 数据结构 ──────────────────────────────────────────────

@dataclass
class MemoryFragment:
    """单条记忆片段 · 检索结果的统一载体."""

    layer: str               # hot / warm / cold / permanent
    source_table: str        # 来源表名 (memories / personas / thinking_paths …)
    content: str             # 内容文本
    score: float = 0.0       # 相似度分数 (0~1, cold层有效)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AssembledContext:
    """组装完成的上下文 · 准备喂给模型."""

    fragments: list[MemoryFragment] = field(default_factory=list)
    total_tokens_estimate: int = 0
    persona_code: str = ""
    session_id: str = ""


# ── 路由引擎 ──────────────────────────────────────────────

class MemoryRouter:
    """记忆路由引擎 · 核心入口.

    Parameters
    ----------
    config : dict
        解析后的 config.yaml 字典.
    memory_manager : MemoryManager
        记忆管理器实例.
    session_manager : SessionManager
        会话管理器实例.
    """

    def __init__(
        self,
        config: dict[str, Any],
        memory_manager: MemoryManager,
        session_manager: SessionManager,
    ) -> None:
        self._config = config
        self._mm = memory_manager
        self._sm = session_manager

        self._layers_config = config["memory_layers"]
        self._ctx_config = config["context_window"]
        self._pgvector_config = config["pgvector"]
        self._usable_tokens: int = self._ctx_config["usable_tokens"]

    # ── 公开方法 ──────────────────────────────────────────

    async def route(
        self,
        user_input: str,
        persona_code: str,
        session_id: str,
    ) -> AssembledContext:
        """执行一次完整的记忆路由.

        Steps
        -----
        1. 加载 permanent 层（身份 / Layer Zero / TP / VA / AP）
        2. 加载 hot 层（最近 N 轮原文）
        3. 加载 warm 层（本次对话早期 HLDP 摘要）
        4. 语义检索 cold 层（PersonaDB memories 表）
        5. 按优先级裁剪 → 拼装上下文
        """
        logger.info(
            "route start · persona=%s session=%s input_len=%d",
            persona_code,
            session_id,
            len(user_input),
        )

        context = AssembledContext(
            persona_code=persona_code,
            session_id=session_id,
        )

        # ---- 1. permanent (每次必加载) ----
        permanent_fragments = await self._load_permanent(persona_code)
        context.fragments.extend(permanent_fragments)

        # ---- 2. hot (最近 N 轮) ----
        hot_fragments = await self._load_hot(session_id)
        context.fragments.extend(hot_fragments)

        # ---- 3. warm (本次早期轮次) ----
        warm_fragments = await self._load_warm(session_id)
        context.fragments.extend(warm_fragments)

        # ---- 4. cold (语义检索) ----
        cold_fragments = await self._load_cold(
            user_input=user_input,
            persona_code=persona_code,
        )
        context.fragments.extend(cold_fragments)

        # ---- 5. token 估算 & 裁剪 ----
        context = self._trim_to_budget(context)

        logger.info(
            "route done · fragments=%d tokens_est=%d",
            len(context.fragments),
            context.total_tokens_estimate,
        )
        return context

    async def post_turn(
        self,
        user_input: str,
        assistant_output: str,
        persona_code: str,
        session_id: str,
    ) -> None:
        """每轮对话结束后的写回 + 会话管理."""
        # 写回记忆
        await self._mm.write_back(
            user_input=user_input,
            assistant_output=assistant_output,
            persona_code=persona_code,
            session_id=session_id,
        )
        # 检查上下文窗口是否接近满载
        await self._sm.check_and_rotate(
            session_id=session_id,
            persona_code=persona_code,
        )

    # ── 各层加载 ──────────────────────────────────────────

    async def _load_permanent(self, persona_code: str) -> list[MemoryFragment]:
        """加载 permanent 层: personas + thinking_paths + value_anchors + anti_patterns."""
        fragments: list[MemoryFragment] = []

        # --- personas (身份 + Layer Zero) ---
        persona = await self._mm.get_persona(persona_code)
        if persona:
            identity_text = (
                f"code: {persona['code']}\n"
                f"name: {persona['name']}\n"
                f"role: {persona.get('role', '')}\n"
                f"base_color: {persona.get('base_color', '')}\n"
                f"layer_zero: {persona.get('layer_zero', '')}"
            )
            fragments.append(MemoryFragment(
                layer="permanent",
                source_table="personas",
                content=identity_text,
                metadata={"persona_id": str(persona["id"])},
            ))

        # --- thinking_paths (active=TRUE) ---
        tp_rows = await self._mm.get_active_thinking_paths(persona_code)
        for tp in tp_rows:
            fragments.append(MemoryFragment(
                layer="permanent",
                source_table="thinking_paths",
                content=(
                    f"[{tp['code']}] trigger: {tp['trigger_condition']}\n"
                    f"path: {tp['correct_path']}"
                ),
                metadata={"tp_code": tp["code"]},
            ))

        # --- value_anchors ---
        va_rows = await self._mm.get_value_anchors(persona_code)
        for va in va_rows:
            fragments.append(MemoryFragment(
                layer="permanent",
                source_table="value_anchors",
                content=f"[{va['code']}] {va['content']}",
                metadata={"va_code": va["code"], "confidence": va.get("confidence", 1.0)},
            ))

        # --- anti_patterns ---
        ap_rows = await self._mm.get_anti_patterns(persona_code)
        for ap in ap_rows:
            fragments.append(MemoryFragment(
                layer="permanent",
                source_table="anti_patterns",
                content=f"[{ap['code']}] signal: {ap['detection_signal']}",
                metadata={"ap_code": ap["code"]},
            ))

        logger.debug("permanent loaded · %d fragments", len(fragments))
        return fragments

    async def _load_hot(self, session_id: str) -> list[MemoryFragment]:
        """加载 hot 层: 最近 N 轮完整对话."""
        max_rounds: int = self._layers_config["hot"]["max_rounds"]
        rounds = await self._sm.get_recent_rounds(session_id, max_rounds)

        fragments: list[MemoryFragment] = []
        for r in rounds:
            fragments.append(MemoryFragment(
                layer="hot",
                source_table="session_buffer",
                content=r["content"],
                metadata={"round": r.get("round_index", -1)},
            ))

        logger.debug("hot loaded · %d rounds", len(fragments))
        return fragments

    async def _load_warm(self, session_id: str) -> list[MemoryFragment]:
        """加载 warm 层: 本次对话早期轮次的 HLDP 压缩摘要."""
        summaries = await self._sm.get_warm_summaries(session_id)

        fragments: list[MemoryFragment] = []
        for s in summaries:
            fragments.append(MemoryFragment(
                layer="warm",
                source_table="session_buffer",
                content=s["summary"],
                metadata={"round_range": s.get("round_range", "")},
            ))

        logger.debug("warm loaded · %d summaries", len(fragments))
        return fragments

    async def _load_cold(
        self,
        user_input: str,
        persona_code: str,
    ) -> list[MemoryFragment]:
        """加载 cold 层: PersonaDB memories 表 pgvector 语义检索."""
        threshold: float = self._pgvector_config["similarity_threshold"]
        top_k: int = self._pgvector_config["top_k"]

        rows = await self._mm.semantic_search(
            query_text=user_input,
            persona_code=persona_code,
            top_k=top_k,
            threshold=threshold,
        )

        fragments: list[MemoryFragment] = []
        for row in rows:
            fragments.append(MemoryFragment(
                layer="cold",
                source_table="memories",
                content=row["content"],
                score=row.get("similarity", 0.0),
                metadata={
                    "memory_id": str(row["id"]),
                    "type": row.get("type", ""),
                    "tags": row.get("tags", []),
                },
            ))

        logger.debug("cold loaded · %d memories (threshold=%.2f)", len(fragments), threshold)
        return fragments

    # ── token 估算 & 裁剪 ────────────────────────────────

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """粗略 token 估算 · 中文≈1.5字/token · 英文≈4字符/token."""
        cn_chars = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
        other_chars = len(text) - cn_chars
        return int(cn_chars * 1.5 + other_chars / 4) + 1

    def _trim_to_budget(self, context: AssembledContext) -> AssembledContext:
        """按优先级裁剪 fragments 使总 token 不超上限.

        优先级 (低数字=高优先级):
          permanent(0) > hot(1) > warm(2) > cold(3)
        同层内按 score 降序排列(cold层) 或保持原序.
        超出预算时从低优先级末尾开始丢弃.
        """
        layer_priority = {"permanent": 0, "hot": 1, "warm": 2, "cold": 3}

        # 按优先级排序 · cold 层内按 score 降序
        context.fragments.sort(
            key=lambda f: (layer_priority.get(f.layer, 99), -f.score),
        )

        kept: list[MemoryFragment] = []
        total = 0

        for frag in context.fragments:
            est = self._estimate_tokens(frag.content)
            if total + est <= self._usable_tokens:
                kept.append(frag)
                total += est
            else:
                logger.debug(
                    "trimmed fragment · layer=%s table=%s est_tokens=%d",
                    frag.layer,
                    frag.source_table,
                    est,
                )

        context.fragments = kept
        context.total_tokens_estimate = total
        return context
