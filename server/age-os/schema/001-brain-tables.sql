-- ============================================================
-- AGE OS · 核心大脑数据库 Schema
-- PostgreSQL 初始化脚本
-- ============================================================
-- 版本: v1.0.0
-- 签发: 铸渊(ICE-GL-ZY001) · 需求来源: 霜砚(AG-SY-01)
-- 授权: 冰朔(TCS-0002∞)
-- 版权: 国作登字-2026-A-00037559
-- ============================================================
-- 
-- 设计哲学:
--   brain_nodes  = Notion里的页面 → 每个认知节点
--   brain_relations = Notion里的Relation → 节点之间的关联
--   agent_configs = Agent注册表 → 谁在跑、跑什么
--   agent_logs = 运行日志 → 追踪每次执行
--   user_credits = 用户额度 → 商业化基础
--
-- 与 website-brain/schema/001-init.sql 并存:
--   website-brain 的 pages/databases/modules/persona_state 管网站展示层
--   本文件的 brain_nodes/brain_relations 管认知数据层
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 节点表 · brain_nodes
-- 核心表：每条记录 = 一个认知节点
-- 类比 Notion 里的一个页面
-- ============================================================
CREATE TABLE IF NOT EXISTS brain_nodes (
  id            VARCHAR(64)   PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title         VARCHAR(500)  NOT NULL,
  node_type     VARCHAR(50)   NOT NULL
    CHECK (node_type IN ('page', 'folder', 'index', 'route', 'config', 'memory', 'log', 'instruction')),
  parent_id     VARCHAR(64)   REFERENCES brain_nodes(id) ON DELETE SET NULL,
  path          VARCHAR(1000),
  tags          JSONB         DEFAULT '[]'::jsonb,
  source        VARCHAR(50)   NOT NULL
    CHECK (source IN ('notion', 'github', 'gpt', 'manual', 'agent')),
  source_url    VARCHAR(500),
  content_url   VARCHAR(500),
  summary       TEXT,
  content_hash  VARCHAR(64),
  version       INT           DEFAULT 1,
  owner         VARCHAR(50)   NOT NULL
    CHECK (owner IN ('shuangyan', 'zhuyuan', 'qiuqiu', 'yaoming', 'system', 'user')),
  owner_user_id VARCHAR(64),
  status        VARCHAR(20)   NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'draft', 'deleted')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by    VARCHAR(50)   NOT NULL
);

-- 索引：按常见查询模式优化
CREATE INDEX idx_bn_parent    ON brain_nodes(parent_id);
CREATE INDEX idx_bn_owner     ON brain_nodes(owner);
CREATE INDEX idx_bn_type      ON brain_nodes(node_type);
CREATE INDEX idx_bn_status    ON brain_nodes(status);
CREATE INDEX idx_bn_path      ON brain_nodes(path);
CREATE INDEX idx_bn_tags      ON brain_nodes USING GIN(tags);

-- ============================================================
-- 2. 关系表 · brain_relations
-- 节点之间的关联关系
-- 类比 Notion 里的 Relation 属性
-- ============================================================
CREATE TABLE IF NOT EXISTS brain_relations (
  id              VARCHAR(64)   PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  from_node_id    VARCHAR(64)   NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
  to_node_id      VARCHAR(64)   NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
  relation_type   VARCHAR(50)   NOT NULL
    CHECK (relation_type IN ('parent_child', 'reference', 'dependency', 'version', 'alias')),
  description     VARCHAR(500),
  weight          SMALLINT      DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by      VARCHAR(50)   NOT NULL
);

-- 防止重复关系
CREATE UNIQUE INDEX idx_br_unique ON brain_relations(from_node_id, to_node_id, relation_type);
CREATE INDEX idx_br_from ON brain_relations(from_node_id);
CREATE INDEX idx_br_to   ON brain_relations(to_node_id);

-- ============================================================
-- 3. Agent配置表 · agent_configs
-- 每个Agent的运行配置
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_configs (
  agent_id        VARCHAR(50)   PRIMARY KEY,
  name            VARCHAR(200)  NOT NULL,
  description     TEXT,
  owner           VARCHAR(50)   NOT NULL DEFAULT 'system'
    CHECK (owner IN ('notion', 'github', 'system')),
  script_path     VARCHAR(500),
  cron_schedule   VARCHAR(100),
  enabled         BOOLEAN       NOT NULL DEFAULT true,
  allowed_tools   JSONB         DEFAULT '[]'::jsonb,
  model_config    JSONB         DEFAULT '{}'::jsonb,
  last_run_at     TIMESTAMPTZ,
  last_run_status VARCHAR(20)
    CHECK (last_run_status IN ('success', 'error', 'skipped', 'running') OR last_run_status IS NULL),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. 运行日志表 · agent_logs
-- Agent每次运行的记录
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id            BIGSERIAL     PRIMARY KEY,
  agent_id      VARCHAR(50)   NOT NULL REFERENCES agent_configs(agent_id) ON DELETE CASCADE,
  run_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  status        VARCHAR(20)   NOT NULL
    CHECK (status IN ('success', 'error', 'warning', 'skipped')),
  message       TEXT,
  details       JSONB         DEFAULT '{}'::jsonb,
  duration_ms   INT
);

