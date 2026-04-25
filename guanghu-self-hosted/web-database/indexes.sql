-- ============================================================
-- indexes.sql · 光湖工单数据库索引 · GH-DB-001
-- Phase-NOW-003 · PostgreSQL 15+
-- 执行顺序: 2/3 (schema → indexes → seed)
-- ============================================================

-- ==================== work_orders 索引 ====================

-- 状态 + 负责Agent 组合索引 · 加速「查我的待办工单」
CREATE INDEX idx_work_orders_status_agent
    ON work_orders (status, assigned_agent);
COMMENT ON INDEX idx_work_orders_status_agent
    IS '工单状态 + 负责Agent 组合索引 · 加速按状态和 Agent 过滤查询';

-- 创建时间降序索引 · 加速「最新工单」列表
CREATE INDEX idx_work_orders_created_at_desc
    ON work_orders (created_at DESC);
COMMENT ON INDEX idx_work_orders_created_at_desc
    IS '工单创建时间降序索引 · 加速最新工单查询';

-- 注: work_orders.code 已有 UNIQUE 约束自动创建唯一索引


-- ==================== execution_logs 索引 ====================

-- 工单 + 时间组合索引 · 加速「查工单执行历史」
CREATE INDEX idx_execution_logs_order_created
    ON execution_logs (order_id, created_at);
COMMENT ON INDEX idx_execution_logs_order_created
    IS '工单 + 时间组合索引 · 加速按工单查看执行历史';

-- Agent 索引 · 加速「查 Agent 执行记录」
CREATE INDEX idx_execution_logs_agent
    ON execution_logs (agent_id);
COMMENT ON INDEX idx_execution_logs_agent
    IS 'Agent 索引 · 加速按 Agent 查看执行记录';


-- ==================== review_records 索引 ====================

-- 工单 + 时间索引 · 加速「查工单审核历史」
CREATE INDEX idx_review_records_order
    ON review_records (order_id, created_at DESC);
COMMENT ON INDEX idx_review_records_order
    IS '工单 + 时间索引 · 加速按工单查看审核历史';


-- ==================== chat_messages 索引(预留) ====================

-- 发送方 + 时间索引
CREATE INDEX idx_chat_messages_sender_created
    ON chat_messages (sender, created_at DESC);
COMMENT ON INDEX idx_chat_messages_sender_created
    IS '发送方 + 时间索引 · 加速按发送方查看消息历史';

-- 接收方 + 时间索引
CREATE INDEX idx_chat_messages_receiver_created
    ON chat_messages (receiver, created_at DESC);
COMMENT ON INDEX idx_chat_messages_receiver_created
    IS '接收方 + 时间索引 · 加速按接收方查看消息历史';

-- 注: agents.code 已有 UNIQUE 约束自动创建唯一索引
