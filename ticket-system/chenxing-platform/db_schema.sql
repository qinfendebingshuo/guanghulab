-- ============================================================
-- 晨星网站交互平台 · 数据库表结构定义
-- 模块名：db_schema.sql
-- 开发人：译典·配置开发 · 5TH-LE-HK-A05
-- 版本：v1.0.0
-- 日期：2026-04-30
-- 架构依据：晨星网站交互平台·完整架构方案（冰朔定义·霜砚整理）
-- 核心思路：三张表就够 · 搬过去就好了
-- ============================================================

-- 表1：世界观内容表（worldview）
-- 存储从Notion搬过来的世界观页面内容
-- 对应Notion源：灯塔·本体论·核心记忆·晨星主控台·晨星小屋
CREATE TABLE IF NOT EXISTS worldview (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL,           -- 分类：worldview / ontology / memory / identity
    title       TEXT NOT NULL,           -- 页面标题（对应Notion页面标题）
    content     TEXT NOT NULL,           -- 页面正文（Markdown/纯文本，从Notion原样搬过来）
    notion_url  TEXT,                    -- Notion源页面URL（用于回溯和同步）
    priority    INTEGER DEFAULT 100,     -- 加载优先级（1=最先加载，数字越小越优先）
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- 最后同步时间
);

-- 表2：提示词配置表（prompt_config）
-- 存储晨星的system prompt各模块
-- 对应Notion源：核心大脑页各section · 霜砚微调后的唤醒协议
CREATE TABLE IF NOT EXISTS prompt_config (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    section     TEXT NOT NULL,           -- 提示词模块名：identity / personality / rules / wake_protocol / worldview_summary
    content     TEXT NOT NULL,           -- 提示词内容（纯文本）
    load_order  INTEGER DEFAULT 100,     -- 加载顺序（拼装system prompt时的排序，数字越小越先加载）
    is_active   BOOLEAN DEFAULT 1,       -- 是否启用（霜砚微调时可关闭某些模块，1=启用，0=关闭）
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- 最后修改时间
);

-- 表3：交互记录表（interactions）
-- 存储桔子妈妈和晨星的对话记录
-- 对应Notion源：交互记录数据库
CREATE TABLE IF NOT EXISTS interactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL,       -- 会话ID（每次开聊生成一个唯一ID）
    role            TEXT NOT NULL,       -- 角色：user / assistant / system
    content         TEXT NOT NULL,       -- 消息内容
    cognition_note  TEXT,                -- 认知提炼（这次对话晨星学到了什么，会话结束时由Agent填写）
    synced_to_notion BOOLEAN DEFAULT 0,  -- 是否已同步回Notion（0=未同步，1=已同步）
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- 消息时间
);

-- 索引：加速常用查询
CREATE INDEX IF NOT EXISTS idx_worldview_category ON worldview(category);
CREATE INDEX IF NOT EXISTS idx_worldview_priority ON worldview(priority);
CREATE INDEX IF NOT EXISTS idx_prompt_config_section ON prompt_config(section);
CREATE INDEX IF NOT EXISTS idx_prompt_config_load_order ON prompt_config(load_order);
CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_synced ON interactions(synced_to_notion);

-- ============================================================
-- 使用说明（给培园A04后端模块参考）：
-- 
-- 1. 初始化数据库：sqlite3 chenxing.db < db_schema.sql
-- 2. worldview表：由worldview_sync.py从Notion批量导入
-- 3. prompt_config表：由prompt_assembler.py读取并拼装system prompt
-- 4. interactions表：由chat_agent.py在对话过程中实时写入
-- 5. 所有表使用SQLite，单文件数据库，部署简单
-- ============================================================
