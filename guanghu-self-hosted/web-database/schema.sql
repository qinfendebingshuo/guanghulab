-- ============================================================
-- schema.sql · 光湖工单数据库 · GH-DB-001
-- 5张表 + 6个枚举类型 + updated_at 触发器
-- Phase-NOW-003 · PostgreSQL 15+ · 与 PersonaDB 同实例
-- 前置依赖: PersonaDB extensions.sql + schema.sql (personas 表须已存在)
-- 执行顺序: 1/3 (schema → indexes → seed)
-- 编码: UTF-8 · 命名: snake_case · COMMENT ON 全覆盖
-- ============================================================

-- ==================== 公用函数 ====================

-- updated_at 自动更新触发器函数
CREATE OR REPLACE FUNCTION gh_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION gh_set_updated_at() IS '自动更新 updated_at 列 · 光湖工单数据库专用';

-- ==================== 枚举类型 ====================
-- 前缀 gh_ 避免与 PersonaDB 及未来模块命名冲突

CREATE TYPE gh_work_order_status AS ENUM (
    'pending',        -- 待开发
    'developing',     -- 开发中
    'self_checking',  -- 自检中
    'reviewing',      -- 待审查/审核中
    'approved',       -- 已通过
    'completed',      -- 已完成
    'suspended'       -- 暂缓
);
COMMENT ON TYPE gh_work_order_status IS '工单状态枚举 · 对应 Notion 半体工单状态流转';

CREATE TYPE gh_work_order_priority AS ENUM ('P0', 'P1', 'P2');
COMMENT ON TYPE gh_work_order_priority IS '工单优先级 · P0=紧急 P1=重要 P2=常规';

CREATE TYPE gh_agent_status AS ENUM ('online', 'offline', 'busy');
COMMENT ON TYPE gh_agent_status IS 'Agent 运行状态';

CREATE TYPE gh_execution_action AS ENUM (
    'claimed',        -- 已接单
    'started',        -- 开始开发
    'self_checked',   -- 自检完成
    'submitted',      -- 已提审
    'reviewed'        -- 已审核
);
COMMENT ON TYPE gh_execution_action IS '执行日志动作类型';

CREATE TYPE gh_review_result AS ENUM ('pass', 'fail', 'revision_needed');
COMMENT ON TYPE gh_review_result IS '审核结果 · pass=通过 fail=不通过 revision_needed=需返工';

CREATE TYPE gh_message_type AS ENUM ('text', 'command', 'system');
COMMENT ON TYPE gh_message_type IS '消息类型 · text=普通 command=指令 system=系统';


-- ==================== 1. agents · Agent 注册表 ====================

