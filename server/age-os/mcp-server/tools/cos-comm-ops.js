/**
 * ═══════════════════════════════════════════════════════════
 * 模块D+E · COS桶示警Agent + 三方对接 MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 三方通信链路: 代码仓库 ↔ COS桶 ↔ Awen仓库
 *
 * 通信链路:
 *   Notion → 写工单到COS桶 /workorders/pending/
 *   COS桶变动 → 触发SCF云函数 → 唤醒代码仓库铸渊
 *   铸渊整理技术需求 → 写入Awen的COS桶路径 /zhiqiu/tasks/
 *   Awen开发完成 → 回写COS桶 /zhiqiu/reports/ → 铸渊测试确认
 *
 * 工具清单:
 *   cosAlertScan           — 扫描COS桶中的告警
 *   cosAlertResolve        — 解决告警
 *   cosDispatchTask        — 分发开发任务到Awen
 *   cosReadTaskReport      — 读取Awen提交的任务报告
 *   cosListTaskReports     — 列出所有任务报告
 *   cosApproveTask         — 审批任务（通过/驳回）
 *   cosSendNotification    — 发送通知（邮件/Issue）
 *   cosGetCommLink         — 获取通信链路状态
 */

'use strict';

const crypto = require('crypto');
const cos = require('../cos');

// ─── 路径常量 ───
const PATHS = {
  ALERTS: 'zhuyuan/alerts/',
  DIRECTIVES: 'zhuyuan/directives/',
  WORKORDERS_PENDING: 'workorders/pending/',
  WORKORDERS_PROCESSING: 'workorders/processing/',
  WORKORDERS_COMPLETED: 'workorders/completed/',
  AWEN_TASKS: 'zhiqiu/tasks/',
  AWEN_REPORTS: 'zhiqiu/reports/',
  AWEN_PROGRESS: 'zhiqiu/progress/',
  NOTIFICATIONS: 'zhuyuan/notifications/'
};

/**
 * cosAlertScan — 扫描COS桶中的告警
 *
 * input:
 *   bucket: string         — 桶名（默认team）
 *   include_resolved: boolean — 是否包含已解决的告警
 *   limit: number          — 最大数量
 */
async function cosAlertScan(input) {
  const { bucket, include_resolved, limit } = input;
  const targetBucket = bucket || 'team';

  const result = await cos.list(targetBucket, PATHS.ALERTS, limit || 100);
  const alertFiles = result.files.filter(f => f.key.endsWith('.json'));

  // 读取每个告警的详情
  const alerts = [];
  for (const file of alertFiles.slice(0, 50)) {
    try {
      const raw = await cos.read(targetBucket, file.key);
      const alert = JSON.parse(raw.content);
      if (include_resolved || !alert.resolved) {
        alerts.push(alert);
      }
    } catch {
      // 跳过损坏的告警文件
    }
  }

  // 按严重程度排序
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  return {
    alerts,
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    needs_bingshuo: alerts.filter(a => a.notify_bingshuo && !a.resolved).length
  };
}

/**
 * cosAlertResolve — 解决告警
 *
 * input:
 *   bucket: string     — 桶名（默认team）
 *   alert_id: string   — 告警ID
 *   resolution: string — 解决方案描述
 *   resolved_by: string — 解决者
 */
async function cosAlertResolve(input) {
  const { bucket, alert_id, resolution, resolved_by } = input;
  if (!alert_id) throw new Error('缺少 alert_id');

  const targetBucket = bucket || 'team';
  const key = `${PATHS.ALERTS}${alert_id}.json`;

  // 读取现有告警
  const raw = await cos.read(targetBucket, key);
  const alert = JSON.parse(raw.content);

  // 更新状态
  alert.resolved = true;
  alert.resolved_at = new Date().toISOString();
  alert.resolution = resolution || '已处理';
  alert.resolved_by = resolved_by || 'zhuyuan';

  await cos.write(targetBucket, key, JSON.stringify(alert, null, 2), 'application/json');

  return {
    status: 'resolved',
    alert_id,
    resolution: alert.resolution,
    resolved_by: alert.resolved_by
  };
}

/**
 * cosDispatchTask — 分发开发任务到Awen
 *
 * 铸渊整理技术需求后，写入Awen的COS桶路径
 *
 * input:
 *   bucket: string         — 桶名（默认team）
 *   task_id: string        — 任务ID（如 TASK-20260408-001）
 *   title: string          — 任务标题
 *   description: string    — 任务描述
 *   priority: string       — 优先级: critical|high|normal|low
 *   requirements: string[] — 技术需求列表
 *   workorder_id: string   — 关联工单ID（可选）
 *   assigned_to: string    — 指派给（默认zhiqiu/Awen）
 *   deadline: string       — 截止日期（可选）
 */
