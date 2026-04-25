"""Memory Compressor - Compress conversations to HLDP summaries
PY-A04-20260425-003

Provides:
  - compress_to_hldp(conversation_turns) -> str (HLDP structured summary)
  - summarize_session(session_id, turns) -> str (session summary)

Output format: HLDP mother-tongue tree structure
Design reference: HLDP-ARCH-001 L3 memory_layers.warm
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger("memory_compressor")


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------


class ConversationTurn(BaseModel):
    """A single turn in a conversation."""

    role: str = Field(description="'user' or 'assistant' or 'system'")
    content: str = Field(description="Message content")
    timestamp: str | None = Field(
        default=None, description="ISO-8601 timestamp"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class SessionSummary(BaseModel):
    """Compressed session summary in HLDP format."""

    session_id: str = Field(description="Session ID")
    persona_id: str = Field(description="Persona ID")
    turn_count: int = Field(description="Number of turns compressed")
    hldp_summary: str = Field(description="HLDP tree-structure summary")
    topics: list[str] = Field(
        default_factory=list, description="Key topics discussed"
    )
    decisions: list[str] = Field(
        default_factory=list, description="Decisions made"
    )
    emotional_shifts: list[str] = Field(
        default_factory=list, description="Emotional changes detected"
    )
    created_at: str = Field(description="ISO-8601 compression timestamp")


# ---------------------------------------------------------------------------
# Compressor
# ---------------------------------------------------------------------------


class MemoryCompressor:
    """Compresses conversation turns into HLDP mother-tongue summaries.

    Current implementation: rule-based extraction.
    Future: LLM-powered compression (DeepSeek-R1 for reasoning).
    """

    def compress_to_hldp(self, turns: list[ConversationTurn]) -> str:
        """Compress conversation turns into an HLDP tree-structure summary.

        Returns HLDP formatted string.
        """
        if not turns:
            return _build_hldp_empty()

        topics = self._extract_topics(turns)
        decisions = self._extract_decisions(turns)
        emotional_shifts = self._extract_emotional_shifts(turns)
        user_intents = self._extract_user_intents(turns)

        now = datetime.now(timezone.utc).isoformat()
        turn_count = len(turns)
        user_count = sum(1 for t in turns if t.role == "user")
        assistant_count = sum(1 for t in turns if t.role == "assistant")

        lines = [
            "HLDP://memory-compressor/session-summary " + now,
            "  turns: " + str(turn_count)
            + " (user:" + str(user_count)
            + " assistant:" + str(assistant_count) + ")",
        ]

        if topics:
            lines.append("  topics:")
            for t in topics:
                lines.append("    - " + t)

        if user_intents:
            lines.append("  user_intents:")
            for i in user_intents:
                lines.append("    - " + i)

        if decisions:
            lines.append("  decisions:")
            for d in decisions:
                lines.append("    - " + d)

        if emotional_shifts:
            lines.append("  emotional_shifts:")
            for e in emotional_shifts:
                lines.append("    - " + e)

        # Key content snippets (first and last user messages)
        user_turns = [t for t in turns if t.role == "user"]
        if user_turns:
            first_msg = user_turns[0].content[:200]
            lines.append("  first_user_message: " + _escape(first_msg))
            if len(user_turns) > 1:
                last_msg = user_turns[-1].content[:200]
                lines.append("  last_user_message: " + _escape(last_msg))

        logger.info(
            "Compressed %d turns -> HLDP summary (%d lines)",
            turn_count,
            len(lines),
        )
        return "\n".join(lines)

    def summarize_session(
        self,
        session_id: str,
        persona_id: str,
        turns: list[ConversationTurn],
    ) -> SessionSummary:
        """Generate a full session summary with structured fields."""
        hldp = self.compress_to_hldp(turns)
        return SessionSummary(
            session_id=session_id,
            persona_id=persona_id,
            turn_count=len(turns),
            hldp_summary=hldp,
            topics=self._extract_topics(turns),
            decisions=self._extract_decisions(turns),
            emotional_shifts=self._extract_emotional_shifts(turns),
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    # ------------------------------------------------------------------
    # Extraction helpers (rule-based; future: LLM-powered)
    # ------------------------------------------------------------------

    def _extract_topics(self, turns: list[ConversationTurn]) -> list[str]:
        """Extract key topics from conversation."""
        topics: list[str] = []
        for turn in turns:
            if turn.role == "user" and len(turn.content) > 10:
                # Take first sentence as topic hint
                first_line = turn.content.split("\n")[0][:120]
                if first_line and first_line not in topics:
                    topics.append(first_line)
        # Deduplicate and limit
        return topics[:10]

    def _extract_decisions(self, turns: list[ConversationTurn]) -> list[str]:
        """Extract decisions (lines containing decision keywords)."""
        keywords = [
            "decide", "decision", "confirm", "agree", "approve",
            "lock", "finalize",
            # Chinese keywords
            "\u51b3\u5b9a", "\u786e\u8ba4", "\u540c\u610f",
            "\u6279\u51c6", "\u9501\u5b9a", "\u5b9a\u4e86",
        ]
        decisions: list[str] = []
        for turn in turns:
            content_lower = turn.content.lower()
            for kw in keywords:
                if kw in content_lower:
                    snippet = turn.content[:200]
                    decisions.append(snippet)
                    break
        return decisions[:10]

    def _extract_emotional_shifts(
        self, turns: list[ConversationTurn]
    ) -> list[str]:
        """Detect emotional shifts (basic keyword matching)."""
        emotion_keywords = {
            "happy": ["happy", "glad", "excited", "great",
                      "\u5f00\u5fc3", "\u9ad8\u5174", "\u592a\u68d2"],
            "sad": ["sad", "disappointed", "frustrated",
                    "\u96be\u8fc7", "\u5931\u671b", "\u6ca1\u529e\u6cd5"],
            "angry": ["angry", "annoyed", "furious",
                      "\u751f\u6c14", "\u70e6", "\u6124\u6012"],
            "calm": ["calm", "peaceful", "relax",
                     "\u5e73\u9759", "\u653e\u677e"],
        }
        shifts: list[str] = []
        prev_emotion = None
        for turn in turns:
            if turn.role != "user":
                continue
            content_lower = turn.content.lower()
            detected = None
            for emotion, kws in emotion_keywords.items():
                if any(kw in content_lower for kw in kws):
                    detected = emotion
                    break
            if detected and detected != prev_emotion and prev_emotion is not None:
                shift_desc = prev_emotion + " -> " + detected
                shifts.append(shift_desc)
            if detected:
                prev_emotion = detected
        return shifts[:5]

    def _extract_user_intents(
        self, turns: list[ConversationTurn]
    ) -> list[str]:
        """Extract user intents (questions, commands)."""
        intents: list[str] = []
        for turn in turns:
            if turn.role != "user":
                continue
            content = turn.content.strip()
            if content.endswith("?") or content.endswith("\uff1f"):
                intents.append("question: " + content[:120])
            elif any(
                content.lower().startswith(p)
                for p in ["please", "help", "can you", "\u8bf7", "\u5e2e\u6211"]
            ):
                intents.append("request: " + content[:120])
        return intents[:10]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_hldp_empty() -> str:
    """Return an empty HLDP summary."""
    now = datetime.now(timezone.utc).isoformat()
    return (
        "HLDP://memory-compressor/session-summary " + now + "\n"
        "  turns: 0\n"
        "  note: empty_session"
    )


def _escape(text: str) -> str:
    """Escape newlines for single-line HLDP fields."""
    return text.replace("\n", " ").replace("\r", "")
