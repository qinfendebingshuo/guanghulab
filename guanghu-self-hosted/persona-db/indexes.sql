-- ============================================================
-- PersonaDB Indexes SQL
-- 工单编号: YD-A05-20260425-002
-- 阶段编号: Phase-0-004
-- 数据库:   PostgreSQL 15+ with pgvector
-- ============================================================
-- 执行顺序: extensions.sql → schema.sql → indexes.sql → seed.sql
-- ============================================================

-- ============================================================
-- personas 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_personas_code
    ON personas (code);

CREATE INDEX IF NOT EXISTS idx_personas_created_at
    ON personas (created_at DESC);

-- ============================================================
-- memories 索引
-- ============================================================
-- persona_id + type 组合索引（最常用查询模式）
CREATE INDEX IF NOT EXISTS idx_memories_persona_type
    ON memories (persona_id, type);

-- 时间索引（按时间排序查询记忆）
CREATE INDEX IF NOT EXISTS idx_memories_created_at
    ON memories (created_at DESC);

-- persona_id + 时间组合索引
CREATE INDEX IF NOT EXISTS idx_memories_persona_created
    ON memories (persona_id, created_at DESC);

-- GIN 索引用于 tags 数组查询
CREATE INDEX IF NOT EXISTS idx_memories_tags
    ON memories USING GIN (tags);

-- HNSW 向量索引用于语义搜索（需要 pgvector）
CREATE INDEX IF NOT EXISTS idx_memories_embedding
    ON memories USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- thinking_paths 索引
-- ============================================================
-- persona_id + active 组合索引
CREATE INDEX IF NOT EXISTS idx_thinking_paths_persona_active
    ON thinking_paths (persona_id, active);

CREATE INDEX IF NOT EXISTS idx_thinking_paths_code
    ON thinking_paths (code);

CREATE INDEX IF NOT EXISTS idx_thinking_paths_created_at
    ON thinking_paths (created_at DESC);

-- HNSW 向量索引用于语义匹配思维路径
CREATE INDEX IF NOT EXISTS idx_thinking_paths_embedding
    ON thinking_paths USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- anti_patterns 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_anti_patterns_persona
    ON anti_patterns (persona_id);

CREATE INDEX IF NOT EXISTS idx_anti_patterns_code
    ON anti_patterns (code);

-- ============================================================
-- value_anchors 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_value_anchors_persona
    ON value_anchors (persona_id);

CREATE INDEX IF NOT EXISTS idx_value_anchors_code
    ON value_anchors (code);

CREATE INDEX IF NOT EXISTS idx_value_anchors_confidence
    ON value_anchors (persona_id, confidence DESC);

-- ============================================================
-- relationships 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_relationships_persona
    ON relationships (persona_id);

CREATE INDEX IF NOT EXISTS idx_relationships_target
    ON relationships (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_relationships_persona_type
    ON relationships (persona_id, relation_type);

-- ============================================================
-- runtime_states 索引
-- ============================================================
-- persona_id 已有唯一约束，自动创建索引
CREATE INDEX IF NOT EXISTS idx_runtime_states_status
    ON runtime_states (system_status);

-- ============================================================
-- evolution_log 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_evolution_log_persona
    ON evolution_log (persona_id);

CREATE INDEX IF NOT EXISTS idx_evolution_log_code
    ON evolution_log (code);

CREATE INDEX IF NOT EXISTS idx_evolution_log_persona_created
    ON evolution_log (persona_id, created_at DESC);
