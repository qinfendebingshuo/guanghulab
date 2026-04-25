-- ============================================================
-- PersonaDB Extensions SQL
-- 工单编号: YD-A05-20260425-002
-- 阶段编号: Phase-0-004
-- 数据库:   PostgreSQL 15+ with pgvector
-- ============================================================
-- 执行顺序: extensions.sql → schema.sql → indexes.sql → seed.sql
-- ============================================================

-- 启用 pgvector 扩展（需要超级用户或 CREATE EXTENSION 权限）
CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION vector IS 'pgvector — 向量相似度搜索扩展，用于 PersonaDB 记忆和思维路径的语义检索';

-- ============================================================
-- 为 memories 表添加 embedding 列
-- ============================================================
ALTER TABLE memories
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN memories.embedding IS '记忆内容的向量嵌入 (1536维，兼容 OpenAI text-embedding-ada-002 / text-embedding-3-small)';

-- ============================================================
-- 为 thinking_paths 表添加 embedding 列
-- ============================================================
ALTER TABLE thinking_paths
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN thinking_paths.embedding IS '思维路径触发条件的向量嵌入 (1536维)，用于语义匹配最相关的思维校准路径';