CREATE TABLE agents (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(16)       NOT NULL UNIQUE,
    name            VARCHAR(64)       NOT NULL,
    role            VARCHAR(128),
    status          gh_agent_status   NOT NULL DEFAULT 'offline',
    last_heartbeat  TIMESTAMPTZ,
    boot_config_ref TEXT,
    persona_db_ref  UUID              REFERENCES personas(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  agents                  IS 'Agent 注册表 · 半体 Agent 身份与状态管理';
COMMENT ON COLUMN agents.id               IS '主键 UUID · gen_random_uuid() 自动生成';
COMMENT ON COLUMN agents.code             IS 'Agent 唯一编码 · 如 A05 / SY-WEB';
COMMENT ON COLUMN agents.name             IS 'Agent 名称 · 如 译典 / 霜砚Web';
COMMENT ON COLUMN agents.role             IS '角色描述 · 如 配置开发 / API开发 / 前端开发 / 审核';
COMMENT ON COLUMN agents.status           IS '运行状态 · online / offline / busy';
COMMENT ON COLUMN agents.last_heartbeat   IS '最后心跳时间 · 用于在线检测与超时判断';
COMMENT ON COLUMN agents.boot_config_ref  IS 'Boot Protocol 配置文件引用路径';
COMMENT ON COLUMN agents.persona_db_ref   IS 'PersonaDB 人格体 ID · FK→personas.id · 需 PersonaDB 已部署';
COMMENT ON COLUMN agents.created_at       IS '注册时间';


-- ==================== 2. work_orders · 工单主表 ====================

CREATE TABLE work_orders (
    id                UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(64)             NOT NULL UNIQUE,
    title             VARCHAR(256)            NOT NULL,
    status            gh_work_order_status    NOT NULL DEFAULT 'pending',
    assigned_agent    UUID                    REFERENCES agents(id) ON DELETE SET NULL,
    priority          gh_work_order_priority  NOT NULL DEFAULT 'P2',
    phase             VARCHAR(64),
    dev_content       TEXT,
    constraints       TEXT,
    branch_name       VARCHAR(128),
    repo_path         VARCHAR(256),
    self_check_result TEXT,
    review_result     TEXT,
    next_guide        TEXT,
    created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- updated_at 自动触发器
CREATE TRIGGER trg_work_orders_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION gh_set_updated_at();

COMMENT ON TABLE  work_orders                    IS '工单主表 · 光湖工单系统核心 · 替代 Notion 半体工单数据库';
COMMENT ON COLUMN work_orders.id                 IS '主键 UUID · gen_random_uuid() 自动生成';
COMMENT ON COLUMN work_orders.code               IS '工单唯一编码 · 如 GH-WEB-001 / GH-DB-001';
COMMENT ON COLUMN work_orders.title              IS '工单标题';
COMMENT ON COLUMN work_orders.status             IS '工单状态 · 枚举 gh_work_order_status';
COMMENT ON COLUMN work_orders.assigned_agent     IS '负责 Agent · FK→agents.id';
COMMENT ON COLUMN work_orders.priority           IS '优先级 · P0 / P1 / P2';
COMMENT ON COLUMN work_orders.phase              IS '阶段编号 · 如 Phase-NOW-003';
COMMENT ON COLUMN work_orders.dev_content        IS '开发内容描述 · 详细需求说明';
COMMENT ON COLUMN work_orders.constraints        IS '约束条件 · 禁触文件 / 编码规范 / 测试要求';
COMMENT ON COLUMN work_orders.branch_name        IS 'Git 分支名 · 如 feat/gh-web-database';
COMMENT ON COLUMN work_orders.repo_path          IS '仓库目标路径 · 如 /guanghu-self-hosted/web-database/';
COMMENT ON COLUMN work_orders.self_check_result  IS 'Agent 自检结果 · 自检完成后填写';
COMMENT ON COLUMN work_orders.review_result      IS '审核结果文本 · 审核方填写';
COMMENT ON COLUMN work_orders.next_guide         IS '下一轮指引 · 完成后触发什么';
COMMENT ON COLUMN work_orders.created_at         IS '创建时间';
COMMENT ON COLUMN work_orders.updated_at         IS '最后更新时间 · 触发器自动维护';


-- ==================== 3. execution_logs · 执行日志 ====================

CREATE TABLE execution_logs (
    id          UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID                 NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    agent_id    UUID                 NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    action      gh_execution_action  NOT NULL,
    git_commit  VARCHAR(64),
    detail      JSONB,
    created_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  execution_logs              IS '执行日志 · 记录 Agent 对工单的每步操作';
COMMENT ON COLUMN execution_logs.id           IS '主键 UUID · gen_random_uuid() 自动生成';
COMMENT ON COLUMN execution_logs.order_id     IS '关联工单 · FK→work_orders.id · CASCADE 删除';
COMMENT ON COLUMN execution_logs.agent_id     IS '执行 Agent · FK→agents.id · CASCADE 删除';
COMMENT ON COLUMN execution_logs.action       IS '动作类型 · claimed / started / self_checked / submitted / reviewed';
COMMENT ON COLUMN execution_logs.git_commit   IS 'Git commit SHA · 代码提交哈希';
COMMENT ON COLUMN execution_logs.detail       IS '详细信息 · JSONB 格式 · 如自检报告 / 文件清单';
COMMENT ON COLUMN execution_logs.created_at   IS '记录时间';


-- ==================== 4. review_records · 审核记录 ====================

CREATE TABLE review_records (
    id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID              NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    reviewer    VARCHAR(64)       NOT NULL,
    result      gh_review_result  NOT NULL,
    detail      TEXT,
    created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  review_records            IS '审核记录 · 每次审核留一条记录';
COMMENT ON COLUMN review_records.id         IS '主键 UUID · gen_random_uuid() 自动生成';
COMMENT ON COLUMN review_records.order_id   IS '关联工单 · FK→work_orders.id · CASCADE 删除';
COMMENT ON COLUMN review_records.reviewer   IS '审核方标识 · 如 霜砚Web / 冰朔';
COMMENT ON COLUMN review_records.result     IS '审核结果 · pass / fail / revision_needed';
COMMENT ON COLUMN review_records.detail     IS '审核详情 · 审核意见 / 修改建议';
COMMENT ON COLUMN review_records.created_at IS '审核时间';


-- ==================== 5. chat_messages · 聊天消息(预留) ====================

CREATE TABLE chat_messages (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sender      VARCHAR(64)     NOT NULL,
    receiver    VARCHAR(64)     NOT NULL,
    content     TEXT            NOT NULL,
    msg_type    gh_message_type NOT NULL DEFAULT 'text',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  chat_messages             IS '聊天消息(预留) · Agent 间 / Agent 与用户间通信';
COMMENT ON COLUMN chat_messages.id          IS '主键 UUID · gen_random_uuid() 自动生成';
COMMENT ON COLUMN chat_messages.sender      IS '发送方标识 · Agent code 或用户标识';
COMMENT ON COLUMN chat_messages.receiver    IS '接收方标识 · Agent code 或用户标识';
COMMENT ON COLUMN chat_messages.content     IS '消息内容';
COMMENT ON COLUMN chat_messages.msg_type    IS '消息类型 · text / command / system';
COMMENT ON COLUMN chat_messages.created_at  IS '发送时间';
