-- ============================================================
-- extensions.sql · PersonaDB pgvector 扩展启用 + UUID 支持
-- HLDP-ARCH-001 · Phase-0-004
-- 执行顺序: 1/4
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
