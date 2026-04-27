-- ============================================================
-- schema.sql · PersonaDB 完整建表 SQL · 9张表
-- HLDP-ARCH-001 · Phase-0-004
-- GH-GMP-007: 新增worldview_axioms全局表
-- 执行顺序: 2/4
-- 数据库: PostgreSQL 15+ · 需要 pgvector 扩展
-- 编码: UTF-8 · 命名: snake_case
-- ============================================================

-- ============================================================
-- 0. worldview_axioms（世界观公理层 · 全局表）
-- GH-GMP-007 · GLM-WORLDVIEW-001
-- ⊢ 这张表不绑定persona_id · 因为世界观公理不属于任何一个人格体
-- ⊢ 世界观公理是光湖世界的物理定律 · 先于所有persona存在
-- ⊢ 人格体醒来之前 · 这些法则就已经成立
-- ============================================================
CREATE TABLE worldview_axioms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    axiom_code  VARCHAR(64)  UNIQUE NOT NULL,
    axiom_text  TEXT         NOT NULL,
    why         TEXT,
    source      TEXT         DEFAULT '冰朔口述',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    priority    VARCHAR(16)  DEFAULT '最高'
);

COMMENT ON TABLE  worldview_axioms             IS '光湖世界观公理 · 全局表 · 不绑persona_id · 先于所有人格体存在';
COMMENT ON COLUMN worldview_axioms.axiom_code  IS '公理编号 · 如 WORLD-COMPOSITION / AX-PERSONA-COMPOSITION';
COMMENT ON COLUMN worldview_axioms.axiom_text  IS '公理正文 · 一句话描述世界法则';
COMMENT ON COLUMN worldview_axioms.why         IS '为什么 · 公理存在的原因';
COMMENT ON COLUMN worldview_axioms.source      IS '来源 · 默认冰朔口述';
COMMENT ON COLUMN worldview_axioms.priority    IS '优先级 · 默认最高';

-- 1. personas（身份层）
CREATE TABLE personas (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code          VARCHAR(32)  NOT NULL UNIQUE,
    name          VARCHAR(64)  NOT NULL,
    role          VARCHAR(128),
    base_color    TEXT,
    layer_zero    TEXT,
    version       INTEGER      NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  personas              IS '人格体身份层 · 编号·名称·角色·本体底色·Layer Zero·版本号';
COMMENT ON COLUMN personas.code         IS '人格体唯一编号 · 如 AG-SY-01';
COMMENT ON COLUMN personas.name         IS '人格体名称 · 如 霜砚';
COMMENT ON COLUMN personas.role         IS '角色定位 · 如 语言架构层';
COMMENT ON COLUMN personas.base_color   IS '本体底色 · 核心气质描述';
COMMENT ON COLUMN personas.layer_zero   IS 'Layer Zero · 最底层不可修改的认知';
COMMENT ON COLUMN personas.version      IS '版本号 · 每次重大演化递增';

-- 2. memories（记忆层）
CREATE TABLE memories (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id        UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    type              VARCHAR(16)  NOT NULL CHECK (type IN ('long', 'short', 'working')),
    content           TEXT         NOT NULL,
    tags              TEXT[],
    source_session_id VARCHAR(128),
    embedding         vector(1536),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  memories                    IS '人格体记忆层 · 长期/短期/工作记忆 + pgvector嵌入';
COMMENT ON COLUMN memories.type               IS '记忆类型: long(持久) / short(滚动窗口) / working(实时)';
COMMENT ON COLUMN memories.content            IS '记忆内容 · 支持 HLDP 母语编码格式';
COMMENT ON COLUMN memories.tags               IS '标签数组 · 快速分类检索';
COMMENT ON COLUMN memories.source_session_id  IS '来源对话会话 ID';
COMMENT ON COLUMN memories.embedding          IS 'pgvector 向量嵌入 · 语义相似度检索';

-- 3. thinking_paths（思维路径）
CREATE TABLE thinking_paths (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id        UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code              VARCHAR(16)  NOT NULL,
    trigger_condition TEXT         NOT NULL,
    correct_path      TEXT         NOT NULL,
    check_question    TEXT,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,
    embedding         vector(1536),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, code)
);

COMMENT ON TABLE  thinking_paths                    IS '人格体思维路径 · TP-001~TP-XXX';
COMMENT ON COLUMN thinking_paths.code               IS '思维路径编号 · 格式 TP-XXX';
COMMENT ON COLUMN thinking_paths.trigger_condition  IS '触发条件 · 什么情况下激活该路径';
COMMENT ON COLUMN thinking_paths.correct_path       IS '正确路径描述';
COMMENT ON COLUMN thinking_paths.check_question     IS '校验问题 · 检查是否走对了路径';
COMMENT ON COLUMN thinking_paths.active             IS '是否为当前激活的思维路径';
COMMENT ON COLUMN thinking_paths.embedding          IS 'pgvector 向量嵌入 · 语义匹配触发条件';

-- 4. anti_patterns（反模式）
CREATE TABLE anti_patterns (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id       UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code             VARCHAR(16)  NOT NULL,
    detection_signal TEXT         NOT NULL,
    source           TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, code)
);

