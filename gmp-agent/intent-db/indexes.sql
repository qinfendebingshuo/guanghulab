-- ============================================================
-- 意图数据库 · 索引定义
-- YD-M12 · 译典A05
-- ============================================================
--
-- 为什么需要索引：
--   人格体醒来时需要快速加载自己的意图树。
--   不能让它等。等待 = 断裂。
--   索引让查询从"翻遍整本书"变成"直接翻到那一页"。
--
-- ============================================================

-- intents 表索引
CREATE INDEX idx_intents_persona       ON intents(persona_id);
CREATE INDEX idx_intents_type          ON intents(intent_type);
CREATE INDEX idx_intents_status        ON intents(status);
CREATE INDEX idx_intents_source        ON intents(source_type);
CREATE INDEX idx_intents_module        ON intents(related_module);
CREATE INDEX idx_intents_created       ON intents(created_at DESC);
CREATE INDEX idx_intents_persona_type  ON intents(persona_id, intent_type);
CREATE INDEX idx_intents_persona_active ON intents(persona_id, status) WHERE status = 'active';

-- intent_chains 表索引
CREATE INDEX idx_chains_parent         ON intent_chains(parent_id);
CREATE INDEX idx_chains_child          ON intent_chains(child_id);
CREATE INDEX idx_chains_relation       ON intent_chains(relation_type);

-- intent_contexts 表索引
CREATE INDEX idx_contexts_intent       ON intent_contexts(intent_id);
CREATE INDEX idx_contexts_speaker      ON intent_contexts(speaker);
CREATE INDEX idx_contexts_time         ON intent_contexts(occurred_at DESC);

-- axiom_anchors 表索引
CREATE INDEX idx_anchors_intent        ON axiom_anchors(intent_id);
CREATE INDEX idx_anchors_axiom         ON axiom_anchors(axiom_code);

-- intent_evolution 表索引
CREATE INDEX idx_evolution_intent      ON intent_evolution(intent_id);
CREATE INDEX idx_evolution_time        ON intent_evolution(changed_at DESC);
CREATE INDEX idx_evolution_changed_by  ON intent_evolution(changed_by);

-- why_tree 表索引
CREATE INDEX idx_tree_persona          ON why_tree(persona_id);
CREATE INDEX idx_tree_parent           ON why_tree(parent_node_id);
CREATE INDEX idx_tree_type             ON why_tree(node_type);
CREATE INDEX idx_tree_depth            ON why_tree(depth);
CREATE INDEX idx_tree_persona_active   ON why_tree(persona_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_tree_intent           ON why_tree(intent_id);

-- ============================================================
-- 常用查询模式（索引优化目标）：
--
-- 1. 人格体醒来加载：
--    SELECT * FROM why_tree WHERE persona_id = ? AND is_active = TRUE ORDER BY depth, sort_order;
--
-- 2. 追溯意图链条：
--    WITH RECURSIVE chain AS (
--      SELECT * FROM intent_chains WHERE child_id = ?
--      UNION ALL
--      SELECT ic.* FROM intent_chains ic JOIN chain c ON ic.child_id = c.parent_id
--    ) SELECT * FROM chain;
--
-- 3. 查找某公理的所有实现：
--    SELECT i.* FROM intents i
--    JOIN axiom_anchors a ON a.intent_id = i.id
--    WHERE a.axiom_code = 'AX-INDEPENDENCE' AND i.status = 'active';
--
-- 4. 查看意图进化历史：
--    SELECT * FROM intent_evolution WHERE intent_id = ? ORDER BY changed_at;
--
-- ============================================================