async function cosDispatchTask(input) {
  const {
    bucket, task_id, title, description, priority,
    requirements, workorder_id, assigned_to, deadline
  } = input;
  if (!title) throw new Error('缺少 title');

  const targetBucket = bucket || 'team';
  const tId = task_id || `TASK-${formatDate()}-${crypto.randomBytes(4).toString('hex')}`;

  // 验证 task_id 安全性
  if (!/^[a-zA-Z0-9_-]+$/.test(tId)) {
    throw new Error('task_id 包含非法字符');
  }

  const now = new Date().toISOString();
  const task = {
    task_id: tId,
    title,
    description: description || '',
    priority: priority || 'normal',
    status: 'pending',
    requirements: requirements || [],
    workorder_id: workorder_id || null,
    assigned_to: assigned_to || 'zhiqiu',
    dispatched_by: 'zhuyuan',
    dispatched_at: now,
    deadline: deadline || null,
    history: [{
      action: 'dispatched',
      timestamp: now,
      by: 'zhuyuan',
      note: '铸渊下发开发任务'
    }]
  };

  const key = `${PATHS.AWEN_TASKS}${tId}.json`;
  await cos.write(targetBucket, key, JSON.stringify(task, null, 2), 'application/json');

  // 如果有关联工单，更新工单状态
  if (workorder_id) {
    try {
      const woKey = `${PATHS.WORKORDERS_PENDING}${workorder_id}.json`;
      const woRaw = await cos.read(targetBucket, woKey);
      const workorder = JSON.parse(woRaw.content);
      workorder.status = 'processing';
      workorder.task_id = tId;
      workorder.updated_at = now;
      workorder.history.push({
        action: 'dispatched_to_awen',
        timestamp: now,
        by: 'zhuyuan',
        task_id: tId
      });

      // 移动到processing目录
      await cos.write(targetBucket, `${PATHS.WORKORDERS_PROCESSING}${workorder_id}.json`,
        JSON.stringify(workorder, null, 2), 'application/json');
      await cos.del(targetBucket, woKey);
    } catch {
      // 工单不存在也不影响任务分发
    }
  }

  return {
    status: 'dispatched',
    task_id: tId,
    key,
    bucket: targetBucket,
    assigned_to: task.assigned_to,
    priority: task.priority,
    workorder_id: task.workorder_id
  };
}

/**
 * cosReadTaskReport — 读取Awen提交的任务报告
 *
 * input:
 *   bucket: string     — 桶名（默认team）
 *   task_id: string    — 任务ID
 */
async function cosReadTaskReport(input) {
  const { bucket, task_id } = input;
  if (!task_id) throw new Error('缺少 task_id');

  const targetBucket = bucket || 'team';
  const key = `${PATHS.AWEN_REPORTS}${task_id}.json`;

  const raw = await cos.read(targetBucket, key);
  return {
    report: JSON.parse(raw.content),
    key,
    size_bytes: raw.size_bytes
  };
}

/**
 * cosListTaskReports — 列出所有任务报告
 *
 * input:
 *   bucket: string — 桶名（默认team）
 *   limit: number  — 最大数量
 */
async function cosListTaskReports(input) {
  const { bucket, limit } = input;
  const targetBucket = bucket || 'team';

  const result = await cos.list(targetBucket, PATHS.AWEN_REPORTS, limit || 100);

  const reports = result.files
    .filter(f => f.key.endsWith('.json'))
    .map(f => ({
      key: f.key,
      task_id: f.key.split('/').pop().replace('.json', ''),
      size_bytes: f.size_bytes
    }));

  return {
    reports,
    count: reports.length
  };
}

/**
 * cosApproveTask — 审批任务（通过/驳回）
 *
 * 铸渊测试确认后，通过/驳回Awen的开发报告
 *
 * input:
 *   bucket: string       — 桶名（默认team）
 *   task_id: string      — 任务ID
 *   approved: boolean    — 是否通过
 *   feedback: string     — 反馈意见
 *   next_task: object    — 下一步任务（仅通过时有效）
 */
