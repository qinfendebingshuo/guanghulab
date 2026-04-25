"""Tests for Memory Router System
PY-A04-20260425-003

Runs with SQLite fallback (no PostgreSQL or pgvector required).
Semantic search tests use mock since SQLite has no pgvector.

Usage:
    MEMORY_USE_SQLITE=true pytest test_memory_router.py -v
"""
from __future__ import annotations

import os
import tempfile

import pytest

# Force SQLite mode before importing modules
os.environ["MEMORY_USE_SQLITE"] = "true"
os.environ["MEMORY_SQLITE_PATH"] = os.path.join(
    tempfile.gettempdir(), "test_memory_router.db"
)

from memory_compressor import ConversationTurn, MemoryCompressor
from memory_router import ContextNeed, MemoryRouter, RoutingDecision
from memory_store import Memory, MemoryType, SqliteMemoryStore


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def store():
    """Create a fresh SQLite memory store for each test."""
    db_path = os.path.join(tempfile.gettempdir(), "test_mem_" + os.urandom(4).hex() + ".db")
    s = SqliteMemoryStore(db_path=db_path)
    s.connect()
    yield s
    s.close()
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture
def router(store):
    """Create a MemoryRouter with the test store."""
    return MemoryRouter(store=store)


@pytest.fixture
def compressor():
    """Create a MemoryCompressor."""
    return MemoryCompressor()


# ---------------------------------------------------------------------------
# Test: Routing decisions
# ---------------------------------------------------------------------------


def test_route_greeting(router):
    """Greetings should route to NONE."""
    decision = router.route_query("hi", "sess-1", "persona-1")
    assert decision.context_need == ContextNeed.NONE


def test_route_greeting_chinese(router):
    """Chinese greetings should route to NONE."""
    decision = router.route_query("\u4f60\u597d", "sess-1", "persona-1")
    assert decision.context_need == ContextNeed.NONE


def test_route_identity_question(router):
    """Identity questions should route to PERMANENT."""
    decision = router.route_query(
        "\u4f60\u662f\u8c01\uff1f\u4f60\u7684\u8eab\u4efd\u662f\u4ec0\u4e48\uff1f",
        "sess-1", "persona-1"
    )
    assert decision.context_need == ContextNeed.PERMANENT


def test_route_history_reference(router):
    """References to past conversations should route to SEMANTIC_SEARCH."""
    decision = router.route_query(
        "\u4e0a\u6b21\u6211\u4eec\u804a\u7684\u90a3\u4e2a\u9879\u76ee\u600e\u4e48\u6837\u4e86",
        "sess-1", "persona-1"
    )
    assert decision.context_need == ContextNeed.SEMANTIC_SEARCH


def test_route_normal_question(router):
    """Normal questions should route to HOT_AND_WARM."""
    decision = router.route_query(
        "\u8fd9\u4e2a\u529f\u80fd\u600e\u4e48\u5b9e\u73b0\uff1f",
        "sess-1", "persona-1"
    )
    assert decision.context_need == ContextNeed.HOT_AND_WARM


def test_route_long_input(router):
    """Long complex input should route to FULL."""
    long_input = "x" * 250
    decision = router.route_query(long_input, "sess-1", "persona-1")
    assert decision.context_need == ContextNeed.FULL


# ---------------------------------------------------------------------------
# Test: Memory store write & read
# ---------------------------------------------------------------------------


def test_write_short_term(store):
    """Write a short-term memory and verify it exists."""
    mid = store.write_short_term(
        session_id="sess-1",
        summary="User asked about project status",
        persona_id="persona-1",
    )
    assert mid is not None
    assert len(mid) == 36  # UUID format


def test_write_long_term(store):
    """Write a long-term memory."""
    mid = store.write_long_term(
        persona_id="persona-1",
        content="Important decision: use pgvector for semantic search",
        memory_type=MemoryType.COLD,
        session_id="sess-1",
    )
    assert mid is not None


