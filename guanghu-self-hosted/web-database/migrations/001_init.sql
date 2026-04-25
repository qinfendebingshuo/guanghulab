-- ============================================================
-- migrations/001_init.sql · 光湖工单数据库初始化迁移
-- GH-DB-001 · Phase-NOW-003
-- 可复现一键迁移 · 包含 schema + indexes + seed
-- PostgreSQL 15+ · UTF-8 · snake_case
-- 前置依赖: PersonaDB (extensions.sql + schema.sql · personas 表须已存在)
-- ============================================================

BEGIN;

-- ==================== 公用函数 ====================

CREATE OR REPLACE FUNCTION gh_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================== 枚举类型 ====================

CREATE TYPE gh_work_order_status AS ENUM (
    'pending', 'developing', 'self_checking', 'reviewing',
    'approved', 'completed', 'suspended'
);

CREATE TYPE gh_work_order_priority AS ENUM ('P0', 'P1', 'P2');
CREATE TYPE gh_agent_status AS ENUM ('online', 'offline', 'busy');
CREATE TYPE gh_execution_action AS ENUM ('claimed', 'started', 'self_checked', 'submitted', 'reviewed');
CREATE TYPE gh_review_result AS ENUM ('pass', 'fail', 'revision_needed');
CREATE TYPE gh_message_type AS ENUM ('text', 'command', 'system');

-- ==================== 表定义 ====================

-- 1. agents
CREATE TABLE agents (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(16)       NOT NULL UNIQUE,
    name            VARCHAR(64)       NOT NULL,
    role            VARCHAR(128),
    status          gh_agent_status   NOT NULL DEFAULT 'offline',
    last_heartbeat  TIMESTAMPTZ,
    boot_config_ref TEXT,
    persona_db_ref  UUID              REFERENCES personas(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- 2. work_orders
CREATE TABLE work_orders (
    id                UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(64)             NOT NULL UNIQUE,
    title             VARCHAR(256)            NOT NULL,
    status            gh_work_order_status    NOT NULL DEFAULT 'pending',
    assigned_agent    UUID                    REFERENCES agents(id) ON DELETE SET NULL,
    priority          gh_work_order_priority  NOT NULL DEFAULT 'P2',
    phase             VARCHAR(64),
    dev_content       TEXT,
    constraints       TEXT,
    branch_name       VARCHAR(128),
    repo_path         VARCHAR(256),
    self_check_result TEXT,
    review_result     TEXT,
    next_guide        TEXT,
    created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_work_orders_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION gh_set_updated_at();

-- 3. execution_logs
CREATE TABLE execution_logs (
    id          UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID                 NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    agent_id    UUID                 NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    action      gh_execution_action  NOT NULL,
    git_commit  VARCHAR(64),
    detail      JSONB,
    created_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- 4. review_records
CREATE TABLE review_records (
    id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID              NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    reviewer    VARCHAR(64)       NOT NULL,
    result      gh_review_result  NOT NULL,
    detail      TEXT,
    created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- 5. chat_messages
CREATE TABLE chat_messages (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sender      VARCHAR(64)     NOT NULL,
    receiver    VARCHAR(64)     NOT NULL,
    content     TEXT            NOT NULL,
    msg_type    gh_message_type NOT NULL DEFAULT 'text',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ==================== 索引 ====================

CREATE INDEX idx_work_orders_status_agent ON work_orders (status, assigned_agent);
CREATE INDEX idx_work_orders_created_at_desc ON work_orders (created_at DESC);
CREATE INDEX idx_execution_logs_order_created ON execution_logs (order_id, created_at);
CREATE INDEX idx_execution_logs_agent ON execution_logs (agent_id);
CREATE INDEX idx_review_records_order ON review_records (order_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender_created ON chat_messages (sender, created_at DESC);
CREATE INDEX idx_chat_messages_receiver_created ON chat_messages (receiver, created_at DESC);

-- ==================== 初始数据 ====================

INSERT INTO agents (code, name, role, status, boot_config_ref) VALUES
    ('A05',    '译典',    '配置开发', 'offline', '/guanghu-self-hosted/boot-protocol/boot.yaml'),
    ('A04',    '培园',    'API开发',  'offline', '/guanghu-self-hosted/boot-protocol/boot.yaml'),
    ('A02',    '录册',    '前端开发', 'offline', '/guanghu-self-hosted/boot-protocol/boot.yaml'),
    ('SY-WEB', '霜砚Web', '审核',     'offline', '/guanghu-self-hosted/boot-protocol/boot.yaml');

COMMIT;
