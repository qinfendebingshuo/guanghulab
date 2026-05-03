/**
 * ═══════════════════════════════════════════════════════════
 * 📧 铸渊运维守卫 · 通知系统
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-NTF-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 通知通道:
 *   1. QQ邮箱 SMTP（主通道）
 *   2. 本地文件日志（始终启用）
 *   3. 工单推送到前端（通过 HTTP API）
 */

'use strict';

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const memory = require('./memory');

// ── 全局开关 + 冷却 ──────────────────────────
//
// OPS_EMAIL_ENABLED:
//   - 默认 true。设为 'false'/'0' 时所有邮件函数立即 no-op（kill switch）。
//   - 用法：`pm2 set ops-agent:OPS_EMAIL_ENABLED false && pm2 restart ops-agent`
//
// OPS_ALERT_COOLDOWN_MINUTES:
//   - 默认 360（6 小时）。同一 (service+severity) 的告警与工单邮件在该间隔内只发一次，
//     避免高频持续故障（例如 MCP 连接超时）刷屏。

const COOLDOWN_MINUTES = (() => {
  const v = parseInt(process.env.OPS_ALERT_COOLDOWN_MINUTES || '360', 10);
  return Number.isFinite(v) && v >= 0 ? v : 360;
})();

const _lastSentAt = new Map(); // key -> epoch ms

function isEmailEnabled() {
  // ⚠️ D72 (2026-05-03) 冰朔决策：默认禁用所有邮件告警。
  // 服务器持续给冰朔发"大脑服务器异常"邮件，已成为噪音。
  // 如需重新启用：显式设置 OPS_EMAIL_ENABLED=true (大小写不敏感)。
  // 之前默认是 true，本次翻转默认为 false。
  const v = process.env.OPS_EMAIL_ENABLED;
  if (v === undefined || v === null || v === '') return false;
  const norm = String(v).trim().toLowerCase();
  return norm === 'true' || norm === '1' || norm === 'yes' || norm === 'on';
}

function cooldownRemainingMs(key) {
  const last = _lastSentAt.get(key);
  if (!last) return 0;
  const elapsed = Date.now() - last;
  const windowMs = COOLDOWN_MINUTES * 60 * 1000;
  return elapsed >= windowMs ? 0 : windowMs - elapsed;
}

function markSent(key) {
  _lastSentAt.set(key, Date.now());
}

// ── SMTP 传输器（懒初始化） ──────────────

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

// ── 发送邮件告警 ────────────────────────────

