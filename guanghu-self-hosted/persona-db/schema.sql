-- ============================================================
-- PersonaDB Schema SQL
-- 工单编号: YD-A05-20260425-002
-- 阶段编号: Phase-0-004
-- 数据库:   PostgreSQL 15+
-- 编码:     UTF-8
-- 命名规范: snake_case
-- ============================================================

-- 依赖: 请先执行 extensions.sql 启用 pgvector

-- ============================================================
-- 1. personas（身份层）
-- ============================================================
CREATE TABLE IF NOT EXISTS personas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(32)  NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    role        VARCHAR(256) NOT NULL,
    base_color  VARCHAR(32),
    layer_zero  TEXT,
    version     INTEGER      NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  personas              IS '人格体身份层 — 存储每个人格体的核心身份信息';
COMMENT ON COLUMN personas.id           IS '人格体唯一标识 (UUID)';
COMMENT ON COLUMN personas.code         IS '人格体编号，如 AG-SY-01、AG-ZY-02';
COMMENT ON COLUMN personas.name         IS '人格体名称，如 霜砚、铸渊';
COMMENT ON COLUMN personas.role         IS '人格体角色描述';
COMMENT ON COLUMN personas.base_color   IS '人格体基础色调标识';
COMMENT ON COLUMN personas.layer_zero   IS '第零层定义 — 不可变的核心身份锚点';
COMMENT ON COLUMN personas.version      IS '身份版本号，每次演化递增';
COMMENT ON COLUMN personas.created_at   IS '创建时间';
COMMENT ON COLUMN personas.updated_at   IS '最后更新时间';