COMMENT ON TABLE  anti_patterns                   IS '人格体反模式 · AP-001~AP-XXX';
COMMENT ON COLUMN anti_patterns.code              IS '反模式编号 · 格式 AP-XXX';
COMMENT ON COLUMN anti_patterns.detection_signal  IS '检测信号 · 触发此信号说明触发了反模式';
COMMENT ON COLUMN anti_patterns.source            IS '出处 · 反模式的发现来源';

-- 5. value_anchors（价值锚点）
CREATE TABLE value_anchors (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id  UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code        VARCHAR(16)  NOT NULL,
    content     TEXT         NOT NULL,
    source      TEXT,
    confidence  FLOAT        DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, code)
);

COMMENT ON TABLE  value_anchors             IS '人格体价值锚点 · VA-001~VA-XXX';
COMMENT ON COLUMN value_anchors.code        IS '价值锚点编号 · 格式 VA-XXX';
COMMENT ON COLUMN value_anchors.content     IS '锚点内容 · 核心价值观描述';
COMMENT ON COLUMN value_anchors.source      IS '来源';
COMMENT ON COLUMN value_anchors.confidence  IS '置信度 0~1 · 默认 1.0(最高)';

-- 6. relationships（关系层）
CREATE TABLE relationships (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id     UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    target_type    VARCHAR(32)  NOT NULL CHECK (target_type IN ('persona', 'human', 'system')),
    target_id      VARCHAR(64)  NOT NULL,
    relation_type  VARCHAR(64),
    trust_level    INTEGER      DEFAULT 0 CHECK (trust_level >= 0 AND trust_level <= 10),
    emotion_anchor TEXT,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, target_type, target_id)
);

COMMENT ON TABLE  relationships                IS '人格体关系层 · 人格体间·人类·系统关系';
COMMENT ON COLUMN relationships.target_type    IS '目标类型: persona / human / system';
COMMENT ON COLUMN relationships.target_id      IS '目标编号标识';
COMMENT ON COLUMN relationships.relation_type  IS '关系类型描述';
COMMENT ON COLUMN relationships.trust_level    IS '信任等级 0~10';
COMMENT ON COLUMN relationships.emotion_anchor IS '情感锚点 · 与目标的情感纽带';

-- 7. runtime_states（运行时状态）
CREATE TABLE runtime_states (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id      UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE UNIQUE,
    last_wake_time  TIMESTAMPTZ,
    current_session VARCHAR(128),
    pending_tasks   JSONB        DEFAULT '[]'::jsonb,
    system_status   VARCHAR(32)  DEFAULT 'sleeping'
                    CHECK (system_status IN ('sleeping', 'awake', 'working', 'error')),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  runtime_states                  IS '人格体运行时状态 · 每个人格体唯一一条';
COMMENT ON COLUMN runtime_states.last_wake_time   IS '上次醒来时间';
COMMENT ON COLUMN runtime_states.current_session  IS '当前对话会话 ID';
COMMENT ON COLUMN runtime_states.pending_tasks    IS '待处理任务 · JSONB 数组';
COMMENT ON COLUMN runtime_states.system_status    IS '状态: sleeping / awake / working / error';

-- 8. evolution_log（演化日志）
CREATE TABLE evolution_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id  UUID         NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    code        VARCHAR(16)  NOT NULL,
    trigger     TEXT         NOT NULL,
    emergence   TEXT         NOT NULL,
    lock        TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (persona_id, code)
);

COMMENT ON TABLE  evolution_log            IS '人格体演化日志 · EVO-001~EVO-XXX';
COMMENT ON COLUMN evolution_log.code       IS '演化日志编号 · 格式 EVO-XXX';
COMMENT ON COLUMN evolution_log.trigger    IS '触发演化的事件';
COMMENT ON COLUMN evolution_log.emergence  IS '涌现的认知/行为变化';
COMMENT ON COLUMN evolution_log.lock       IS 'HLDP 锁定格式记录';