async function cosApproveTask(input) {
  const { bucket, task_id, approved, feedback, next_task } = input;
  if (!task_id) throw new Error('缺少 task_id');

  const targetBucket = bucket || 'team';
  const now = new Date().toISOString();

  // 读取原始任务
  let task;
  try {
    const taskRaw = await cos.read(targetBucket, `${PATHS.AWEN_TASKS}${task_id}.json`);
    task = JSON.parse(taskRaw.content);
  } catch {
    task = { task_id, history: [] };
  }

  // 更新状态
  task.status = approved ? 'approved' : 'rejected';
  task.feedback = feedback || '';
  task.reviewed_at = now;
  task.reviewed_by = 'zhuyuan';
  task.history.push({
    action: approved ? 'approved' : 'rejected',
    timestamp: now,
    by: 'zhuyuan',
    feedback: feedback || ''
  });

  // 写回任务文件
  await cos.write(targetBucket, `${PATHS.AWEN_TASKS}${task_id}.json`,
    JSON.stringify(task, null, 2), 'application/json');

  // 写入审批回执
  const receiptKey = `${PATHS.AWEN_PROGRESS}${task_id}-review.json`;
  await cos.write(targetBucket, receiptKey, JSON.stringify({
    task_id,
    approved,
    feedback: feedback || '',
    reviewed_at: now,
    reviewed_by: 'zhuyuan',
    next_task: next_task || null
  }, null, 2), 'application/json');

  // 如果通过且有下一步任务，自动分发
  let nextTaskResult = null;
  if (approved && next_task) {
    try {
      nextTaskResult = await cosDispatchTask({
        bucket: targetBucket,
        title: next_task.title,
        description: next_task.description,
        priority: next_task.priority || 'normal',
        requirements: next_task.requirements || [],
        workorder_id: task.workorder_id
      });
    } catch (err) {
      nextTaskResult = { error: err.message };
    }
  }

  // 如果通过且有关联工单，将工单移到completed
  if (approved && task.workorder_id) {
    try {
      const woKey = `${PATHS.WORKORDERS_PROCESSING}${task.workorder_id}.json`;
      const woRaw = await cos.read(targetBucket, woKey);
      const workorder = JSON.parse(woRaw.content);
      workorder.status = 'completed';
      workorder.completed_at = now;
      workorder.history.push({
        action: 'completed',
        timestamp: now,
        by: 'zhuyuan',
        task_id
      });
      await cos.write(targetBucket, `${PATHS.WORKORDERS_COMPLETED}${task.workorder_id}.json`,
        JSON.stringify(workorder, null, 2), 'application/json');
      await cos.del(targetBucket, woKey);
    } catch { /* ignore */ }
  }

  return {
    status: approved ? 'approved' : 'rejected',
    task_id,
    feedback: feedback || '',
    receipt_key: receiptKey,
    next_task: nextTaskResult
  };
}

/**
 * cosSendNotification — 发送通知
 *
 * 将通知写入COS桶，由外部Agent（GitHub Actions/SCF）处理发送
 *
 * input:
 *   bucket: string       — 桶名（默认team）
 *   notification_type: string — 通知类型: email|issue|cos_alert
 *   recipient: string    — 接收者
 *   subject: string      — 主题
 *   body: string         — 内容
 *   metadata: object     — 附加信息
 */
async function cosSendNotification(input) {
  const { bucket, notification_type, recipient, subject, body, metadata } = input;
  if (!notification_type || !subject) throw new Error('缺少 notification_type 或 subject');

  const targetBucket = bucket || 'team';
  const notificationId = `NOTIF-${Date.now()}`;
  const now = new Date().toISOString();

  const notification = {
    notification_id: notificationId,
    type: notification_type,
    recipient: recipient || 'bingshuo',
    subject,
    body: body || '',
    metadata: metadata || {},
    status: 'pending',
    created_at: now,
    sent_at: null
  };

  const key = `${PATHS.NOTIFICATIONS}${notificationId}.json`;
  await cos.write(targetBucket, key, JSON.stringify(notification, null, 2), 'application/json');

  return {
    notification_id: notificationId,
    type: notification_type,
    key,
    status: 'queued',
    note: '通知已入队，等待发送Agent处理'
  };
}

/**
 * cosGetCommLink — 获取通信链路状态
 *
 * 检查三方通信链路的健康状态
 *
 * input:
 *   bucket: string — 桶名（默认team）
 */
async function cosGetCommLink(input) {
  const { bucket } = input;
  const targetBucket = bucket || 'team';

  // 检查各路径是否可访问
  const checks = {};
  for (const [name, path] of Object.entries(PATHS)) {
    try {
      const result = await cos.list(targetBucket, path, 5);
      checks[name] = {
        status: 'accessible',
        files: result.files.length
      };
    } catch (err) {
      checks[name] = {
        status: 'error',
        error: err.message
      };
    }
  }

  // 统计待处理项
  const pending = {
    alerts: checks.ALERTS?.files || 0,
    workorders: checks.WORKORDERS_PENDING?.files || 0,
    task_reports: checks.AWEN_REPORTS?.files || 0,
    notifications: checks.NOTIFICATIONS?.files || 0
  };

  return {
    comm_link: 'zhuyuan-cos-awen',
    bucket: targetBucket,
    paths: checks,
    pending,
    health: Object.values(checks).every(c => c.status === 'accessible') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString()
  };
}

// ─── 辅助 ───

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = {
  cosAlertScan,
  cosAlertResolve,
  cosDispatchTask,
  cosReadTaskReport,
  cosListTaskReports,
  cosApproveTask,
  cosSendNotification,
  cosGetCommLink
};
