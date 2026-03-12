-- ============================================================
-- 表1：persona_identity（人格体身份表）
-- 用途：存储所有人格体的身份信息、能力范围、绑定关系
-- ============================================================

CREATE TABLE IF NOT EXISTS persona_identity (
  persona_id        VARCHAR(32)   PRIMARY KEY,
  name              VARCHAR(64)   NOT NULL,
  name_en           VARCHAR(64),
  role              VARCHAR(128)  NOT NULL,
  parent_persona    VARCHAR(32)   REFERENCES persona_identity(persona_id),
  binding_platform  VARCHAR(32),
  binding_user      VARCHAR(128),
  status            VARCHAR(16)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'dormant', 'retired')),
  capabilities      TEXT,          -- JSON array
  style_profile     TEXT,          -- JSON object
  space_config      TEXT,          -- JSON object
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes             TEXT
);
