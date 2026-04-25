"""Memory Router - Core routing logic for Memory Router Agent
PY-A04-20260425-003

Provides:
  - route_query(user_input, session_id, persona_id) -> RoutingDecision
  - assemble_context(decision) -> AssembledContext

Design reference: HLDP-ARCH-001 L3
Routing logic:
  user speaks -> judge what context is needed -> retrieve on demand -> assemble -> return

Memory layers:
  - hot:       last N turns, zero latency (in-memory / session store)
  - warm:      earlier in current session, HLDP compressed summary
  - cold:      previous sessions, pgvector semantic search, milliseconds
  - permanent: identity / Layer Zero / thinking paths / value anchors, always loaded
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from config import settings
from memory_store import (
    Memory,
    MemoryType,
    PgMemoryStore,
    SqliteMemoryStore,
)

logger = logging.getLogger("memory_router")


# ---------------------------------------------------------------------------
# Routing models
# ---------------------------------------------------------------------------


class ContextNeed(str, Enum):
    """What kind of context the query needs."""

    NONE = "none"
    HOT_ONLY = "hot_only"
    HOT_AND_WARM = "hot_and_warm"
    SEMANTIC_SEARCH = "semantic_search"
    PERMANENT = "permanent"
    FULL = "full"


class RoutingDecision(BaseModel):
    """Result of route_query: what context to assemble."""

    user_input: str = Field(description="Original user input")
    session_id: str = Field(description="Session ID")
    persona_id: str = Field(description="Persona ID")
    context_need: ContextNeed = Field(description="Determined context need")
    reasoning: str = Field(
        default="", description="Why this routing decision was made"
    )
    timestamp: str = Field(description="ISO-8601 decision timestamp")


class AssembledContext(BaseModel):
    """Context assembled by the router, ready to send to model."""

    permanent_memories: list[Memory] = Field(
        default_factory=list, description="Permanent memories (always loaded)"
    )
    hot_memories: list[Memory] = Field(
        default_factory=list, description="Recent turns"
    )
    warm_memories: list[Memory] = Field(
        default_factory=list, description="Compressed earlier session context"
    )
    cold_memories: list[Memory] = Field(
        default_factory=list, description="Semantic search results"
    )
    total_fragments: int = Field(
        default=0, description="Total memory fragments assembled"
    )
    routing_decision: RoutingDecision | None = Field(
        default=None, description="The routing decision that led to this context"
    )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------


class MemoryRouter:
    """Core memory routing logic.

    Sits between the chat interface and the model.
    Decides what memories to retrieve and assembles context.
    """

    def __init__(
        self, store: PgMemoryStore | SqliteMemoryStore
    ) -> None:
        self._store = store

    def route_query(
        self,
        user_input: str,
        session_id: str,
        persona_id: str,
    ) -> RoutingDecision:
        """Determine what context the user's input needs.

        Routing rules:
          1. Short greeting/ack -> NONE or HOT_ONLY
          2. Continuation of current topic -> HOT_AND_WARM
          3. Reference to previous conversations -> SEMANTIC_SEARCH
          4. Identity/system questions -> PERMANENT
          5. Complex/unclear -> FULL
        """
        now = datetime.now(timezone.utc).isoformat()
        input_lower = user_input.lower().strip()
        input_len = len(user_input.strip())

        # Rule 1: greetings / very short input
        greetings = [
            "hi", "hello", "hey", "\u4f60\u597d", "\u55e8",
            "\u5728\u5417", "ok", "thanks", "\u8c22\u8c22",
            "\u597d\u7684", "\u561b",
        ]
        if input_len < 15 and any(
            input_lower.startswith(g) for g in greetings
        ):
            logger.info("Route: NONE (greeting/ack)")
            return RoutingDecision(
                user_input=user_input,
                session_id=session_id,
                persona_id=persona_id,
                context_need=ContextNeed.NONE,
                reasoning="Short greeting or acknowledgment, no context needed",
                timestamp=now,
            )

        # Rule 4: identity / system questions
        identity_keywords = [
            "who am i", "who are you", "what are you",
            "your identity", "your name",
            "\u4f60\u662f\u8c01", "\u6211\u662f\u8c01",
            "\u4f60\u7684\u540d\u5b57", "\u4f60\u7684\u8eab\u4efd",
            "layer zero", "value anchor", "thinking path",
            "\u601d\u7ef4\u8def\u5f84", "\u4ef7\u503c\u951a\u70b9",
            "\u672c\u4f53",
        ]
        if any(kw in input_lower for kw in identity_keywords):
            logger.info("Route: PERMANENT (identity/system query)")
            return RoutingDecision(
                user_input=user_input,
                session_id=session_id,
                persona_id=persona_id,
                context_need=ContextNeed.PERMANENT,
                reasoning="Identity or system query detected, loading permanent memories",
                timestamp=now,
            )

        # Rule 3: references to past conversations
        history_keywords = [
            "last time", "before", "remember when",
            "previously", "earlier",
            "\u4e0a\u6b21", "\u4e4b\u524d",
            "\u8fd8\u8bb0\u5f97", "\u4ee5\u524d",
            "\u90a3\u6b21", "\u6628\u5929",
        ]
        if any(kw in input_lower for kw in history_keywords):
            logger.info("Route: SEMANTIC_SEARCH (history reference)")
            return RoutingDecision(
                user_input=user_input,
                session_id=session_id,
                persona_id=persona_id,
                context_need=ContextNeed.SEMANTIC_SEARCH,
                reasoning="Reference to past conversations, using semantic search",
                timestamp=now,
            )

        # Rule 2: medium-length continuation
        if input_len < 200:
            logger.info("Route: HOT_AND_WARM (continuation)")
            return RoutingDecision(
                user_input=user_input,
                session_id=session_id,
                persona_id=persona_id,
                context_need=ContextNeed.HOT_AND_WARM,
                reasoning="Regular conversation turn, loading hot and warm context",
                timestamp=now,
            )

        # Rule 5: long or complex input
        logger.info("Route: FULL (complex/long input)")
        return RoutingDecision(
            user_input=user_input,
            session_id=session_id,
            persona_id=persona_id,
            context_need=ContextNeed.FULL,
            reasoning="Complex or long input, loading full context",
            timestamp=now,
        )

    async def assemble_context_async(
        self,
        decision: RoutingDecision,
        query_embedding: list[float] | None = None,
    ) -> AssembledContext:
        """Assemble context based on routing decision (async, for PgMemoryStore)."""
        store: PgMemoryStore = self._store  # type: ignore
        ctx = AssembledContext(routing_decision=decision)

        need = decision.context_need

        # Permanent is always loaded unless NONE
        if need != ContextNeed.NONE:
            ctx.permanent_memories = await store.get_permanent(
                decision.persona_id
            )

        # Hot memories
        if need in (
            ContextNeed.HOT_ONLY,
            ContextNeed.HOT_AND_WARM,
            ContextNeed.FULL,
        ):
            hot = await store.get_session_memories(
                decision.session_id, MemoryType.HOT
            )
            ctx.hot_memories = hot[: settings.hot_memory_window]

        # Warm memories
        if need in (ContextNeed.HOT_AND_WARM, ContextNeed.FULL):
            ctx.warm_memories = await store.get_session_memories(
                decision.session_id, MemoryType.WARM
            )

        # Cold memories (semantic search)
        if need in (ContextNeed.SEMANTIC_SEARCH, ContextNeed.FULL):
            if query_embedding:
                ctx.cold_memories = await store.search_semantic(
                    query_embedding=query_embedding,
                    persona_id=decision.persona_id,
                    top_k=settings.cold_search_top_k,
                )
            else:
                logger.warning(
                    "Semantic search requested but no query_embedding provided"
                )

        ctx.total_fragments = (
            len(ctx.permanent_memories)
            + len(ctx.hot_memories)
            + len(ctx.warm_memories)
            + len(ctx.cold_memories)
        )

        logger.info(
            "Assembled context: %d fragments "
            "(perm=%d hot=%d warm=%d cold=%d)",
            ctx.total_fragments,
            len(ctx.permanent_memories),
            len(ctx.hot_memories),
            len(ctx.warm_memories),
            len(ctx.cold_memories),
        )
        return ctx

    def assemble_context_sync(
        self,
        decision: RoutingDecision,
        query_embedding: list[float] | None = None,
    ) -> AssembledContext:
        """Assemble context based on routing decision (sync, for SqliteMemoryStore)."""
        store: SqliteMemoryStore = self._store  # type: ignore
        ctx = AssembledContext(routing_decision=decision)

        need = decision.context_need

        if need != ContextNeed.NONE:
            ctx.permanent_memories = store.get_permanent(
                decision.persona_id
            )

        if need in (
            ContextNeed.HOT_ONLY,
            ContextNeed.HOT_AND_WARM,
            ContextNeed.FULL,
        ):
            hot = store.get_session_memories(
                decision.session_id, MemoryType.HOT
            )
            ctx.hot_memories = hot[: settings.hot_memory_window]

        if need in (ContextNeed.HOT_AND_WARM, ContextNeed.FULL):
            ctx.warm_memories = store.get_session_memories(
                decision.session_id, MemoryType.WARM
            )

        if need in (ContextNeed.SEMANTIC_SEARCH, ContextNeed.FULL):
            if query_embedding:
                ctx.cold_memories = store.search_semantic(
                    query_embedding=query_embedding,
                    persona_id=decision.persona_id,
                    top_k=settings.cold_search_top_k,
                )

        ctx.total_fragments = (
            len(ctx.permanent_memories)
            + len(ctx.hot_memories)
            + len(ctx.warm_memories)
            + len(ctx.cold_memories)
        )
        return ctx
