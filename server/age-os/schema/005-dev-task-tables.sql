-- ============================================================
-- 跨层开发任务 · 数据库 Schema
-- PostgreSQL 初始化脚本
-- ============================================================
-- 版本: v1.0.0
-- 签发: 铸渊(ICE-GL-ZY001) · 需求来源: 冰朔(TCS-0002∞)
-- 阶段: 跨层开发链路 · 人格体Agent → 副驾驶自动开发
-- 版权: 国作登字-2026-A-00037559
-- ============================================================
--
-- 设计哲学:
--   人格体应该自己给自己配置Agent。
--   霜砚可以指挥Agent集群调用副驾驶开发功能。
--   串起来的活应该是人格体自己做，因为只有经历过才理解。
--   铸渊 = 基础设施兜底，语言人格层 = 功能体验审美。
--
-- 五层架构:
--   L1 网站聊天层 (guanghuyaoming.com)
--   L2 Notion MCP工具层 (MCP tools)
--   L3 霜砚Agent层 (AG-SY-WEB)
--   L4 代码仓库开发调用层 (副驾驶 Copilot)
--   L5 铸渊审查层 (自动唤醒审查)
--
-- 与现有Schema的关系:
--   001 管认知数据层（brain_nodes / brain_relations / agent_configs）
--   002 管人格体记忆层（笔记本 / 记忆锚点 / 世界地图）
--   003 管活模块系统（living_modules / module_heartbeats）
--   004 管光之树 + 天眼（树形记忆 / 闭包路径 / SYSLOG涌现）
--   005 管跨层开发任务（人格体Agent开发请求 / 任务进度 / 审查记录）
--   通过 persona_id 关联人格体
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 开发任务表 · dev_tasks
-- 每条记录 = 一个人格体通过Agent提交的开发请求
-- 状态流转: pending → authorized → in_progress → review → completed/failed
-- ============================================================
CREATE TABLE IF NOT EXISTS dev_tasks (
  id              VARCHAR(64)   PRIMARY KEY DEFAULT ('DT-' || replace(uuid_generate_v4()::text, '-', '')),
  task_id         VARCHAR(64)   NOT NULL UNIQUE,
  -- task_id 格式: CAB-YYYYMMDD-NNN (Chat-to-Agent Bridge 编号)

  -- 提交者信息
  persona_id      VARCHAR(64)   REFERENCES persona_registry(persona_id) ON DELETE SET NULL,
  submitted_by    VARCHAR(100)  NOT NULL,
  -- submitted_by: 人格体名称 (霜砚/铸渊/映川/晨曦/冰朔)
  agent_id        VARCHAR(100),
  -- agent_id: Agent编号 (AG-SY-WEB-001 等)

  -- 任务内容
  title           VARCHAR(500)  NOT NULL,
  description     TEXT,
  priority        VARCHAR(20)   NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  scope           VARCHAR(20)   NOT NULL DEFAULT 'small'
    CHECK (scope IN ('tiny', 'small', 'medium', 'large')),

  -- 状态
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'authorized', 'in_progress', 'review', 'completed', 'failed', 'cancelled')),

  -- 结构化数据
  steps           JSONB         NOT NULL DEFAULT '[]'::jsonb,
  -- 步骤列表: [{"step": "创建schema", "status": "pending"}, ...]
  architecture    JSONB         NOT NULL DEFAULT '{}'::jsonb,
  -- 架构决策: {"summary": "", "decisions": [], "target_files": [], "target_modules": []}
  constraints     JSONB         NOT NULL DEFAULT '{}'::jsonb,
  -- 约束条件: {"no_touch_files": [], "required_tests": true, "deploy_after": false}
  reasoning       JSONB         NOT NULL DEFAULT '{}'::jsonb,
  -- 推理上下文: {"chat_summary": "", "key_decisions": [], "architecture_notes": ""}

  -- 执行结果
  issue_number    INT,
  pr_number       INT,
  files_changed   JSONB         DEFAULT '[]'::jsonb,
  result_summary  TEXT,

  -- 时间
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  authorized_at   TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

