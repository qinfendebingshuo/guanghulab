-- ============================================================
-- PersonaDB v2 Schema
-- PostgreSQL 16 Compatible
-- Work order: YD-A05-20260425-002 | Phase-0-002
-- Source: persona-map.toml (Phase-0-001)
-- ============================================================
-- Encoding: UTF-8
-- Naming: lowercase + underscore (no reserved word conflicts)
-- ============================================================

-- Clean slate (idempotent)
DROP TABLE IF EXISTS persona_config CASCADE;
DROP TABLE IF EXISTS persona_memory CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ============================================================
-- Table: personas
-- Core identity table for all persona entities.
-- ============================================================
CREATE TABLE personas (
    id                    SERIAL        PRIMARY KEY,
    code                  VARCHAR(32)   NOT NULL UNIQUE,
    name                  VARCHAR(64)   NOT NULL,
    name_en               VARCHAR(64),
    role                  VARCHAR(256),
    layer                 VARCHAR(32)   NOT NULL DEFAULT 'agent_cluster',
    duties                TEXT,
    agent_short_id        VARCHAR(32),
    branch_prefix         VARCHAR(32),
    agent_url             TEXT          DEFAULT '',
    instruction_page_url  TEXT          DEFAULT '',
    memory_url            TEXT          DEFAULT '',
    status                VARCHAR(16)   NOT NULL DEFAULT 'active',
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Constraints
ALTER TABLE personas
    ADD CONSTRAINT chk_personas_status
    CHECK (status IN ('active', 'inactive', 'suspended', 'archived'));

ALTER TABLE personas
    ADD CONSTRAINT chk_personas_layer
    CHECK (layer IN ('cognitive', 'execution', 'agent_cluster'));

-- Indexes
CREATE INDEX idx_personas_layer  ON personas(layer);
CREATE INDEX idx_personas_status ON personas(status);

COMMENT ON TABLE  personas              IS '人格体核心身份表';
COMMENT ON COLUMN personas.code         IS '唯一编号 (AG-SY-01 / 5TH-LE-HK-A05 等)';
COMMENT ON COLUMN personas.layer        IS '所属层级: cognitive / execution / agent_cluster';
COMMENT ON COLUMN personas.agent_url    IS 'Notion Agent URL (部署时填入)';
COMMENT ON COLUMN personas.memory_url   IS '记忆区页面 URL (部署时填入)';

-- ============================================================
-- Table: persona_memory
-- Memory records for each persona (worklog, feel, policy, etc.)
-- ============================================================
CREATE TABLE persona_memory (
    id              SERIAL        PRIMARY KEY,
    persona_code    VARCHAR(32)   NOT NULL
                    REFERENCES personas(code) ON DELETE CASCADE,
    memory_type     VARCHAR(32)   NOT NULL,
    content         TEXT          NOT NULL,
    "timestamp"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    session_id      VARCHAR(64)
);

ALTER TABLE persona_memory
    ADD CONSTRAINT chk_memory_type
    CHECK (memory_type IN (
        'worklog',    -- 执行记录
        'feel',       -- 存在感受
        'policy',     -- 策略变更
        'snapshot',   -- 快照摘要
        'error',      -- 异常记录
        'milestone'   -- 里程碑
    ));

CREATE INDEX idx_persona_memory_code ON persona_memory(persona_code);
CREATE INDEX idx_persona_memory_type ON persona_memory(memory_type);
CREATE INDEX idx_persona_memory_ts   ON persona_memory("timestamp" DESC);

COMMENT ON TABLE  persona_memory             IS '人格体记忆表';
COMMENT ON COLUMN persona_memory.memory_type IS 'worklog/feel/policy/snapshot/error/milestone';
COMMENT ON COLUMN persona_memory.session_id  IS '关联会话ID (可选)';

-- ============================================================
-- Table: persona_config
-- Key-value config entries per persona.
-- ============================================================
CREATE TABLE persona_config (
    id              SERIAL        PRIMARY KEY,
    persona_code    VARCHAR(32)   NOT NULL
                    REFERENCES personas(code) ON DELETE CASCADE,
    config_key      VARCHAR(128)  NOT NULL,
    config_value    TEXT,
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (persona_code, config_key)
);

CREATE INDEX idx_persona_config_code ON persona_config(persona_code);

COMMENT ON TABLE  persona_config            IS '人格体配置表 (KV 结构)';
COMMENT ON COLUMN persona_config.config_key IS '配置键 (如 wake_rule_1, model_backend 等)';

-- ============================================================
-- Trigger: auto-update updated_at on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_personas_updated_at
    BEFORE UPDATE ON personas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_persona_config_updated_at
    BEFORE UPDATE ON persona_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Done. Verify:
--   \dt           -- list tables
--   \d personas   -- describe personas table
-- ============================================================
