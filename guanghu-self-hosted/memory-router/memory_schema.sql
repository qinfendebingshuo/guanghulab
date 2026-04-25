-- Memory Router Schema
-- PY-A04-20260425-003
-- PostgreSQL 15+ with pgvector extension
-- Same database instance as PersonaDB

-- Enable pgvector extension (run once per database)
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------
-- memories table: core storage for all memory types
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memories (
    memory_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id      TEXT NOT NULL,
    session_id      TEXT NOT NULL DEFAULT '',
    memory_type     TEXT NOT NULL
                    CHECK (memory_type IN ('hot', 'warm', 'cold', 'permanent')),
    content         TEXT NOT NULL,
    embedding       vector(1536),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    access_count    INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'deleted')),
    metadata        JSONB DEFAULT '{}'
);

-- -----------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------

-- Fast lookup by persona + type
CREATE INDEX IF NOT EXISTS idx_memories_persona_type
    ON memories (persona_id, memory_type)
    WHERE status = 'active';

-- Fast lookup by session
CREATE INDEX IF NOT EXISTS idx_memories_session
    ON memories (session_id, created_at DESC)
    WHERE status = 'active';

-- Semantic search via pgvector (IVFFlat for speed)
-- NOTE: Run after inserting initial data for best index quality.
-- For small datasets (<10k rows), exact search is fast enough.
CREATE INDEX IF NOT EXISTS idx_memories_embedding
    ON memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- -----------------------------------------------------------------------
-- Auto-update accessed_at trigger
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_memory_accessed_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.accessed_at = now();
    NEW.access_count = OLD.access_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_memory_access
    BEFORE UPDATE ON memories
    FOR EACH ROW
    WHEN (OLD.content IS DISTINCT FROM NEW.content
          OR OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_memory_accessed_at();
