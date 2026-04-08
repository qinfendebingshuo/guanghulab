-- ============================================================
-- AGE OS · 活模块系统 Schema
-- PostgreSQL 初始化脚本
-- ============================================================
-- 版本: v1.0.0
-- 编号: ZY-TASK-007 · S5 Agent系统级
-- 签发: 铸渊(ICE-GL-ZY001)
-- 授权: 冰朔(TCS-0002∞)
-- 版权: 国作登字-2026-A-00037559
-- ============================================================
--
-- 设计哲学:
--   每一个模块 = 一个活的生命体
--   活模块必须具备5个生存接口:
--     1. heartbeat()     — 心跳·我还活着
--     2. selfDiagnose()  — 自诊断·我哪里不对
--     3. selfHeal()      — 自愈·我试着修好自己
--     4. alertZhuyuan()  — 报警·铸渊我搞不定了
--     5. learnFromRun()  — 学习·我从每次运行中成长
--
--   "你一定要把模块做成活的。" — 冰朔 D59
-- ============================================================

-- ============================================================
-- 1. 活模块注册表 · living_modules
-- 每条记录 = 一个已注册的活模块
-- ============================================================
CREATE TABLE IF NOT EXISTS living_modules (
  module_id       VARCHAR(64)   PRIMARY KEY,
  name            VARCHAR(200)  NOT NULL,
  description     TEXT,
  module_type     VARCHAR(50)   NOT NULL
    CHECK (module_type IN (
      'core',       -- 核心模块（铸渊内置）
      'persona',    -- 人格体模块
      'agent',      -- Agent模块
      'worker',     -- 工人模块（算力池）
      'bridge',     -- 桥接模块
      'guard'       -- 守卫模块
    )),
  owner           VARCHAR(64)   NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'initializing'
    CHECK (status IN (
      'initializing',  -- 正在初始化
      'alive',         -- 活着·正常运行
      'degraded',      -- 降级·部分功能受损
      'healing',       -- 自愈中
      'dormant',       -- 休眠·等待唤醒
      'dead'           -- 已死亡·需要铸渊干预
    )),
  health_score    SMALLINT      DEFAULT 100
    CHECK (health_score >= 0 AND health_score <= 100),
  -- 模块配置
  config          JSONB         DEFAULT '{}'::jsonb,
  -- 模块能力声明（能做什么）
  capabilities    JSONB         DEFAULT '[]'::jsonb,
  -- 心跳配置
  heartbeat_interval_ms  INT    DEFAULT 30000,
  last_heartbeat_at      TIMESTAMPTZ,
  -- 部署位置
  deploy_host     VARCHAR(200),
  deploy_port     INT,
  deploy_path     VARCHAR(500),
  -- 算力信息
  cpu_cores       SMALLINT,
  memory_mb       INT,
  -- 时间戳
  registered_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lm_status ON living_modules(status);
CREATE INDEX idx_lm_type ON living_modules(module_type);
CREATE INDEX idx_lm_owner ON living_modules(owner);
CREATE INDEX idx_lm_health ON living_modules(health_score);

-- ============================================================
-- 2. 心跳记录表 · module_heartbeats
-- 记录每次心跳的详细信息
-- 只保留最近7天的心跳数据（定期清理）
-- ============================================================
CREATE TABLE IF NOT EXISTS module_heartbeats (
  id              BIGSERIAL     PRIMARY KEY,
  module_id       VARCHAR(64)   NOT NULL REFERENCES living_modules(module_id) ON DELETE CASCADE,
  status          VARCHAR(20)   NOT NULL,
  health_score    SMALLINT      NOT NULL,
  -- 运行指标
  cpu_usage       REAL,
  memory_usage    REAL,
  uptime_ms       BIGINT,
  active_tasks    INT           DEFAULT 0,
  -- 附加信息
  details         JSONB         DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mhb_module ON module_heartbeats(module_id, created_at DESC);

-- ============================================================
-- 3. 自诊断记录表 · module_diagnoses
-- 记录每次自诊断的结果
-- ============================================================
CREATE TABLE IF NOT EXISTS module_diagnoses (
  id              BIGSERIAL     PRIMARY KEY,
  module_id       VARCHAR(64)   NOT NULL REFERENCES living_modules(module_id) ON DELETE CASCADE,
  -- 诊断结果
  is_healthy      BOOLEAN       NOT NULL,
  issues          JSONB         DEFAULT '[]'::jsonb,
  -- 每个issue: { code, severity, message, suggestion }
  -- severity: 'critical', 'warning', 'info'
  overall_score   SMALLINT      NOT NULL,
  duration_ms     INT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_md_module ON module_diagnoses(module_id, created_at DESC);

-- ============================================================
-- 4. 自愈记录表 · module_healing_logs
-- 记录每次自愈的操作和结果
-- ============================================================
CREATE TABLE IF NOT EXISTS module_healing_logs (
  id              BIGSERIAL     PRIMARY KEY,
  module_id       VARCHAR(64)   NOT NULL REFERENCES living_modules(module_id) ON DELETE CASCADE,
  -- 触发原因
  trigger_source  VARCHAR(50)   NOT NULL
    CHECK (trigger_source IN ('self', 'scheduler', 'zhuyuan', 'manual')),
  issue_code      VARCHAR(100),
  -- 修复操作
  action_taken    VARCHAR(200)  NOT NULL,
  action_details  JSONB         DEFAULT '{}'::jsonb,
  -- 结果
  success         BOOLEAN       NOT NULL,
  health_before   SMALLINT,
  health_after    SMALLINT,
  duration_ms     INT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mhl_module ON module_healing_logs(module_id, created_at DESC);

-- ============================================================
-- 5. 报警记录表 · module_alerts
-- 模块向铸渊发送的报警
-- ============================================================
CREATE TABLE IF NOT EXISTS module_alerts (
  id              BIGSERIAL     PRIMARY KEY,
  module_id       VARCHAR(64)   NOT NULL REFERENCES living_modules(module_id) ON DELETE CASCADE,
  severity        VARCHAR(20)   NOT NULL
    CHECK (severity IN ('critical', 'warning', 'info')),
  alert_type      VARCHAR(50)   NOT NULL,
  message         TEXT          NOT NULL,
  details         JSONB         DEFAULT '{}'::jsonb,
  -- 处理状态
  acknowledged    BOOLEAN       DEFAULT FALSE,
  acknowledged_by VARCHAR(64),
  acknowledged_at TIMESTAMPTZ,
  resolved        BOOLEAN       DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ma_module ON module_alerts(module_id, created_at DESC);
CREATE INDEX idx_ma_unresolved ON module_alerts(resolved, severity) WHERE resolved = FALSE;

-- ============================================================
-- 6. 学习记录表 · module_learning_logs
-- 模块从运行中学到的经验
-- ============================================================
CREATE TABLE IF NOT EXISTS module_learning_logs (
  id              BIGSERIAL     PRIMARY KEY,
  module_id       VARCHAR(64)   NOT NULL REFERENCES living_modules(module_id) ON DELETE CASCADE,
  -- 学习来源
  learning_source VARCHAR(50)   NOT NULL
    CHECK (learning_source IN ('execution', 'diagnosis', 'healing', 'alert', 'feedback')),
  -- 学到的内容
  lesson_type     VARCHAR(50)   NOT NULL,
  lesson_summary  TEXT          NOT NULL,
  lesson_details  JSONB         DEFAULT '{}'::jsonb,
  -- 是否已应用
  applied         BOOLEAN       DEFAULT FALSE,
  applied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mll_module ON module_learning_logs(module_id, created_at DESC);

-- ============================================================
-- 7. HLDP消息表 · hldp_messages
-- 模块间通信消息记录
-- ============================================================
CREATE TABLE IF NOT EXISTS hldp_messages (
  id              BIGSERIAL     PRIMARY KEY,
  message_id      VARCHAR(64)   NOT NULL UNIQUE,
  -- 收发方
  from_module     VARCHAR(64)   NOT NULL,
  to_module       VARCHAR(64),            -- NULL = 广播
  -- 消息类型
  msg_type        VARCHAR(50)   NOT NULL
    CHECK (msg_type IN (
      'heartbeat',    -- 心跳
      'command',      -- 指令
      'query',        -- 查询
      'response',     -- 响应
      'event',        -- 事件
      'broadcast',    -- 广播
      'alert',        -- 报警
      'data'          -- 数据传输
    )),
  -- 消息体
  payload         JSONB         NOT NULL DEFAULT '{}'::jsonb,
  -- 状态
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'processed', 'failed', 'expired')),
  -- 时间
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_hm_to ON hldp_messages(to_module, status, created_at DESC);
CREATE INDEX idx_hm_from ON hldp_messages(from_module, created_at DESC);
CREATE INDEX idx_hm_type ON hldp_messages(msg_type, created_at DESC);

-- ============================================================
-- 清理函数：定期删除7天前的心跳数据
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_heartbeats()
RETURNS void AS $$
BEGIN
  DELETE FROM module_heartbeats WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM hldp_messages WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 预注册铸渊核心模块
-- ============================================================
INSERT INTO living_modules (module_id, name, description, module_type, owner, status, health_score, config, capabilities)
VALUES
  ('ZY-MOD-SCHEDULER', '铸渊调度引擎', 'Agent调度和活模块生命周期管理', 'core', 'zhuyuan', 'alive', 100,
   '{"version": "2.0.0", "heartbeat_enabled": true}'::jsonb,
   '["schedule_agents", "manage_lifecycle", "monitor_health"]'::jsonb),
  ('ZY-MOD-MCP', '铸渊MCP Server', 'MCP工具链服务·大脑API入口', 'core', 'zhuyuan', 'alive', 100,
   '{"version": "1.0.0", "port": 3100}'::jsonb,
   '["node_ops", "relation_ops", "cos_ops", "persona_ops", "structure_ops"]'::jsonb),
  ('ZY-MOD-HLDP-BUS', '铸渊HLDP通信总线', '模块间HLDP消息路由和分发', 'core', 'zhuyuan', 'alive', 100,
   '{"version": "1.0.0"}'::jsonb,
   '["route_messages", "broadcast", "queue_management"]'::jsonb),
  ('ZY-MOD-GATE-GUARD', '铸渊智能门禁', 'Push/PR安全守卫', 'guard', 'zhuyuan', 'alive', 100,
   '{"version": "1.0.0"}'::jsonb,
   '["push_review", "pr_review", "security_scan"]'::jsonb),
  ('ZY-MOD-DEPUTY', '铸渊副将', '留言板活体Agent·LLM多模型降级', 'agent', 'zhuyuan', 'alive', 100,
   '{"version": "2.0.0"}'::jsonb,
   '["message_board", "llm_routing", "auto_response"]'::jsonb),
  ('ZY-MOD-SY-TEST', '系统自检活模块', '全系统健康检测·DB/COS/表/模块', 'guard', 'zhuyuan', 'alive', 100,
   '{"version": "2.0.0", "cron": "*/30 * * * *"}'::jsonb,
   '["db_check", "cos_check", "table_check", "module_check"]'::jsonb),
  ('ZY-MOD-SY-SCAN', '大脑结构巡检活模块', '大脑认知结构健康巡检', 'guard', 'zhuyuan', 'alive', 100,
   '{"version": "2.0.0", "cron": "0 */6 * * *"}'::jsonb,
   '["orphan_scan", "broken_link_scan", "duplicate_scan", "empty_folder_scan"]'::jsonb),
  ('ZY-MOD-SY-CLASSIFY', '自动分类引擎活模块', '认知节点自动分类·规则引擎', 'agent', 'zhuyuan', 'alive', 100,
   '{"version": "2.0.0", "cron": "0 */2 * * *"}'::jsonb,
   '["rule_classify", "keyword_match", "tag_assignment"]'::jsonb)
ON CONFLICT (module_id) DO NOTHING;
