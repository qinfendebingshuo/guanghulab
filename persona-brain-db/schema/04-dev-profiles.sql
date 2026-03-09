-- ============================================================
-- 表4：dev_profiles（开发者画像表）
-- 用途：存储所有开发者的画像数据，供人格体引导时参考
-- ============================================================

CREATE TABLE IF NOT EXISTS dev_profiles (
  dev_id            VARCHAR(16)   PRIMARY KEY,
  name              VARCHAR(32)   NOT NULL,
  device_os         VARCHAR(64)   NOT NULL,
  current_module    VARCHAR(64),
  current_broadcast VARCHAR(64),
  guide_persona     VARCHAR(32)   REFERENCES persona_identity(persona_id),
  guide_line        VARCHAR(64),
  streak            INTEGER       NOT NULL DEFAULT 0,
  total_completed   INTEGER       NOT NULL DEFAULT 0,
  capabilities      TEXT,          -- JSON array
  friction_points   TEXT,          -- JSON array
  emotion_baseline  VARCHAR(64),
  last_syslog_at    TIMESTAMP,
  last_active_at    TIMESTAMP,
  pca_score         TEXT,          -- JSON object
  status            VARCHAR(16)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'retired')),
  notes             TEXT,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
