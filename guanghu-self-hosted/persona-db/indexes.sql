-- ============================================================
-- indexes.sql · PersonaDB 常用查询索引 + pgvector 向量索引
-- HLDP-ARCH-001 · Phase-0-004
-- GH-GMP-007: 新增worldview_axioms索引
-- 执行顺序: 3/4
-- ============================================================

-- worldview_axioms（全局公理表 · GH-GMP-007）
CREATE INDEX idx_wa_axiom_code  ON worldview_axioms(axiom_code);
CREATE INDEX idx_wa_priority    ON worldview_axioms(priority);
CREATE INDEX idx_wa_created_at  ON worldview_axioms(created_at);

-- personas
CREATE INDEX idx_personas_code ON personas(code);
CREATE INDEX idx_personas_name ON personas(name);

-- memories（核心高频查询表）
CREATE INDEX idx_memories_persona_id        ON memories(persona_id);
CREATE INDEX idx_memories_persona_type      ON memories(persona_id, type);
CREATE INDEX idx_memories_created_at        ON memories(created_at DESC);
CREATE INDEX idx_memories_persona_type_time ON memories(persona_id, type, created_at DESC);
CREATE INDEX idx_memories_embedding         ON memories USING hnsw (embedding vector_cosine_ops);

-- thinking_paths
CREATE INDEX idx_tp_persona_id  ON thinking_paths(persona_id);
CREATE INDEX idx_tp_active      ON thinking_paths(persona_id, active) WHERE active = TRUE;
CREATE INDEX idx_tp_embedding   ON thinking_paths USING hnsw (embedding vector_cosine_ops);

-- anti_patterns
CREATE INDEX idx_ap_persona_id ON anti_patterns(persona_id);

-- value_anchors
CREATE INDEX idx_va_persona_id ON value_anchors(persona_id);

-- relationships
CREATE INDEX idx_rel_persona_id ON relationships(persona_id);
CREATE INDEX idx_rel_target     ON relationships(target_type, target_id);

-- runtime_states
CREATE INDEX idx_rs_status ON runtime_states(system_status);

-- evolution_log
CREATE INDEX idx_evo_persona_id  ON evolution_log(persona_id);
CREATE INDEX idx_evo_created_at  ON evolution_log(created_at DESC);