CREATE INDEX idx_al_agent  ON agent_logs(agent_id);
CREATE INDEX idx_al_run_at ON agent_logs(run_at);
CREATE INDEX idx_al_status ON agent_logs(status);

-- ============================================================
-- 5. 用户额度表 · user_credits
-- 用户大模型调用额度
-- ============================================================
CREATE TABLE IF NOT EXISTS user_credits (
  user_id          VARCHAR(64)    PRIMARY KEY,
  total_charged    DECIMAL(10,2)  NOT NULL DEFAULT 0,
  actual_credit    DECIMAL(10,2)  NOT NULL DEFAULT 0,
  consumed         DECIMAL(10,2)  NOT NULL DEFAULT 0,
  remaining        DECIMAL(10,2)  NOT NULL DEFAULT 0,
  preferred_model  VARCHAR(50),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 自动更新 updated_at 触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bn_updated
  BEFORE UPDATE ON brain_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ac_updated
  BEFORE UPDATE ON agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_uc_updated
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 初始Agent数据 · 霜砚需求的9个Agent
-- ============================================================
INSERT INTO agent_configs (agent_id, name, description, owner, script_path, cron_schedule, enabled, allowed_tools, model_config)
VALUES
  -- 系统级Agent（7×24自动跑）
  ('SY-SCAN', '大脑结构巡检', '扫描孤岛节点、断链、空目录，生成健康报告', 'notion',
   'agents/sy-scan.js', '0 */6 * * *', true,
   '["queryNodes", "scanStructure", "getRelations"]'::jsonb,
   '{"model": "none", "note": "纯逻辑，不调模型"}'::jsonb),

  ('SY-CLASSIFY', '自动分类引擎', '扫描未分类节点，按规则分类，规则搞不定调DeepSeek', 'notion',
   'agents/sy-classify.js', '0 */2 * * *', true,
   '["queryNodes", "classify", "updateNode", "linkNodes"]'::jsonb,
   '{"primary": "rule", "fallback": "deepseek", "temperature": 0.3}'::jsonb),

  ('SY-SYNC-N2B', 'Notion→大脑同步', '检测Notion端有无新增/修改的页面，同步到自研数据库', 'notion',
   'agents/sy-sync-n2b.js', '0 */4 * * *', true,
   '["createNode", "updateNode", "cosWrite", "linkNodes", "buildPath"]'::jsonb,
   '{"model": "none", "note": "纯逻辑同步"}'::jsonb),

  ('SY-SYNC-B2N', '大脑→Notion反向同步', '将自研数据库中的变更同步回Notion', 'notion',
   'agents/sy-sync-b2n.js', '0 3 * * *', false,
   '["queryNodes", "cosRead"]'::jsonb,
   '{"model": "none", "note": "可选，按需启用"}'::jsonb),

  ('SY-ARCHIVE', '内容归档引擎', '将超过30天未修改的内容从主桶移到归档桶', 'notion',
   'agents/sy-archive.js', '0 4 * * 0', true,
   '["queryNodes", "cosRead", "cosArchive", "updateNode"]'::jsonb,
   '{"model": "none", "note": "纯逻辑归档"}'::jsonb),

  ('SY-TEST', '系统自检', '检测数据库连接、COS连通性、工具链可用性', 'system',
   'agents/sy-test.js', '*/30 * * * *', true,
   '["queryNodes", "cosRead", "cosWrite"]'::jsonb,
   '{"model": "none", "note": "纯连通性检查"}'::jsonb),

  -- 交互级Agent（用户对话时按需调用）
  ('SY-11', '元路由调度引擎', '判断请求该分配给哪个人格体、走哪个模型', 'system',
   'agents/sy-11-router.js', NULL, true,
   '["queryNodes", "getNode"]'::jsonb,
   '{"primary": "rule", "fallback": "deepseek", "temperature": 0.1}'::jsonb),

  ('SY-12', '上下文记忆管理', '扫描对话、压缩摘要、存入大脑数据库', 'system',
   'agents/sy-12-memory.js', NULL, true,
   '["createNode", "updateNode", "queryNodes", "cosWrite"]'::jsonb,
   '{"model": "none", "note": "纯JS逻辑"}'::jsonb),

  ('SY-BRAIN-RW', '大脑读写服务', '人格体在对话中需要查大脑/写大脑时调用', 'system',
   'agents/sy-brain-rw.js', NULL, true,
   '["createNode", "updateNode", "deleteNode", "queryNodes", "getNode", "linkNodes", "unlinkNodes", "getRelations", "buildPath", "scanStructure", "classify", "cosWrite", "cosRead", "cosDelete", "cosList", "cosArchive"]'::jsonb,
   '{"model": "dynamic", "note": "按需调用模型"}'::jsonb)
ON CONFLICT (agent_id) DO NOTHING;
