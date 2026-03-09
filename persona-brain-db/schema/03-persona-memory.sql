-- ============================================================
-- 表3：persona_memory（长期记忆表）
-- 用途：存储人格体的长期记忆，包括关键事件、决策依据、情感锚点
-- ============================================================

CREATE TABLE IF NOT EXISTS persona_memory (
  memory_id         VARCHAR(64)   PRIMARY KEY,
  persona_id        VARCHAR(32)   NOT NULL
                    REFERENCES persona_identity(persona_id),
  type              VARCHAR(16)   NOT NULL
                    CHECK (type IN (
                      'event', 'decision', 'emotion', 'milestone', 'learning'
                    )),
  title             VARCHAR(256)  NOT NULL,
  content           TEXT          NOT NULL,
  importance        INTEGER       NOT NULL CHECK (importance BETWEEN 1 AND 10),
  related_dev       VARCHAR(16),
  related_broadcast VARCHAR(64),
  tags              TEXT,          -- JSON array
  timestamp         TIMESTAMP     NOT NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
