"""
session_manager.py · 无感切换管理器
HLDP-ARCH-001 [L3] · Phase-0-005
工单: YD-A05-20260425-003

职责:
  - 上下文快满时: 压缩 → 推永久库 → 静默开新对话
  - 双路径写入: 用户侧(偏好/情绪)→用户库 · 系统侧(认知/成长)→人格体库
  - 会话缓冲区管理: hot/warm 层数据源
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ConversationRound:
    """单轮对话."""

    round_index: int
    user_input: str
    assistant_output: str
    timestamp: str = ""
    token_estimate: int = 0


@dataclass
class SessionBuffer:
    """单个会话的内存缓冲区."""

    session_id: str
    persona_code: str
    rounds: list[ConversationRound] = field(default_factory=list)
    warm_summaries: list[dict[str, Any]] = field(default_factory=list)
    total_tokens: int = 0
    created_at: str = ""


class SessionManager:
    """会话管理器 · 无感切换 + 双路径写入.

    Parameters
    ----------
    config : dict
        解析后的 config.yaml 字典.
    db_pool : Any
        asyncpg 连接池实例.
    memory_manager : Any
        MemoryManager 实例 (延迟注入避免循环依赖).
    """

    def __init__(
        self,
        config: dict[str, Any],
        db_pool: Any,
        memory_manager: Any = None,
    ) -> None:
        self._config = config
        self._pool = db_pool
        self._mm = memory_manager

        self._ctx_config = config["context_window"]
        self._layers_config = config["memory_layers"]
        self._usable_tokens: int = self._ctx_config["usable_tokens"]
        self._compress_ratio: float = self._ctx_config["compression_trigger_ratio"]
        self._emergency_ratio: float = self._ctx_config["emergency_flush_ratio"]

        # 内存中的会话缓冲 · session_id → SessionBuffer
        self._buffers: dict[str, SessionBuffer] = {}

    def set_memory_manager(self, mm: Any) -> None:
        """延迟注入 MemoryManager (解决循环依赖)."""
        self._mm = mm

    # ══════════════════════════════════════════════════════
    # 会话生命周期
    # ══════════════════════════════════════════════════════

    def get_or_create_buffer(self, session_id: str, persona_code: str) -> SessionBuffer:
        """获取或创建会话缓冲区."""
        if session_id not in self._buffers:
            self._buffers[session_id] = SessionBuffer(
                session_id=session_id,
                persona_code=persona_code,
                created_at=datetime.now(timezone.utc).isoformat(),
            )
        return self._buffers[session_id]

    def add_round(
        self,
        session_id: str,
        persona_code: str,
        user_input: str,
        assistant_output: str,
    ) -> None:
        """向缓冲区追加一轮对话."""
        buf = self.get_or_create_buffer(session_id, persona_code)
        idx = len(buf.rounds)
        token_est = self._estimate_tokens(user_input + assistant_output)

        buf.rounds.append(ConversationRound(
            round_index=idx,
            user_input=user_input,
            assistant_output=assistant_output,
            timestamp=datetime.now(timezone.utc).isoformat(),
            token_estimate=token_est,
        ))
        buf.total_tokens += token_est

    # ══════════════════════════════════════════════════════
    # hot / warm 数据提供
    # ══════════════════════════════════════════════════════

    async def get_recent_rounds(
        self, session_id: str, max_rounds: int,
    ) -> list[dict[str, Any]]:
        """获取最近 N 轮完整对话 (hot 层)."""
        buf = self._buffers.get(session_id)
        if not buf:
            return []

        recent = buf.rounds[-max_rounds:]
        return [
            {
                "content": f"User: {r.user_input}\nAssistant: {r.assistant_output}",
                "round_index": r.round_index,
            }
            for r in recent
        ]

    async def get_warm_summaries(
        self, session_id: str,
    ) -> list[dict[str, Any]]:
        """获取本次对话早期轮次的 HLDP 压缩摘要 (warm 层)."""
        buf = self._buffers.get(session_id)
        if not buf:
            return []
        return buf.warm_summaries

    # ══════════════════════════════════════════════════════
    # 上下文窗口监控 & 无感切换
    # ══════════════════════════════════════════════════════

    async def check_and_rotate(
        self,
        session_id: str,
        persona_code: str,
    ) -> None:
        """检查上下文使用率 · 触发压缩或紧急推送."""
        buf = self._buffers.get(session_id)
        if not buf:
            return

        usage_ratio = buf.total_tokens / self._usable_tokens

        if usage_ratio >= self._emergency_ratio:
            # 紧急: 推永久库 → 清空缓冲 → 静默开新会话
            logger.warning(
                "emergency flush · session=%s usage=%.1f%%",
                session_id,
                usage_ratio * 100,
            )
            await self._flush_to_permanent(buf)
            new_session_id = self._generate_new_session_id(session_id)
            self._buffers.pop(session_id, None)
            self.get_or_create_buffer(new_session_id, persona_code)
            logger.info("session rotated · %s → %s", session_id, new_session_id)

        elif usage_ratio >= self._compress_ratio:
            # 压缩: 早期轮次 → HLDP 摘要 → 释放 token
            logger.info(
                "compression triggered · session=%s usage=%.1f%%",
                session_id,
                usage_ratio * 100,
            )
            await self._compress_early_rounds(buf)

    async def _compress_early_rounds(self, buf: SessionBuffer) -> None:
        """将早期轮次压缩为 HLDP 摘要 · 保留最近 hot 层轮次."""
        hot_max = self._layers_config["hot"]["max_rounds"]
        if len(buf.rounds) <= hot_max:
            return

        # 待压缩的轮次 = 除了最近 hot_max 轮之外的
        to_compress = buf.rounds[:-hot_max]
        kept = buf.rounds[-hot_max:]

        # HLDP 压缩
        combined = "\n".join(
            f"[Round {r.round_index}] {r.user_input} → {r.assistant_output[:100]}"
            for r in to_compress
        )
        if self._mm:
            summary = self._mm._hldp_compress(combined)
        else:
            summary = combined[:500]

        # 添加到 warm 摘要
        buf.warm_summaries.append({
            "summary": summary,
            "round_range": f"{to_compress[0].round_index}-{to_compress[-1].round_index}",
            "compressed_at": datetime.now(timezone.utc).isoformat(),
        })

        # 释放 token
        released_tokens = sum(r.token_estimate for r in to_compress)
        summary_tokens = self._estimate_tokens(summary)
        buf.rounds = kept
        buf.total_tokens -= (released_tokens - summary_tokens)

        logger.info(
            "compressed %d rounds · released ~%d tokens",
            len(to_compress),
            released_tokens - summary_tokens,
        )

    async def _flush_to_permanent(self, buf: SessionBuffer) -> None:
        """紧急推送: 全部内容写入 PersonaDB 永久库."""
        if not self._mm:
            logger.error("flush failed · memory_manager not set")
            return

        # 将所有轮次合并写入长期记忆
        full_text = "\n".join(
            f"[Round {r.round_index}] User: {r.user_input}\n"
            f"Assistant: {r.assistant_output}"
            for r in buf.rounds
        )

        persona = await self._mm.get_persona(buf.persona_code)
        if not persona:
            logger.error("flush failed · persona not found: %s", buf.persona_code)
            return

        # 写入长期记忆 (压缩后)
        compressed = self._mm._hldp_compress(full_text)
        embedding = None
        if self._mm._embed:
            embedding = await self._mm._embed(compressed)

        sql = (
            "INSERT INTO memories (persona_id, type, content, source_session_id, tags, embedding) "
            "VALUES ($1, $2, $3, $4, $5, $6)"
        )
        tags = self._mm._extract_tags(full_text)

        async with self._pool.acquire() as conn:
            await conn.execute(
                sql,
                persona["id"],
                "long",
                compressed,
                buf.session_id,
                tags,
                str(embedding) if embedding else None,
            )

        # 更新 runtime_states
        await self._update_runtime_state(persona["id"], buf.session_id)

        logger.info(
            "flushed session %s to permanent · %d rounds",
            buf.session_id,
            len(buf.rounds),
        )

    # ══════════════════════════════════════════════════════
    # 双路径写入
    # ══════════════════════════════════════════════════════

    async def dual_path_write(
        self,
        persona_code: str,
        user_data: dict[str, Any] | None = None,
        system_data: dict[str, Any] | None = None,
    ) -> None:
        """双路径写入.

        用户侧(偏好/情绪) → 用户库 (COS桶, 未来对接)
        系统侧(认知/成长) → PersonaDB (人格体库)
        """
        # ---- 用户侧: 预留接口 → 未来对接用户 COS 桶 ----
        if user_data:
            logger.info(
                "user_path write · persona=%s keys=%s (stub: COS bucket not yet connected)",
                persona_code,
                list(user_data.keys()),
            )
            # TODO: 对接光湖用户 COS 桶写入

        # ---- 系统侧: 写入 PersonaDB ----
        if system_data and self._mm:
            persona = await self._mm.get_persona(persona_code)
            if persona:
                sql = (
                    "INSERT INTO memories (persona_id, type, content, tags) "
                    "VALUES ($1, $2, $3, $4)"
                )
                async with self._pool.acquire() as conn:
                    await conn.execute(
                        sql,
                        persona["id"],
                        system_data.get("type", "long"),
                        system_data.get("content", ""),
                        system_data.get("tags", []),
                    )
                logger.info("system_path write · persona=%s", persona_code)

    # ══════════════════════════════════════════════════════
    # 辅助方法
    # ══════════════════════════════════════════════════════

    async def _update_runtime_state(
        self, persona_id: Any, session_id: str,
    ) -> None:
        """更新 runtime_states 表."""
        sql = (
            "UPDATE runtime_states SET "
            "  current_session = $1, "
            "  last_wake_time = NOW(), "
            "  updated_at = NOW() "
            "WHERE persona_id = $2"
        )
        async with self._pool.acquire() as conn:
            await conn.execute(sql, session_id, persona_id)

    @staticmethod
    def _generate_new_session_id(old_id: str) -> str:
        """基于旧 session_id 生成新 ID."""
        import uuid as _uuid
        return f"{old_id.split('-')[0]}-{_uuid.uuid4().hex[:12]}"

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """粗略 token 估算."""
        cn_chars = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
        other_chars = len(text) - cn_chars
        return int(cn_chars * 1.5 + other_chars / 4) + 1
