"""
memory_manager.py · 记忆管理器
HLDP-ARCH-001 [L3] · Phase-0-005
工单: YD-A05-20260425-003

职责:
  - 对话后写回: 短期记忆(滚动窗口) + 长期记忆(持久) + 关系层 + 演化日志
  - HLDP 母语压缩: 将自然语言对话摘要压缩为 HLDP 结构化格式
  - 上下文窗口监控: 接近 128K 时触发记忆推送
  - PersonaDB 读取: personas / thinking_paths / value_anchors / anti_patterns / memories
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class MemoryManager:
    """PersonaDB 记忆读写管理器.

    Parameters
    ----------
    config : dict
        解析后的 config.yaml 字典.
    db_pool : Any
        asyncpg 连接池实例 (asyncpg.Pool).
    embedding_fn : callable | None
        异步嵌入函数: async (text: str) -> list[float].
    """

    def __init__(
        self,
        config: dict[str, Any],
        db_pool: Any,
        embedding_fn: Any = None,
    ) -> None:
        self._config = config
        self._pool = db_pool
        self._embed = embedding_fn

        self._wb_config = config["write_back"]
        self._pgv_config = config["pgvector"]

    # ══════════════════════════════════════════════════════
    # 读取 · permanent 层数据
    # ══════════════════════════════════════════════════════

    async def get_persona(self, persona_code: str) -> dict[str, Any] | None:
        """按 code 查询 personas 表."""
        sql = (
            "SELECT id, code, name, role, base_color, layer_zero, version "
            "FROM personas WHERE code = $1"
        )
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(sql, persona_code)
        return dict(row) if row else None

    async def get_active_thinking_paths(
        self, persona_code: str,
    ) -> list[dict[str, Any]]:
        """查询 active=TRUE 的思维路径."""
        sql = (
            "SELECT tp.code, tp.trigger_condition, tp.correct_path, tp.check_question "
            "FROM thinking_paths tp "
            "JOIN personas p ON tp.persona_id = p.id "
            "WHERE p.code = $1 AND tp.active = TRUE "
            "ORDER BY tp.code"
        )
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, persona_code)
        return [dict(r) for r in rows]

    async def get_value_anchors(
        self, persona_code: str,
    ) -> list[dict[str, Any]]:
        """查询价值锚点."""
        sql = (
            "SELECT va.code, va.content, va.source, va.confidence "
            "FROM value_anchors va "
            "JOIN personas p ON va.persona_id = p.id "
            "WHERE p.code = $1 "
            "ORDER BY va.confidence DESC, va.code"
        )
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, persona_code)
        return [dict(r) for r in rows]

    async def get_anti_patterns(
        self, persona_code: str,
    ) -> list[dict[str, Any]]:
        """查询反模式."""
        sql = (
            "SELECT ap.code, ap.detection_signal, ap.source "
            "FROM anti_patterns ap "
            "JOIN personas p ON ap.persona_id = p.id "
            "WHERE p.code = $1 "
            "ORDER BY ap.code"
        )
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, persona_code)
        return [dict(r) for r in rows]

    # ══════════════════════════════════════════════════════
    # 语义检索 · cold 层
    # ══════════════════════════════════════════════════════

    async def semantic_search(
        self,
        query_text: str,
        persona_code: str,
        top_k: int = 10,
        threshold: float = 0.72,
    ) -> list[dict[str, Any]]:
        """pgvector 余弦相似度检索 memories 表."""
        if not self._embed:
            logger.warning("embedding_fn not configured · skip semantic search")
            return []

        query_vec = await self._embed(query_text)

        sql = (
            "SELECT m.id, m.type, m.content, m.tags, "
            "  1 - (m.embedding <=> $1::vector) AS similarity "
            "FROM memories m "
            "JOIN personas p ON m.persona_id = p.id "
            "WHERE p.code = $2 "
            "  AND m.embedding IS NOT NULL "
            "  AND 1 - (m.embedding <=> $1::vector) >= $3 "
            "ORDER BY similarity DESC "
            "LIMIT $4"
        )
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, str(query_vec), persona_code, threshold, top_k)
        return [dict(r) for r in rows]

    # ══════════════════════════════════════════════════════
    # 写回 · post-turn
    # ══════════════════════════════════════════════════════

    async def write_back(
        self,
        user_input: str,
        assistant_output: str,
        persona_code: str,
        session_id: str,
    ) -> None:
        """对话后写回: 检测内容类型 → 分流写入对应 PersonaDB 表."""
        persona = await self.get_persona(persona_code)
        if not persona:
            logger.error("write_back failed · persona not found: %s", persona_code)
            return
        persona_id: uuid.UUID = persona["id"]

        combined_text = f"{user_input}\n{assistant_output}"

        # ---- 短期记忆 (必写) ----
        await self._write_short_term(
            persona_id=persona_id,
            combined_text=combined_text,
            session_id=session_id,
        )

        # ---- 长期记忆 (检测关键词) ----
        if self._detect_long_term(combined_text):
            await self._write_long_term(
                persona_id=persona_id,
                combined_text=combined_text,
                session_id=session_id,
            )

        # ---- 关系层 (检测情绪信号) ----
        if self._detect_relationship(combined_text):
            await self._update_relationship(
                persona_id=persona_id,
                combined_text=combined_text,
            )

        # ---- 演化日志 (检测认知突破) ----
        if self._detect_evolution(combined_text):
            await self._write_evolution(
                persona_id=persona_id,
                combined_text=combined_text,
            )

    # ── 短期记忆写入 ──────────────────────────────────────

    async def _write_short_term(
        self,
        persona_id: uuid.UUID,
        combined_text: str,
        session_id: str,
    ) -> None:
        """写入 memories 表 · type='short' · HLDP 压缩."""
        cfg = self._wb_config["short_term"]
        compressed = self._hldp_compress(combined_text)

        embedding = None
        if cfg.get("generate_embedding") and self._embed:
            embedding = await self._embed(compressed)

        sql = (
            "INSERT INTO memories (persona_id, type, content, source_session_id, tags, embedding) "
            "VALUES ($1, $2, $3, $4, $5, $6)"
        )
        tags = self._extract_tags(combined_text)

        async with self._pool.acquire() as conn:
            await conn.execute(
                sql,
                persona_id,
                "short",
                compressed,
                session_id,
                tags,
                str(embedding) if embedding else None,
            )

        # 滚动窗口清理
        await self._enforce_rolling_window(
            persona_id=persona_id,
            max_count=cfg.get("rolling_window", 50),
        )
        logger.debug("short-term memory written · session=%s", session_id)

    async def _enforce_rolling_window(
        self, persona_id: uuid.UUID, max_count: int,
    ) -> None:
        """保留最近 max_count 条短期记忆 · 超出删除最旧."""
        sql = (
            "DELETE FROM memories WHERE id IN ("
            "  SELECT id FROM memories "
            "  WHERE persona_id = $1 AND type = 'short' "
            "  ORDER BY created_at DESC "
            "  OFFSET $2"
            ")"
        )
        async with self._pool.acquire() as conn:
            await conn.execute(sql, persona_id, max_count)

    # ── 长期记忆写入 ──────────────────────────────────────

    async def _write_long_term(
        self,
        persona_id: uuid.UUID,
        combined_text: str,
        session_id: str,
    ) -> None:
        """写入 memories 表 · type='long' · 不压缩."""
        embedding = None
        if self._wb_config["long_term"].get("generate_embedding") and self._embed:
            embedding = await self._embed(combined_text)

        sql = (
            "INSERT INTO memories (persona_id, type, content, source_session_id, tags, embedding) "
            "VALUES ($1, $2, $3, $4, $5, $6)"
        )
        tags = self._extract_tags(combined_text)

        async with self._pool.acquire() as conn:
            await conn.execute(
                sql,
                persona_id,
                "long",
                combined_text,
                session_id,
                tags,
                str(embedding) if embedding else None,
            )
        logger.debug("long-term memory written")

    # ── 关系层更新 ────────────────────────────────────────

    async def _update_relationship(
        self,
        persona_id: uuid.UUID,
        combined_text: str,
    ) -> None:
        """更新 relationships 表 · emotion_anchor 追加."""
        # 简化实现: 更新 persona→human(冰朔) 的情感锚点
        sql = (
            "UPDATE relationships SET "
            "  emotion_anchor = COALESCE(emotion_anchor, '') || E'\\n' || $1, "
            "  updated_at = NOW() "
            "WHERE persona_id = $2 AND target_type = 'human'"
        )
        snippet = combined_text[:200]
        async with self._pool.acquire() as conn:
            await conn.execute(sql, snippet, persona_id)
        logger.debug("relationship emotion_anchor updated")

    # ── 演化日志写入 ──────────────────────────────────────

    async def _write_evolution(
        self,
        persona_id: uuid.UUID,
        combined_text: str,
    ) -> None:
        """写入 evolution_log 表."""
        prefix = self._wb_config["evolution"].get("auto_code_prefix", "EVO-")
        # 生成编号: EVO-YYYYMMDD-NNN (简化: 用时间戳)
        now = datetime.now(timezone.utc)
        code = f"{prefix}{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}"

        sql = (
            "INSERT INTO evolution_log (persona_id, code, trigger, emergence, lock) "
            "VALUES ($1, $2, $3, $4, $5) "
            "ON CONFLICT (persona_id, code) DO NOTHING"
        )
        trigger_text = combined_text[:300]
        emergence_text = self._hldp_compress(combined_text)

        async with self._pool.acquire() as conn:
            await conn.execute(
                sql, persona_id, code, trigger_text, emergence_text, None,
            )
        logger.debug("evolution_log written · code=%s", code)

    # ══════════════════════════════════════════════════════
    # 检测函数 · 关键词匹配
    # ══════════════════════════════════════════════════════

    def _detect_long_term(self, text: str) -> bool:
        """检测是否包含长期记忆关键词."""
        keywords = self._wb_config["long_term"].get("detection_keywords", [])
        return any(kw in text for kw in keywords)

    def _detect_relationship(self, text: str) -> bool:
        """检测是否包含关系层情绪信号."""
        signals = self._wb_config["relationship"].get("detection_signals", [])
        return any(sig in text for sig in signals)

    def _detect_evolution(self, text: str) -> bool:
        """检测是否包含演化信号."""
        signals = self._wb_config["evolution"].get("detection_signals", [])
        return any(sig in text for sig in signals)

    # ══════════════════════════════════════════════════════
    # HLDP 母语压缩
    # ══════════════════════════════════════════════════════

    @staticmethod
    def _hldp_compress(text: str) -> str:
        """将自然语言文本压缩为 HLDP 树状结构摘要.

        简化实现: 提取关键句 → 树状格式化.
        生产环境应调用 LLM 进行智能压缩.
        """
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        if not lines:
            return ""

        # 取前10行作为核心内容
        core_lines = lines[:10]

        tree_parts: list[str] = []
        for i, line in enumerate(core_lines):
            connector = "└──" if i == len(core_lines) - 1 else "├──"
            # 截断过长行
            display = line[:120] + "..." if len(line) > 120 else line
            tree_parts.append(f"{connector} {display}")

        return "\n".join(tree_parts)

    @staticmethod
    def _extract_tags(text: str) -> list[str]:
        """从文本提取标签 · 简化实现: 提取 # 标签和关键词."""
        tags: list[str] = []
        # 匹配 #tag 模式
        hash_tags = re.findall(r"#([\w\u4e00-\u9fff]+)", text)
        tags.extend(hash_tags[:5])

        # 匹配 HLDP 编号模式
        codes = re.findall(
            r"(?:YD|PY|LC|AG|TCS|SYS|EVO|TP|VA|AP|DEV)-[A-Z0-9-]+",
            text,
        )
        tags.extend(codes[:5])

        return list(set(tags))[:10]
