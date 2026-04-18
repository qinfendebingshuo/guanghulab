/**
 * GLADA · 通知器 · notifier.js
 *
 * 多通道通知系统：
 *   1. QQ邮箱 SMTP 通知（主通道·已打通）
 *   2. 企业微信推送（预留通道·冰朔开通后接入）
 *   3. 文件日志通知（本地记录·始终启用）
 *
 * 通知内容包含：
 *   - 任务编号 + 标题
 *   - 完成步骤列表
 *   - 变更文件清单
 *   - 测试结果
 *   - 开发回执（git branch + commits）
 *
 * 环境变量：
 *   ZY_SMTP_USER        - QQ邮箱账号（同零点原核的SMTP）
 *   ZY_SMTP_PASS        - QQ邮箱授权码
 *   GLADA_NOTIFY_TO     - 通知接收邮箱（默认 = ZY_SMTP_USER）
 *   WECOM_WEBHOOK       - 企业微信机器人 Webhook（可选·预留）
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ROOT = path.resolve(__dirname, '..');
const NOTIFICATION_LOG_DIR = path.join(ROOT, 'glada', 'logs', 'notifications');

// ── SMTP 传输器（懒初始化，复用零点原核频道的 QQ 邮箱配置） ──

let _transporter = null;

function getSmtpTransporter() {
  if (_transporter) return _transporter;

  const smtpUser = process.env.ZY_SMTP_USER;
  const smtpPass = process.env.ZY_SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: true
    }
  });

  return _transporter;
}

/**
 * HTTP 请求工具（用于企业微信等 Webhook 通道）
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
 * @returns {Object} { subject, body, html }
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

  // 生成 HTML 邮件格式
  const html = buildEmailHtml(subject, body, eventType, {
    taskId, title, now, steps, completedSteps, failedSteps,
    allFilesChanged, gitBranch, gitCommits
  });

  return { subject, body, html };
}

/**
 * 构建 GLADA 通知邮件 HTML（光湖视觉风格）
 */
function buildEmailHtml(subject, plainBody, eventType, data) {
  const statusColor = eventType === 'completed' ? '#22d3ee'
    : eventType === 'failed' ? '#f87171'
    : eventType === 'started' ? '#a78bfa'
    : '#60a5fa';

  const statusIcon = eventType === 'completed' ? '✅'
    : eventType === 'failed' ? '❌'
    : eventType === 'started' ? '🚀'
    : '📋';

  const filesHtml = (data.allFilesChanged || []).length > 0
    ? `<div style="margin:16px 0"><strong style="color:#94a3b8">📁 变更文件:</strong><ul style="margin:8px 0;padding-left:20px;color:#cbd5e1">${data.allFilesChanged.map(f => `<li style="margin:2px 0;font-family:monospace;font-size:12px">${f}</li>`).join('')}</ul></div>`
    : '';

  const commitsHtml = (data.gitCommits || []).length > 0
    ? `<div style="margin:16px 0"><strong style="color:#94a3b8">📝 提交记录:</strong><ul style="margin:8px 0;padding-left:20px;color:#cbd5e1">${data.gitCommits.map(c => `<li style="margin:2px 0;font-family:monospace;font-size:12px">${c}</li>`).join('')}</ul></div>`
    : '';

  const stepsHtml = (data.steps || []).length > 0
    ? `<div style="margin:16px 0"><strong style="color:#94a3b8">📊 步骤:</strong><ul style="margin:8px 0;padding-left:20px;color:#cbd5e1">${data.steps.map(s => {
        const icon = s.status === 'completed' ? '✅' : s.status === 'failed' || s.status === 'rolled_back' ? '❌' : '⏳';
        return `<li style="margin:2px 0">${icon} ${s.description || '步骤' + s.step_id}</li>`;
      }).join('')}</ul></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#050810;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif">
<main style="max-width:560px;margin:0 auto;padding:40px 24px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:12px;background:linear-gradient(135deg,rgba(34,211,238,0.15),rgba(167,139,250,0.12));border:1px solid rgba(96,165,250,0.2);font-size:20px;font-weight:900;color:#22d3ee;font-family:serif">渊</div>
  </div>
  <div style="background:rgba(10,16,36,0.95);border-radius:16px;border:1px solid rgba(96,165,250,0.1);padding:28px 24px">
    <div style="text-align:center;margin-bottom:20px">
      <span style="font-size:28px">${statusIcon}</span>
      <h2 style="color:#e2eaf8;font-size:16px;font-weight:700;margin:8px 0 4px">${data.title || ''}</h2>
      <p style="color:#7a8db8;font-size:12px;margin:0">任务 ${data.taskId} · ${data.now}</p>
    </div>
    <div style="background:rgba(${statusColor === '#22d3ee' ? '34,211,238' : statusColor === '#f87171' ? '248,113,113' : '167,139,250'},0.06);border:1px solid rgba(${statusColor === '#22d3ee' ? '34,211,238' : statusColor === '#f87171' ? '248,113,113' : '167,139,250'},0.15);border-radius:10px;padding:16px;margin-bottom:16px">
      <p style="color:${statusColor};font-weight:600;margin:0 0 8px;font-size:14px">${subject}</p>
      <p style="color:#94a3b8;font-size:13px;margin:0">总步骤: ${(data.steps || []).length} · 完成: ${(data.completedSteps || []).length} · 失败: ${(data.failedSteps || []).length}</p>
    </div>
    ${stepsHtml}
    ${filesHtml}
    ${data.gitBranch && data.gitBranch !== '未知' ? `<p style="color:#94a3b8;font-size:12px;margin:8px 0">🌿 分支: <code style="background:rgba(96,165,250,0.1);padding:2px 6px;border-radius:4px;color:#60a5fa">${data.gitBranch}</code></p>` : ''}
    ${commitsHtml}
  </div>
  <div style="text-align:center;margin-top:20px">
    <p style="color:rgba(100,130,180,0.4);font-size:10px;margin:0">铸渊 · GLADA 自主开发Agent · 自动发送</p>
    <p style="color:rgba(100,130,180,0.3);font-size:9px;margin:4px 0 0">版权 国作登字-2026-A-00037559 · TCS-0002∞</p>
  </div>
</main>
</body>
</html>`;
}

