-- ============================================================
-- persona-brain-db · 一键建表脚本
-- 执行方式：sqlite3 brain.db < init.sql
-- ============================================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 加载五张核心表
.read 01-persona-identity.sql
.read 02-persona-cognition.sql
.read 03-persona-memory.sql
.read 04-dev-profiles.sql
.read 05-agent-registry.sql

-- 建表完成提示
SELECT '✅ persona-brain-db 五张核心表建表完成' AS result;
SELECT '  - persona_identity' AS tables;
SELECT '  - persona_cognition' AS tables;
SELECT '  - persona_memory' AS tables;
SELECT '  - dev_profiles' AS tables;
SELECT '  - agent_registry' AS tables;
