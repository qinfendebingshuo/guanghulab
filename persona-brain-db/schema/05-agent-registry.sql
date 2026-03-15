-- ============================================================
-- 表5：agent_registry（Agent注册表）
-- 用途：Phase C Agent集群的注册中心
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_registry (
  agent_id          VARCHAR(64)   PRIMARY KEY,
  name              VARCHAR(128)  NOT NULL,
  type              VARCHAR(32)   NOT NULL
                    CHECK (type IN (
                      'code_gen', 'deploy', 'test', 'ui_design',
                      'data_sync', 'review'
                    )),
  capabilities      TEXT,          -- JSON object
  api_endpoint      VARCHAR(256),
  status            VARCHAR(16)   NOT NULL DEFAULT 'registered'
                    CHECK (status IN (
                      'registered', 'active', 'suspended', 'retired'
                    )),
  performance       TEXT,          -- JSON object
  assigned_persona  VARCHAR(32)   REFERENCES persona_identity(persona_id),
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