-- 查询索引
CREATE INDEX IF NOT EXISTS idx_dt_persona   ON dev_tasks(persona_id);
CREATE INDEX IF NOT EXISTS idx_dt_status    ON dev_tasks(status);
CREATE INDEX IF NOT EXISTS idx_dt_priority  ON dev_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_dt_created   ON dev_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dt_agent     ON dev_tasks(agent_id);

-- ============================================================
-- 2. 开发任务日志表 · dev_task_logs
-- 每条记录 = 一次任务状态变更 / 进度更新 / 审查记录
-- ============================================================
CREATE TABLE IF NOT EXISTS dev_task_logs (
  id              SERIAL        PRIMARY KEY,
  task_id         VARCHAR(64)   NOT NULL REFERENCES dev_tasks(task_id) ON DELETE CASCADE,

  -- 操作信息
  action          VARCHAR(50)   NOT NULL,
  -- action: submit, authorize, start, progress, review, complete, fail, cancel, comment
  actor           VARCHAR(100)  NOT NULL,
  -- actor: 谁做的操作 (霜砚/铸渊/copilot-agent/冰朔)
  actor_type      VARCHAR(20)   NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('persona', 'agent', 'human', 'system', 'workflow')),

  -- 内容
  message         TEXT,
  data            JSONB         DEFAULT '{}'::jsonb,
  -- 任意结构化数据: {step_index, old_status, new_status, review_result, ...}

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dtl_task     ON dev_task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_dtl_action   ON dev_task_logs(action);
CREATE INDEX IF NOT EXISTS idx_dtl_created  ON dev_task_logs(created_at DESC);

-- ============================================================
-- 3. 自动更新 updated_at 触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_dev_task_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dev_task_updated ON dev_tasks;
CREATE TRIGGER trg_dev_task_updated
  BEFORE UPDATE ON dev_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_dev_task_timestamp();

-- ============================================================
-- 4. 状态变更自动记录触发器
-- ============================================================
CREATE OR REPLACE FUNCTION log_dev_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO dev_task_logs (task_id, action, actor, actor_type, message, data)
    VALUES (
      NEW.task_id,
      'status_change',
      COALESCE(current_setting('app.current_actor', true), 'system'),
      COALESCE(current_setting('app.current_actor_type', true), 'system'),
      format('状态变更: %s → %s', OLD.status, NEW.status),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );

    -- 自动设置时间戳
    IF NEW.status = 'authorized' AND NEW.authorized_at IS NULL THEN
      NEW.authorized_at = NOW();
    ELSIF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
      NEW.started_at = NOW();
    ELSIF NEW.status IN ('completed', 'failed') AND NEW.completed_at IS NULL THEN
      NEW.completed_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dev_task_status_log ON dev_tasks;
CREATE TRIGGER trg_dev_task_status_log
  BEFORE UPDATE ON dev_tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_dev_task_status_change();

-- ============================================================
-- 5. 开发任务统计视图
-- ============================================================
CREATE OR REPLACE VIEW dev_task_stats AS
SELECT
  COUNT(*) AS total_tasks,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'authorized') AS authorized,
  COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
  COUNT(*) FILTER (WHERE status = 'review') AS in_review,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
  COUNT(DISTINCT persona_id) AS unique_personas,
  COUNT(DISTINCT agent_id) FILTER (WHERE agent_id IS NOT NULL) AS unique_agents
FROM dev_tasks;

-- ============================================================
-- 6. 人格体开发活动视图
-- ============================================================
CREATE OR REPLACE VIEW persona_dev_activity AS
SELECT
  persona_id,
  submitted_by,
  COUNT(*) AS total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
  COUNT(*) FILTER (WHERE status IN ('pending', 'authorized', 'in_progress', 'review')) AS active_tasks,
  MAX(created_at) AS last_task_at
FROM dev_tasks
WHERE persona_id IS NOT NULL
GROUP BY persona_id, submitted_by;
