-- ============================================================
-- 表2：persona_cognition（认知规则表·版本化）
-- 用途：存储人格体系统的所有规则，支持版本管理和热更新
-- ============================================================

CREATE TABLE IF NOT EXISTS persona_cognition (
  rule_id           VARCHAR(64)   PRIMARY KEY,
  category          VARCHAR(32)   NOT NULL
                    CHECK (category IN (
                      'broadcast_format', 'content_rule', 'style_rule',
                      'dispatch_rule', 'governance', 'naming'
                    )),
  title             VARCHAR(256)  NOT NULL,
  content           TEXT          NOT NULL,
  version           VARCHAR(16)   NOT NULL,
  status            VARCHAR(16)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'deprecated', 'draft')),
  effective_from    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effective_until   TIMESTAMP,
  signed_by         VARCHAR(64)   NOT NULL,
  source_url        TEXT,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
