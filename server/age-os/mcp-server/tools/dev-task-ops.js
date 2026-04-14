/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · MCP 工具: 跨层开发任务
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 五层架构核心桥接:
 *   L1 网站聊天层 → L2 MCP工具层 → L3 霜砚Agent层 → L4 副驾驶 → L5 铸渊审查
 *
 * 本模块是 L2 MCP工具层 的开发任务管理接口。
 * Notion端人格体(霜砚等)通过这些工具提交开发请求,
 * 铸渊通过GitHub Actions自动执行,副驾驶完成代码开发。
 *
 * 工具清单 (7个):
 *   submitDevTask       — 提交新开发任务 (Notion人格体Agent调用)
 *   getDevTask          — 获取任务详情
 *   listDevTasks        — 列出开发任务 (支持筛选)
 *   updateDevTaskStatus — 更新任务状态
 *   logDevTaskAction    — 记录任务日志
 *   getDevTaskStats     — 获取开发统计
 *   getDevTaskLogs      — 获取任务操作日志
 */

'use strict';

const db = require('../db');

// ─── 任务ID生成 ──────────────────────────────────
function generateTaskId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dateStr = '' + y + m + d;
  // 序号通过数据库查询确定
  return { dateStr, prefix: 'CAB-' + dateStr };
}

/**
 * submitDevTask — 提交新开发任务
 *
 * 这是最关键的工具。Notion端的人格体Agent调用此工具,
 * 就能向铸渊发起开发请求。
 *
 * input:
 *   persona_id: string   — 提交者人格体ID (SY001/YC001/CX001/ZY001)
 *   submitted_by: string — 提交者名称 (霜砚/映川/晨曦/铸渊)
 *   agent_id: string     — Agent编号 (AG-SY-WEB-001)  [可选]
 *   title: string        — 任务标题
 *   description: string  — 任务描述                    [可选]
 *   priority: string     — 优先级 (low/normal/high/urgent)  [可选]
 *   scope: string        — 范围 (tiny/small/medium/large)    [可选]
 *   steps: string[]      — 开发步骤列表
 *   architecture: object — 架构决策                     [可选]
 *   constraints: object  — 约束条件                     [可选]
 *   reasoning: object    — 推理上下文                   [可选]
 */
async function submitDevTask(input) {
  const {
    persona_id, submitted_by, agent_id,
    title, description,
    priority, scope,
    steps, architecture, constraints, reasoning
  } = input;

  if (!submitted_by) throw new Error('缺少 submitted_by (提交者名称)');
  if (!title) throw new Error('缺少 title (任务标题)');
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    throw new Error('缺少 steps (开发步骤列表, 至少一步)');
  }

  // 生成任务ID
  const { prefix } = generateTaskId();
  const seqResult = await db.query(
    "SELECT COUNT(*) AS cnt FROM dev_tasks WHERE task_id LIKE $1",
    [prefix + '%']
  );
  const seq = String(parseInt(seqResult.rows[0].cnt, 10) + 1).padStart(3, '0');
  const taskId = prefix + '-' + seq;

  // 格式化步骤
  const formattedSteps = steps.map(function(s, i) {
    if (typeof s === 'string') {
      return { index: i + 1, step: s, status: 'pending' };
    }
    return { index: i + 1, ...s, status: s.status || 'pending' };
  });

  const result = await db.query(
    `INSERT INTO dev_tasks (
      task_id, persona_id, submitted_by, agent_id,
      title, description, priority, scope, status,
      steps, architecture, constraints, reasoning
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12)
    RETURNING *`,
    [
      taskId,
      persona_id || null,
      submitted_by,
      agent_id || null,
      title,
      description || '',
      priority || 'normal',
      scope || 'small',
      JSON.stringify(formattedSteps),
      JSON.stringify(architecture || {}),
      JSON.stringify(constraints || { required_tests: true, deploy_after: false, max_files_changed: 20 }),
      JSON.stringify(reasoning || {})
    ]
  );

  // 记录提交日志
  await db.query(
    `INSERT INTO dev_task_logs (task_id, action, actor, actor_type, message, data)
     VALUES ($1, 'submit', $2, $3, $4, $5)`,
    [
      taskId,
      submitted_by,
      agent_id ? 'agent' : 'persona',
      '开发任务已提交: ' + title,
      JSON.stringify({
        persona_id: persona_id,
        agent_id: agent_id,
        steps_count: formattedSteps.length,
        priority: priority || 'normal'
      })
    ]
  );

  return {
    task_id: taskId,
    status: 'pending',
    title: title,
    submitted_by: submitted_by,
    steps_count: formattedSteps.length,
    next_step: '任务已提交。铸渊将通过 CAB Bridge 创建 GitHub Issue，副驾驶将执行开发。',
    cab_bridge: {
      pending_path: 'bridge/chat-to-agent/pending/' + taskId + '.json',
      workflow: 'copilot-dev-bridge.yml',
      review_workflow: 'shuangyan-dev-review.yml'
    }
  };
}

