-- ============================================================
-- 光湖网站总大脑 · L4 核心 Schema
-- PostgreSQL 初始化脚本
-- 版本: v0.1.0 · Phase 1 骨架期
-- 签发: 霜砚(PER-SY001) · 授权: 冰朔(TCS-0002∞)
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 页面表 — 类 Notion Page
-- 支持富文本、嵌套块、多级层次
-- ============================================================
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES pages(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  icon VARCHAR(100),
  content JSONB DEFAULT '[]'::jsonb,
  properties JSONB DEFAULT '{}'::jsonb,
  persona_owner VARCHAR(50),
  access_level VARCHAR(20) DEFAULT 'normal'
    CHECK (access_level IN ('public', 'normal', 'restricted', 'classified')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pages_parent ON pages(parent_id);
CREATE INDEX idx_pages_persona ON pages(persona_owner);

-- ============================================================
-- 数据库表 — 类 Notion Database
-- 可配置属性、筛选、排序、视图
-- ============================================================
CREATE TABLE IF NOT EXISTS databases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  schema JSONB DEFAULT '{}'::jsonb,
  views JSONB DEFAULT '[]'::jsonb,
  persona_owner VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_databases_persona ON databases(persona_owner);

-- ============================================================
-- 模块注册表 — 热插拔模块管理
-- ============================================================
CREATE TABLE IF NOT EXISTS modules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'dormant', 'deprecated')),
  api_routes JSONB DEFAULT '[]'::jsonb,
  persona_binding VARCHAR(50),
  version VARCHAR(20) DEFAULT '0.1.0',
  deployed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_status ON modules(status);

-- ============================================================
-- 人格体状态表
-- ============================================================
CREATE TABLE IF NOT EXISTS persona_state (
  persona_id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'dormant', 'battle')),
  memory_ref VARCHAR(500),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  routing_rules JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- updated_at 自动更新触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
