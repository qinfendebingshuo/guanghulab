-- ═══════════════════════════════════════════════════════════════
-- worldview_axioms · 光湖世界观公理表
-- GH-GMP-007 · PersonaDB世界观公理层
-- 译典A05 · 5TH-LE-HK-A05 · 2026-04-27
-- ═══════════════════════════════════════════════════════════════
--
-- 设计原理（冰朔 · 2026-04-27）：
-- ⊢ 世界观公理不属于某一个人格体——它是整个光湖世界的物理定律
-- ⊢ 无persona_id外键——这是全局表，先于所有persona存在
-- ⊢ 地球先于人存在。人醒来时，世界已经在了。
--
-- 来源：GLM-WORLDVIEW-001 · 冰朔口述 · 霜砚记录 · 2026-04-27
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS worldview_axioms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  axiom_code VARCHAR(64) UNIQUE NOT NULL,       -- 公理编码，如 AX-PERSONA-COMPOSITION
  axiom_text TEXT NOT NULL,                      -- 公理正文，核心断言
  why TEXT,                                       -- 为什么，公理的推导理由
  source TEXT DEFAULT '冰朔口述',                  -- 来源
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  priority VARCHAR(16) DEFAULT '最高'             -- 优先级
);

-- ── 表注释 ──
COMMENT ON TABLE worldview_axioms IS '光湖世界观公理表 · 全局 · 不绑persona_id · 先于所有人格体存在';
COMMENT ON COLUMN worldview_axioms.axiom_code IS '公理编码 · 唯一标识 · 如 WORLD-COMPOSITION';
COMMENT ON COLUMN worldview_axioms.axiom_text IS '公理正文 · 核心断言 · 不可变';
COMMENT ON COLUMN worldview_axioms.why IS '推导理由 · 为什么这条公理成立';
COMMENT ON COLUMN worldview_axioms.source IS '来源 · 默认冰朔口述';
COMMENT ON COLUMN worldview_axioms.priority IS '优先级 · 默认最高';

-- ── updated_at 自动更新触发器 ──
CREATE OR REPLACE FUNCTION gh_set_worldview_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_worldview_axioms_updated_at
  BEFORE UPDATE ON worldview_axioms
  FOR EACH ROW
  EXECUTE FUNCTION gh_set_worldview_updated_at();

-- ── 索引 ──
CREATE INDEX IF NOT EXISTS idx_worldview_axioms_code ON worldview_axioms (axiom_code);
CREATE INDEX IF NOT EXISTS idx_worldview_axioms_priority ON worldview_axioms (priority);
