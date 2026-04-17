/**
 * GLADA · 通知器 · notifier.js
 *
 * 多通道通知系统：
 *   1. QQ邮箱 SMTP 通知
 *   2. 钉钉机器人通知
 *   3. 文件日志通知（本地记录）
 *
 * 通知内容包含：
 *   - 任务编号 + 标题
 *   - 完成步骤列表
 *   - 变更文件清单
 *   - 测试结果
 *   - 开发回执（git branch + commits）
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOTIFICATION_LOG_DIR = path.join(ROOT, 'glada', 'logs', 'notifications');

/**
 * HTTP 请求工具
 */
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'POST',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * 构建通知内容
 * @param {Object} gladaTask - GLADA 任务
 * @param {string} eventType - 事件类型: completed | failed | step_completed | started
 * @returns {Object} { subject, body, markdown }
 */
function buildNotification(gladaTask, eventType) {
  const taskId = gladaTask.glada_task_id;
  const title = gladaTask.plan.title;
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const steps = gladaTask.plan.steps || [];
  const completedSteps = steps.filter(s => s.status === 'completed');
  const failedSteps = steps.filter(s => s.status === 'failed' || s.status === 'rolled_back');

  const allFilesChanged = gladaTask.completion?.total_files_changed || [];
  const gitBranch = gladaTask.completion?.git_branch || '未知';
  const gitCommits = gladaTask.completion?.git_commits || [];

  let subject = '';
  let body = '';
  let markdown = '';

  switch (eventType) {
    case 'completed':
      subject = `✅ GLADA任务完成: ${taskId} · ${title}`;
      body = [
        `🎉 GLADA 任务已完成`,
        ``,
        `任务编号: ${taskId}`,
        `任务标题: ${title}`,
        `完成时间: ${now}`,
        ``,
        `📊 执行概况:`,
        `  - 总步骤: ${steps.length}`,
        `  - 已完成: ${completedSteps.length}`,
        `  - 失败: ${failedSteps.length}`,
        ``,
        `📁 变更文件 (${allFilesChanged.length}):`,
        ...allFilesChanged.map(f => `  - ${f}`),
        ``,
        `🌿 Git 分支: ${gitBranch}`,
        `📝 提交记录:`,
        ...gitCommits.map(c => `  - ${c}`),
        ``,
        `请打开副驾驶验收: "GLADA任务 ${taskId} 已完成，请验收"`,
      ].join('\n');
      break;

    case 'failed':
      subject = `❌ GLADA任务失败: ${taskId} · ${title}`;
      body = [
        `⚠️ GLADA 任务执行失败`,
        ``,
        `任务编号: ${taskId}`,
        `任务标题: ${title}`,
        `失败时间: ${now}`,
        ``,
        `📊 执行概况:`,
        `  - 总步骤: ${steps.length}`,
        `  - 已完成: ${completedSteps.length}`,
        `  - 失败: ${failedSteps.length}`,
        ``,
        `❌ 失败步骤:`,
        ...failedSteps.map(s => `  - 步骤${s.step_id}: ${s.description} (${s.error || '未知错误'})`),
        ``,
        `请打开副驾驶排查: "GLADA任务 ${taskId} 失败了，请帮我排查"`,
      ].join('\n');
      break;

    case 'step_completed':
      subject = `📋 GLADA进度: ${taskId} · 步骤${completedSteps.length}/${steps.length}`;
      body = [
        `GLADA 步骤完成通知`,
        ``,
        `任务: ${title}`,
        `进度: ${completedSteps.length}/${steps.length}`,
        `时间: ${now}`,
      ].join('\n');
      break;

    case 'started':
      subject = `🚀 GLADA任务开始: ${taskId} · ${title}`;
      body = [
        `GLADA 任务已开始执行`,
        ``,
        `任务编号: ${taskId}`,
        `任务标题: ${title}`,
        `总步骤: ${steps.length}`,
        `开始时间: ${now}`,
      ].join('\n');
      break;

    default:
      subject = `GLADA: ${taskId}`;
      body = `任务 ${taskId} 状态更新: ${eventType}`;
  }

  // Markdown 格式（用于钉钉等）
  markdown = body.replace(/^/gm, '> ').replace(/^> $/, '>');

  return { subject, body, markdown };
}

/**
 * 发送钉钉通知
 * @param {string} webhook - 钉钉 Webhook URL
 * @param {Object} notification - 通知内容
 * @returns {Promise<boolean>}
 */
async function sendDingTalk(webhook, notification) {
  if (!webhook) {
    console.log('[GLADA-Notify] ⚠️ 钉钉 Webhook 未配置，跳过');
    return false;
  }

  try {
    const payload = JSON.stringify({
      msgtype: 'text',
      text: {
        content: `[GLADA]\n${notification.body}`
      }
    });

    const response = await httpRequest(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payload);

    const success = response.status === 200;
    console.log(`[GLADA-Notify] 钉钉通知: ${success ? '✅' : '❌'}`);
    return success;
  } catch (err) {
    console.error(`[GLADA-Notify] 钉钉通知失败: ${err.message}`);
    return false;
  }
}

/**
 * 写入本地通知日志
 * @param {Object} notification - 通知内容
 * @param {string} taskId - 任务 ID
 */
function writeNotificationLog(notification, taskId) {
  fs.mkdirSync(NOTIFICATION_LOG_DIR, { recursive: true });

  const logEntry = {
    timestamp: new Date().toISOString(),
    task_id: taskId,
    subject: notification.subject,
    body: notification.body,
    channels: []
  };

  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(NOTIFICATION_LOG_DIR, `notify-${today}.jsonl`);

  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf-8');
}

/**
 * 发送任务通知（所有通道）
 * @param {Object} gladaTask - GLADA 任务
 * @param {string} eventType - 事件类型
 * @returns {Promise<Object>} 发送结果
 */
async function notify(gladaTask, eventType) {
  const notification = buildNotification(gladaTask, eventType);
  const results = { channels: {} };

  console.log(`[GLADA-Notify] 📣 ${notification.subject}`);

  // 1. 本地日志（始终记录）
  writeNotificationLog(notification, gladaTask.glada_task_id);
  results.channels.log = true;

  // 2. 钉钉
  const dingWebhook = process.env.DINGTALK_WEBHOOK || process.env.GLADA_DINGTALK_WEBHOOK || '';
  if (dingWebhook) {
    results.channels.dingtalk = await sendDingTalk(dingWebhook, notification);
  }

  // 3. 生成开发回执文件
  if (eventType === 'completed' || eventType === 'failed') {
    const receiptPath = path.join(ROOT, 'glada', 'receipts', `${gladaTask.glada_task_id}.json`);
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify({
      task_id: gladaTask.glada_task_id,
      source_task_id: gladaTask.source_task_id,
      status: eventType,
      title: gladaTask.plan.title,
      completed_at: new Date().toISOString(),
      steps_summary: gladaTask.plan.steps.map(s => ({
        step_id: s.step_id,
        description: s.description,
        status: s.status
      })),
      files_changed: gladaTask.completion?.total_files_changed || [],
      git_branch: gladaTask.completion?.git_branch || null,
      git_commits: gladaTask.completion?.git_commits || [],
      notification: notification.subject
    }, null, 2), 'utf-8');

    results.channels.receipt = true;
    console.log(`[GLADA-Notify] 📄 开发回执: ${receiptPath}`);
  }

  return results;
}

module.exports = {
  buildNotification,
  sendDingTalk,
  writeNotificationLog,
  notify
};