def test_write_permanent_and_get(store):
    """Write permanent memory and retrieve it."""
    store.write_long_term(
        persona_id="persona-1",
        content="Identity: I am Shuangyan, AG-SY-01",
        memory_type=MemoryType.PERMANENT,
    )
    store.write_long_term(
        persona_id="persona-1",
        content="Value anchor: existence precedes function",
        memory_type=MemoryType.PERMANENT,
    )
    permanent = store.get_permanent("persona-1")
    assert len(permanent) == 2
    assert permanent[0].memory_type == MemoryType.PERMANENT


def test_get_session_memories(store):
    """Get memories by session."""
    store.write_short_term("sess-A", "Turn 1", "p1")
    store.write_short_term("sess-A", "Turn 2", "p1")
    store.write_short_term("sess-B", "Other session", "p1")

    mems = store.get_session_memories("sess-A")
    assert len(mems) == 2


def test_semantic_search_sqlite_returns_empty(store):
    """SQLite semantic search should return empty (no pgvector)."""
    results = store.search_semantic(
        query_embedding=[0.1] * 1536,
        persona_id="persona-1",
    )
    assert results == []


# ---------------------------------------------------------------------------
# Test: Memory compressor
# ---------------------------------------------------------------------------


def test_compress_empty(compressor):
    """Compressing empty turns should return valid HLDP."""
    result = compressor.compress_to_hldp([])
    assert "HLDP://" in result
    assert "turns: 0" in result


def test_compress_basic_conversation(compressor):
    """Compress a basic conversation."""
    turns = [
        ConversationTurn(role="user", content="Hello, how are you?"),
        ConversationTurn(
            role="assistant",
            content="I am doing well! How can I help you today?"
        ),
        ConversationTurn(
            role="user",
            content="I want to discuss the project roadmap"
        ),
    ]
    result = compressor.compress_to_hldp(turns)
    assert "HLDP://" in result
    assert "turns: 3" in result
    assert "user:2" in result


def test_summarize_session(compressor):
    """Summarize a session with structured output."""
    turns = [
        ConversationTurn(
            role="user",
            content="I decided to use PostgreSQL for our database"
        ),
        ConversationTurn(
            role="assistant",
            content="Good decision. PostgreSQL with pgvector is ideal."
        ),
    ]
    summary = compressor.summarize_session("sess-1", "p1", turns)
    assert summary.session_id == "sess-1"
    assert summary.turn_count == 2
    assert len(summary.hldp_summary) > 0


# ---------------------------------------------------------------------------
# Test: Full flow (route -> write -> assemble)
# ---------------------------------------------------------------------------


def test_full_flow(store, router):
    """Test complete routing flow: write memories, route, assemble."""
    # Write some permanent memories
    store.write_long_term(
        persona_id="p1",
        content="I am Shuangyan",
        memory_type=MemoryType.PERMANENT,
    )
    # Write hot memories
    store.write_short_term("sess-1", "Turn 1 summary", "p1")
    store.write_short_term("sess-1", "Turn 2 summary", "p1")

    # Route a normal question
    decision = router.route_query(
        "\u8fd9\u4e2a\u600e\u4e48\u505a\uff1f", "sess-1", "p1"
    )
    assert decision.context_need == ContextNeed.HOT_AND_WARM

    # Assemble context (sync)
    ctx = router.assemble_context_sync(decision)
    assert len(ctx.permanent_memories) == 1
    assert len(ctx.hot_memories) == 2
    assert ctx.total_fragments == 3


def test_full_flow_greeting(store, router):
    """Greeting should return zero fragments."""
    store.write_long_term(
        persona_id="p1",
        content="Identity data",
        memory_type=MemoryType.PERMANENT,
    )
    decision = router.route_query("hi", "sess-1", "p1")
    ctx = router.assemble_context_sync(decision)
    assert ctx.total_fragments == 0