async function sendAlertEmail(subject, htmlBody) {
  if (!isEmailEnabled()) {
    console.log('[Notifier] OPS_EMAIL_ENABLED=false，跳过邮件发送');
    return { sent: false, reason: 'disabled' };
  }

  const transporter = getSmtpTransporter();
  if (!transporter) {
    console.log('[Notifier] SMTP 未配置，跳过邮件发送');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const smtpUser = process.env.ZY_SMTP_USER;
  const notifyTo = process.env.OPS_NOTIFY_EMAIL || smtpUser;

  try {
    const info = await transporter.sendMail({
      from: `"铸渊运维守卫" <${smtpUser}>`,
      to: notifyTo,
      subject: `🛡️ ${subject}`,
      html: htmlBody
    });
    console.log(`[Notifier] 邮件已发送: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Notifier] 邮件发送失败: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

// ── 生成告警邮件 HTML ──────────────────────

function buildAlertHTML(title, issues, checkResult) {
  const issueRows = issues.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #1a2332;color:${
        i.severity === 'critical' ? '#ff4444' :
        i.severity === 'high' ? '#ff8800' :
        '#ffcc00'
      }">${i.severity?.toUpperCase() || 'UNKNOWN'}</td>
      <td style="padding:8px;border-bottom:1px solid #1a2332;color:#e0e6ed">${i.service}</td>
      <td style="padding:8px;border-bottom:1px solid #1a2332;color:#8899aa">${i.error || i.status}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050810;font-family:'Segoe UI',sans-serif">
<div style="max-width:600px;margin:20px auto;background:#0a0f1a;border:1px solid #1a2332;border-radius:8px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#0a1628,#1a0a28);padding:20px;text-align:center">
    <h1 style="color:#22d3ee;margin:0;font-size:18px">🛡️ 铸渊运维守卫 · 告警通知</h1>
    <p style="color:#667788;margin:5px 0 0;font-size:12px">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
  </div>
  <div style="padding:20px">
    <h2 style="color:#ff8800;font-size:16px;margin:0 0 15px">${title}</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:2px solid #1a2332">
          <th style="padding:8px;text-align:left;color:#667788;font-size:12px">严重度</th>
          <th style="padding:8px;text-align:left;color:#667788;font-size:12px">服务</th>
          <th style="padding:8px;text-align:left;color:#667788;font-size:12px">问题</th>
        </tr>
      </thead>
      <tbody>
        ${issueRows}
      </tbody>
    </table>
    ${checkResult?.summary ? `<p style="color:#8899aa;margin:15px 0 0;font-size:13px">${checkResult.summary}</p>` : ''}
  </div>
  <div style="padding:15px 20px;background:#060a14;text-align:center">
    <p style="color:#445566;margin:0;font-size:11px">铸渊运维守卫 · ZY-OPS-001 · 光湖实验室</p>
  </div>
</div>
</body>
</html>`;
}

// ── 告警通知（巡检发现问题时调用） ──────────

async function alertOnIssues(checkResult) {
  if (!checkResult.issues || checkResult.issues.length === 0) return;

  const criticalIssues = checkResult.issues.filter(i => i.severity === 'critical' || i.severity === 'high');
  if (criticalIssues.length === 0) return; // 只对高/紧急级别发邮件

  // 冷却：剔除最近已通知过的 (service+severity)
  const freshIssues = [];
  const skipped = [];
  for (const i of criticalIssues) {
    const key = `alert:${i.service || 'unknown'}:${i.severity || 'unknown'}`;
    const remaining = cooldownRemainingMs(key);
    if (remaining > 0) {
      skipped.push({ key, remainingMinutes: Math.ceil(remaining / 60000) });
    } else {
      freshIssues.push({ issue: i, key });
    }
  }

  if (skipped.length > 0) {
    console.log(`[Notifier] 冷却中跳过 ${skipped.length} 个告警: ${skipped.map(s => `${s.key}(${s.remainingMinutes}m)`).join(', ')}`);
  }

  if (freshIssues.length === 0) {
    return { sent: false, reason: 'cooldown', skipped: skipped.length };
  }

  const issuesToSend = freshIssues.map(f => f.issue);
  const title = `发现 ${issuesToSend.length} 个严重问题`;
  const html = buildAlertHTML(title, issuesToSend, checkResult);

  // 发邮件
  const emailResult = await sendAlertEmail(title, html);

  // 仅在真正发出去时记录冷却时间戳，避免 SMTP 失败导致永久静默
  if (emailResult && emailResult.sent) {
    for (const f of freshIssues) markSent(f.key);
  }

  // 记录事件
  memory.logEvent('alert', {
    title,
    issueCount: issuesToSend.length,
    skippedByCooldown: skipped.length,
    emailSent: emailResult.sent,
    summary: checkResult.summary
  });

  return emailResult;
}

// ── 工单升级通知 ────────────────────────────

async function notifyTicketCreated(ticket) {
  // 冷却兜底：同一 (service+severity) 在窗口内只发一次工单邮件
  const cooldownKey = `ticket:${ticket.relatedService || ticket.title || 'unknown'}:${ticket.severity || 'unknown'}`;
  const remaining = cooldownRemainingMs(cooldownKey);
  if (remaining > 0) {
    console.log(`[Notifier] 工单邮件冷却中(${Math.ceil(remaining / 60000)}分钟剩余)，跳过 ${ticket.id}`);
    return { sent: false, reason: 'cooldown' };
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050810;font-family:'Segoe UI',sans-serif">
<div style="max-width:600px;margin:20px auto;background:#0a0f1a;border:1px solid #1a2332;border-radius:8px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#0a1628,#1a0a28);padding:20px;text-align:center">
    <h1 style="color:#22d3ee;margin:0;font-size:18px">🎫 运维工单 · ${ticket.id}</h1>
  </div>
  <div style="padding:20px">
    <h2 style="color:#e0e6ed;font-size:16px;margin:0 0 10px">${ticket.title}</h2>
    <p style="color:#8899aa;margin:5px 0"><b>严重度:</b> <span style="color:${
      ticket.severity === 'critical' ? '#ff4444' :
      ticket.severity === 'high' ? '#ff8800' : '#ffcc00'
    }">${ticket.severity}</span></p>
    <p style="color:#8899aa;margin:5px 0"><b>处理方向:</b> ${ticket.direction}</p>
    <p style="color:#8899aa;margin:5px 0"><b>诊断:</b> ${ticket.diagnosis}</p>
    ${ticket.suggestedFix ? `<p style="color:#8899aa;margin:5px 0"><b>建议:</b> ${ticket.suggestedFix}</p>` : ''}
    <p style="color:#8899aa;margin:5px 0"><b>自动修复尝试:</b> ${ticket.autoRepairAttempts}次（均未成功）</p>
  </div>
  <div style="padding:15px 20px;background:#060a14;text-align:center">
    <p style="color:#445566;margin:0;font-size:11px">铸渊运维守卫 · 自动生成工单</p>
  </div>
</div>
</body>
</html>`;

  const result = await sendAlertEmail(`新工单 ${ticket.id}: ${ticket.title}`, html);
  if (result && result.sent) markSent(cooldownKey);
  return result;
}

// ── 每日报告邮件 ────────────────────────────

async function sendDailyReport(report) {
  const serviceRows = (report.services || []).map(s => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #1a2332;color:#e0e6ed">${s.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1a2332;color:${s.status === 'online' ? '#22d3ee' : '#ff4444'}">${s.status}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #1a2332;color:#8899aa">${s.latency || '-'}ms</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#050810;font-family:'Segoe UI',sans-serif">
<div style="max-width:600px;margin:20px auto;background:#0a0f1a;border:1px solid #1a2332;border-radius:8px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#0a1628,#1a0a28);padding:20px;text-align:center">
    <h1 style="color:#22d3ee;margin:0;font-size:18px">📊 光湖每日健康报告</h1>
    <p style="color:#667788;margin:5px 0 0;font-size:12px">${report.report_id}</p>
  </div>
  <div style="padding:20px">
    <h3 style="color:#e0e6ed;margin:0 0 10px">服务状态</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:2px solid #1a2332">
        <th style="padding:6px 8px;text-align:left;color:#667788">服务</th>
        <th style="padding:6px 8px;text-align:left;color:#667788">状态</th>
        <th style="padding:6px 8px;text-align:left;color:#667788">延迟</th>
      </tr></thead>
      <tbody>${serviceRows}</tbody>
    </table>
    ${report.resources ? `
    <h3 style="color:#e0e6ed;margin:15px 0 10px">系统资源</h3>
    <p style="color:#8899aa;font-size:13px">
      内存: ${report.resources.memory.used_pct}% · 
      磁盘: ${report.resources.disk.used_pct}% · 
      负载: ${report.resources.load?.[0]?.toFixed(2) || '-'} · 
      运行: ${report.resources.uptime_hours}h
    </p>` : ''}
    <p style="color:#22d3ee;margin:15px 0 0;font-size:14px">${report.summary}</p>
    ${report.recommendations ? `
    <h3 style="color:#e0e6ed;margin:15px 0 10px">建议</h3>
    <ul style="color:#8899aa;font-size:13px;padding-left:20px">
      ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>` : ''}
  </div>
  <div style="padding:15px 20px;background:#060a14;text-align:center">
    <p style="color:#445566;margin:0;font-size:11px">铸渊运维守卫 · 每日自动报告</p>
  </div>
</div>
</body>
</html>`;

  return sendAlertEmail(`每日报告 ${report.report_id}`, html);
}

module.exports = {
  sendAlertEmail,
  alertOnIssues,
  notifyTicketCreated,
  sendDailyReport,
  getSmtpTransporter,
  isEmailEnabled,
  // 供测试使用
  _resetCooldownForTests: () => _lastSentAt.clear()
};