/**
 * getDevTask — 获取任务详情
 *
 * input:
 *   task_id: string — 任务ID (CAB-YYYYMMDD-NNN)
 */
async function getDevTask(input) {
  var task_id = input.task_id;
  if (!task_id) throw new Error('缺少 task_id');

  var result = await db.query(
    'SELECT * FROM dev_tasks WHERE task_id = $1',
    [task_id]
  );

  if (result.rows.length === 0) {
    throw new Error('任务不存在: ' + task_id);
  }

  var task = result.rows[0];

  // 获取最近日志
  var logsResult = await db.query(
    'SELECT * FROM dev_task_logs WHERE task_id = $1 ORDER BY created_at DESC LIMIT 10',
    [task_id]
  );

  return {
    ...task,
    recent_logs: logsResult.rows
  };
}

/**
 * listDevTasks — 列出开发任务
 *
 * input:
 *   status: string     — 按状态筛选 (pending/authorized/in_progress/review/completed/failed) [可选]
 *   persona_id: string — 按人格体筛选 [可选]
 *   limit: number      — 返回数量 (默认20, 最大100) [可选]
 *   offset: number     — 偏移量 [可选]
 */
async function listDevTasks(input) {
  var conditions = [];
  var params = [];
  var idx = 1;

  if (input.status) {
    conditions.push('status = $' + idx);
    params.push(input.status);
    idx++;
  }
  if (input.persona_id) {
    conditions.push('persona_id = $' + idx);
    params.push(input.persona_id);
    idx++;
  }

  var limit = Math.min(parseInt(input.limit, 10) || 20, 100);
  var offset = parseInt(input.offset, 10) || 0;

  var where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
  var sql = 'SELECT task_id, persona_id, submitted_by, agent_id, title, status, priority, scope, ' +
    'issue_number, pr_number, created_at, updated_at, completed_at ' +
    'FROM dev_tasks' + where + ' ORDER BY created_at DESC LIMIT $' + idx + ' OFFSET $' + (idx + 1);
  params.push(limit, offset);

  var result = await db.query(sql, params);

  // 获取统计
  var statsResult = await db.query('SELECT * FROM dev_task_stats');

  return {
    tasks: result.rows,
    total: result.rows.length,
    stats: statsResult.rows[0] || {},
    pagination: { limit: limit, offset: offset }
  };
}

/**
 * updateDevTaskStatus — 更新任务状态
 *
 * input:
 *   task_id: string      — 任务ID
 *   status: string       — 新状态 (authorized/in_progress/review/completed/failed/cancelled)
 *   actor: string        — 操作者名称
 *   actor_type: string   — 操作者类型 (persona/agent/human/system/workflow)  [可选]
 *   message: string      — 状态变更说明                                       [可选]
 *   issue_number: number — GitHub Issue编号                                    [可选]
 *   pr_number: number    — PR编号                                              [可选]
 *   result_summary: string — 结果摘要 (完成时)                                [可选]
 *   files_changed: string[] — 变更文件列表 (完成时)                           [可选]
 */