/**
 * 发送QQ邮箱通知（主通道）
 * @param {Object} notification - 通知内容 { subject, body, html }
 * @returns {Promise<boolean>}
 */
async function sendEmail(notification) {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    console.log('[GLADA-Notify] ⚠️ QQ邮箱 SMTP 未配置（需要 ZY_SMTP_USER + ZY_SMTP_PASS），跳过邮件通知');
    return false;
  }

  const smtpUser = process.env.ZY_SMTP_USER;
  const notifyTo = process.env.GLADA_NOTIFY_TO || smtpUser;

  try {
    const info = await transporter.sendMail({
      from: `"铸渊 · GLADA Agent" <${smtpUser}>`,
      to: notifyTo,
      subject: notification.subject,
      text: notification.body,
      html: notification.html
    });

    console.log(`[GLADA-Notify] 📧 邮件通知已发送: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[GLADA-Notify] 📧 邮件通知失败: ${err.message}`);
    return false;
  }
}

/**
 * 发送企业微信通知（预留通道·冰朔开通企业微信后接入）
 *
 * 企业微信机器人 Webhook 格式:
 *   https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
 *
 * @param {string} webhook - 企业微信 Webhook URL
 * @param {Object} notification - 通知内容
 * @returns {Promise<boolean>}
 */
async function sendWeCom(webhook, notification) {
  if (!webhook) {
    // 未配置时静默跳过（预留通道，不打印警告）
    return false;
  }

  try {
    const payload = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        content: [
          `### ${notification.subject}`,
          ``,
          notification.body.split('\n').map(line => `> ${line}`).join('\n')
        ].join('\n')
      }
    });

    const response = await httpRequest(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payload);

    const result = JSON.parse(response.body || '{}');
    const success = result.errcode === 0;
    console.log(`[GLADA-Notify] 💬 企业微信通知: ${success ? '✅' : '❌'} ${result.errmsg || ''}`);
    return success;
  } catch (err) {
    console.error(`[GLADA-Notify] 💬 企业微信通知失败: ${err.message}`);
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

  // 2. QQ邮箱 SMTP（主通道）
  const smtpConfigured = !!(process.env.ZY_SMTP_USER && process.env.ZY_SMTP_PASS);
  if (smtpConfigured) {
    results.channels.email = await sendEmail(notification);
  }

  // 3. 企业微信（预留通道）
  const wecomWebhook = process.env.WECOM_WEBHOOK || process.env.GLADA_WECOM_WEBHOOK || '';
  if (wecomWebhook) {
    results.channels.wecom = await sendWeCom(wecomWebhook, notification);
  }

  // 4. 生成开发回执文件
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
  sendEmail,
  sendWeCom,
  writeNotificationLog,
  notify
};