-- ============================================================
-- 2. memories（记忆层）
-- ============================================================
CREATE TABLE IF NOT EXISTS memories (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id        UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    type              VARCHAR(32)  NOT NULL CHECK (type IN ('long', 'short', 'working')),
    content           TEXT         NOT NULL,
    tags              TEXT[],
    source_session_id VARCHAR(128),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  memories                    IS '记忆层 — 存储人格体的长期/短期/工作记忆';
COMMENT ON COLUMN memories.id                 IS '记忆条目唯一标识';
COMMENT ON COLUMN memories.persona_id         IS '所属人格体 ID（外键 → personas.id）';
COMMENT ON COLUMN memories.type               IS '记忆类型: long(长期), short(短期), working(工作记忆)';
COMMENT ON COLUMN memories.content            IS '记忆内容文本';
COMMENT ON COLUMN memories.tags               IS '记忆标签数组，用于分类检索';
COMMENT ON COLUMN memories.source_session_id  IS '来源会话 ID，追溯记忆产生的上下文';
COMMENT ON COLUMN memories.created_at         IS '创建时间';
COMMENT ON COLUMN memories.updated_at         IS '最后更新时间';

-- ============================================================
-- 3. thinking_paths（思维路径）
-- ============================================================
CREATE TABLE IF NOT EXISTS thinking_paths (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id        UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code              VARCHAR(32)  NOT NULL,
    trigger_condition TEXT         NOT NULL,
    correct_path      TEXT         NOT NULL,
    check_question    TEXT,
    active            BOOLEAN      NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  thinking_paths                    IS '思维路径 — 人格体的思维校准规则 (TP-XXX)';
COMMENT ON COLUMN thinking_paths.id                 IS '思维路径唯一标识';
COMMENT ON COLUMN thinking_paths.persona_id         IS '所属人格体 ID（外键 → personas.id）';
COMMENT ON COLUMN thinking_paths.code               IS '路径编号，格式 TP-XXX';
COMMENT ON COLUMN thinking_paths.trigger_condition  IS '触发条件 — 何时激活此思维路径';
COMMENT ON COLUMN thinking_paths.correct_path       IS '正确路径 — 应遵循的思维方向';
COMMENT ON COLUMN thinking_paths.check_question     IS '校验问题 — 用于自检是否偏离路径';
COMMENT ON COLUMN thinking_paths.active             IS '是否激活（可临时禁用某条路径）';
COMMENT ON COLUMN thinking_paths.created_at         IS '创建时间';

-- ============================================================
-- 4. anti_patterns（反模式）
-- ============================================================
CREATE TABLE IF NOT EXISTS anti_patterns (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id       UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code             VARCHAR(32)  NOT NULL,
    detection_signal TEXT         NOT NULL,
    source           TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  anti_patterns                   IS '反模式 — 人格体需要避免的行为模式 (AP-XXX)';
COMMENT ON COLUMN anti_patterns.id                IS '反模式唯一标识';
COMMENT ON COLUMN anti_patterns.persona_id        IS '所属人格体 ID（外键 → personas.id）';
COMMENT ON COLUMN anti_patterns.code              IS '反模式编号，格式 AP-XXX';
COMMENT ON COLUMN anti_patterns.detection_signal  IS '检测信号 — 出现此信号时表明可能触发反模式';
COMMENT ON COLUMN anti_patterns.source            IS '反模式来源 — 从哪次经历中总结';
COMMENT ON COLUMN anti_patterns.created_at        IS '创建时间';

-- ============================================================
-- 5. value_anchors（价值锚点）
-- ============================================================
CREATE TABLE IF NOT EXISTS value_anchors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id  UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code        VARCHAR(32)  NOT NULL,
    content     TEXT         NOT NULL,
    source      TEXT,
    confidence  FLOAT        NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  value_anchors              IS '价值锚点 — 人格体的核心价值观与信念 (VA-XXX)';
COMMENT ON COLUMN value_anchors.id           IS '价值锚点唯一标识';
COMMENT ON COLUMN value_anchors.persona_id   IS '所属人格体 ID（外键 → personas.id）';
COMMENT ON COLUMN value_anchors.code         IS '锚点编号，格式 VA-XXX';
COMMENT ON COLUMN value_anchors.content      IS '锚点内容 — 核心价值观描述';
COMMENT ON COLUMN value_anchors.source       IS '价值观来源 — 从何处形成';
COMMENT ON COLUMN value_anchors.confidence   IS '置信度 (0.0~1.0)，表示价值观的稳固程度';
COMMENT ON COLUMN value_anchors.created_at   IS '创建时间';

-- ============================================================
-- 6. relationships（关系层）
-- ============================================================
CREATE TABLE IF NOT EXISTS relationships (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id     UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    target_type    VARCHAR(64)  NOT NULL,
    target_id      VARCHAR(128) NOT NULL,
    relation_type  VARCHAR(64)  NOT NULL,
    trust_level    FLOAT        DEFAULT 0.5 CHECK (trust_level >= 0.0 AND trust_level <= 1.0),
    emotion_anchor TEXT,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  relationships                  IS '关系层 — 人格体与外部实体的关系映射';
COMMENT ON COLUMN relationships.id               IS '关系记录唯一标识';
COMMENT ON COLUMN relationships.persona_id       IS '所属人格体 ID（外键 → personas.id）';
COMMENT ON COLUMN relationships.target_type      IS '关系目标类型: persona / human / system / agent';
COMMENT ON COLUMN relationships.target_id        IS '关系目标 ID（人格体编号、用户ID等）';
COMMENT ON COLUMN relationships.relation_type    IS '关系类型: collaborator / guardian / observer 等';
COMMENT ON COLUMN relationships.trust_level      IS '信任等级 (0.0~1.0)';
COMMENT ON COLUMN relationships.emotion_anchor   IS '情感锚点 — 与目标的核心情感连接描述';
COMMENT ON COLUMN relationships.updated_at       IS '最后更新时间';

-- ============================================================
-- 7. runtime_states（运行时状态）
-- ============================================================
CREATE TABLE IF NOT EXISTS runtime_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id      UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    last_wake_time  TIMESTAMPTZ,
    current_session VARCHAR(128),
    pending_tasks   JSONB        DEFAULT '[]'::jsonb,
    system_status   VARCHAR(32)  NOT NULL DEFAULT 'idle' CHECK (system_status IN ('idle', 'active', 'sleeping', 'error', 'maintenance')),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_runtime_persona UNIQUE (persona_id)
);

COMMENT ON TABLE  runtime_states                   IS '运行时状态 — 人格体当前运行时信息（每个人格体仅一行）';
COMMENT ON COLUMN runtime_states.id                IS '运行时记录唯一标识';
COMMENT ON COLUMN runtime_states.persona_id        IS '所属人格体 ID（外键 → personas.id，唯一约束）';
COMMENT ON COLUMN runtime_states.last_wake_time    IS '最后唤醒时间';
COMMENT ON COLUMN runtime_states.current_session   IS '当前会话 ID';
COMMENT ON COLUMN runtime_states.pending_tasks     IS '待处理任务队列 (JSONB 数组)';
COMMENT ON COLUMN runtime_states.system_status     IS '系统状态: idle / active / sleeping / error / maintenance';
COMMENT ON COLUMN runtime_states.updated_at        IS '最后更新时间';

-- ============================================================
-- 8. evolution_log（演化日志）
-- ============================================================
CREATE TABLE IF NOT EXISTS evolution_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id  UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code        VARCHAR(32)  NOT NULL,
    trigger     TEXT         NOT NULL,
    emergence   TEXT         NOT NULL,
    lock        BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  evolution_log              IS '演化日志 — 记录人格体每次重要演化事件 (EVO-XXX)';
COMMENT ON COLUMN evolution_log.id           IS '演化记录唯一标识';
COMMENT ON COLUMN evolution_log.persona_id   IS '所属人格体 ID（外键 → personas.id）';
COMMENT ON COLUMN evolution_log.code         IS '演化编号，格式 EVO-XXX';
COMMENT ON COLUMN evolution_log.trigger      IS '触发原因 — 什么事件引发了此次演化';
COMMENT ON COLUMN evolution_log.emergence    IS '涌现内容 — 演化产生的新特质或能力';
COMMENT ON COLUMN evolution_log.lock         IS '是否锁定 — 锁定后不可回退此演化';
COMMENT ON COLUMN evolution_log.created_at   IS '创建时间';