async function updateDevTaskStatus(input) {
  var task_id = input.task_id;
  var status = input.status;
  var actor = input.actor;

  if (!task_id) throw new Error('缺少 task_id');
  if (!status) throw new Error('缺少 status');
  if (!actor) throw new Error('缺少 actor');

  // 构建更新字段
  var sets = ['status = $1'];
  var params = [status];
  var idx = 2;

  if (input.issue_number != null) {
    sets.push('issue_number = $' + idx);
    params.push(input.issue_number);
    idx++;
  }
  if (input.pr_number != null) {
    sets.push('pr_number = $' + idx);
    params.push(input.pr_number);
    idx++;
  }
  if (input.result_summary) {
    sets.push('result_summary = $' + idx);
    params.push(input.result_summary);
    idx++;
  }
  if (input.files_changed) {
    sets.push('files_changed = $' + idx);
    params.push(JSON.stringify(input.files_changed));
    idx++;
  }

  // 设置 app.current_actor 供触发器使用
  await db.query("SELECT set_config('app.current_actor', $1, true)", [actor]);
  await db.query("SELECT set_config('app.current_actor_type', $1, true)", [input.actor_type || 'system']);

  params.push(task_id);
  var result = await db.query(
    'UPDATE dev_tasks SET ' + sets.join(', ') + ' WHERE task_id = $' + idx + ' RETURNING *',
    params
  );

  if (result.rows.length === 0) {
    throw new Error('任务不存在: ' + task_id);
  }

  // 手动记录详细日志 (触发器只记录状态变更)
  if (input.message) {
    await db.query(
      'INSERT INTO dev_task_logs (task_id, action, actor, actor_type, message, data) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        task_id,
        'status_update',
        actor,
        input.actor_type || 'system',
        input.message,
        JSON.stringify({
          new_status: status,
          issue_number: input.issue_number,
          pr_number: input.pr_number
        })
      ]
    );
  }

  return {
    task_id: task_id,
    status: status,
    updated: true,
    task: result.rows[0]
  };
}

/**
 * logDevTaskAction — 记录任务操作日志
 *
 * input:
 *   task_id: string    — 任务ID
 *   action: string     — 操作类型 (progress/comment/review/step_complete)
 *   actor: string      — 操作者
 *   actor_type: string — 操作者类型  [可选]
 *   message: string    — 日志内容
 *   data: object       — 附加数据     [可选]
 */
async function logDevTaskAction(input) {
  var task_id = input.task_id;
  if (!task_id) throw new Error('缺少 task_id');
  if (!input.action) throw new Error('缺少 action');
  if (!input.actor) throw new Error('缺少 actor');

  // 验证任务存在
  var check = await db.query('SELECT task_id FROM dev_tasks WHERE task_id = $1', [task_id]);
  if (check.rows.length === 0) {
    throw new Error('任务不存在: ' + task_id);
  }

  await db.query(
    'INSERT INTO dev_task_logs (task_id, action, actor, actor_type, message, data) VALUES ($1, $2, $3, $4, $5, $6)',
    [
      task_id,
      input.action,
      input.actor,
      input.actor_type || 'system',
      input.message || '',
      JSON.stringify(input.data || {})
    ]
  );

  return { task_id: task_id, logged: true, action: input.action };
}

/**
 * getDevTaskStats — 获取开发任务统计
 *
 * input: (无必需参数)
 */
async function getDevTaskStats() {
  var stats = await db.query('SELECT * FROM dev_task_stats');
  var activity = await db.query('SELECT * FROM persona_dev_activity ORDER BY last_task_at DESC');

  // 最近完成的任务
  var recentCompleted = await db.query(
    'SELECT task_id, title, submitted_by, completed_at FROM dev_tasks WHERE status = $1 ORDER BY completed_at DESC LIMIT 5',
    ['completed']
  );

  // 当前活跃任务
  var activeTasks = await db.query(
    "SELECT task_id, title, submitted_by, status, priority FROM dev_tasks WHERE status IN ('pending', 'authorized', 'in_progress', 'review') ORDER BY priority DESC, created_at ASC"
  );

  return {
    overview: stats.rows[0] || {},
    persona_activity: activity.rows,
    active_tasks: activeTasks.rows,
    recent_completed: recentCompleted.rows
  };
}

/**
 * getDevTaskLogs — 获取任务操作日志
 *
 * input:
 *   task_id: string — 任务ID         [可选, 不填返回全局最近日志]
 *   limit: number   — 返回数量 (默认20) [可选]
 */
async function getDevTaskLogs(input) {
  var limit = Math.min(parseInt(input.limit, 10) || 20, 100);

  var sql, params;
  if (input.task_id) {
    sql = 'SELECT * FROM dev_task_logs WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2';
    params = [input.task_id, limit];
  } else {
    sql = 'SELECT * FROM dev_task_logs ORDER BY created_at DESC LIMIT $1';
    params = [limit];
  }

  var result = await db.query(sql, params);
  return { logs: result.rows, total: result.rows.length };
}

module.exports = {
  submitDevTask,
  getDevTask,
  listDevTasks,
  updateDevTaskStatus,
  logDevTaskAction,
  getDevTaskStats,
  getDevTaskLogs
};
