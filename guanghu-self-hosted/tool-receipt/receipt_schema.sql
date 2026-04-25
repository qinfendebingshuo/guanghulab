-- Tool Receipt System · Schema
-- PY-A04-20260425-002
-- Database: PostgreSQL 15+ (PersonaDB instance)
-- Reference: HLDP-ARCH-001 L2 Tool Receipt System

CREATE TABLE IF NOT EXISTS tool_receipts (
    receipt_id      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      VARCHAR(255)    NOT NULL,
    persona_id      VARCHAR(255)    NOT NULL,
    tool_name       VARCHAR(255)    NOT NULL,
    input_params    JSONB           NOT NULL DEFAULT '{}',
    output          JSONB,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'success', 'error', 'timeout')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    duration_ms     INTEGER
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_receipts_session
    ON tool_receipts(session_id);

CREATE INDEX IF NOT EXISTS idx_receipts_persona
    ON tool_receipts(persona_id);

CREATE INDEX IF NOT EXISTS idx_receipts_status
    ON tool_receipts(status);

CREATE INDEX IF NOT EXISTS idx_receipts_created_at
    ON tool_receipts(created_at DESC);

-- Composite index for session + persona queries
CREATE INDEX IF NOT EXISTS idx_receipts_session_persona
    ON tool_receipts(session_id, persona_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_receipt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_receipt_updated ON tool_receipts;
CREATE TRIGGER trg_receipt_updated
    BEFORE UPDATE ON tool_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_receipt_timestamp();
