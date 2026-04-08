#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/email-hub.js
// 📧 光湖语言世界 · 邮件通信中枢
//
// ∞版本邮件中枢 — 统一管理所有用户邮件推送
//
// 邮件类型:
//   1. 月初重置通知 — 每月1号通知流量池已重置
//   2. 更新升级通知 — 系统更新后告知用户 (含VPN系统介绍)
//   3. 流量预警通知 — 70%/80%/90%/100% 阶梯告警
//   4. 安全风险提醒 — 单用户异常行为告知
//   5. 反馈确认回复 — 收到用户反馈后的自动确认
//   6. 带宽共享验证码 — 发送6位验证码 (∞+1·含VPN系统介绍)
//   7. 风险提示通知 — 全体用户风险提醒 (∞+1)
//   8. 安全恢复通知 — 危机解除后全体通知 (∞+1)
//   9. V3订阅链接 — 含系统介绍 + 带宽共享邀请 (∞+1)
//
// 所有邮件底部附「意见反馈」链接
//
// 用法:
//   node email-hub.js monthly-reset         — 发送月初重置邮件给所有用户
//   node email-hub.js update-notify [desc] — 一键发送更新通知给所有用户 (省略desc则读取release-notes.json)
//   node email-hub.js update-notify-single <email> [desc] — 发送更新通知给单个用户
//   node email-hub.js traffic-warn <pct>    — 发送流量预警给所有用户
//   node email-hub.js security-warn <email> <msg>  — 发送安全提醒给单用户
//   node email-hub.js feedback-ack <email>  — 发送反馈确认给单用户
//   node email-hub.js bandwidth-auth <email> — 发送带宽共享验证码 (单用户·∞+1)
//   node email-hub.js bandwidth-auth-all    — 一键发送带宽验证码 (全部用户·∞+1)
//   node email-hub.js threat-alert <msg>    — 全体用户风险提示 (∞+1)
//   node email-hub.js threat-cleared        — 全体用户安全恢复通知 (∞+1)
//   node email-hub.js send-subscription-v3 <email> — 发送V3订阅链接 (含系统介绍+带宽共享邀请)
//   node email-hub.js list-emails           — 列出所有启用用户的邮箱
//
// 运行方式: CLI调用 (由auto-evolution.js调度)
// ═══════════════════════════════════════════════

'use strict';

const tls = require('tls');
const fs = require('fs');
const path = require('path');

const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const KEYS_FILE = process.env.ZY_PROXY_KEYS_FILE || path.join(PROXY_DIR, '.env.keys');
const POOL_STATUS_FILE = path.join(DATA_DIR, 'pool-quota-status.json');
const EMAIL_LOG_FILE = path.join(DATA_DIR, 'email-hub-log.json');
const RELEASE_NOTES_FILE = path.join(__dirname, '../config/release-notes.json');

// ── 带宽授权页面域名 ─────────────────────────
// QQ邮箱拦截所有可点击链接，邮件中仅含验证码+纯文本网址引导
// 用户在浏览器中手动输入 guanghulab.online/auth 访问公开授权页面
// guanghulab.online/auth 通过Nginx代理到大脑服务器V3订阅服务 /bandwidth-auth-open
const BW_AUTH_HOST = process.env.ZY_BW_AUTH_HOST || 'guanghulab.online';

// ── 加载版本更新说明 ────────────────────────────
function loadReleaseNotes() {
  try {
    const notes = JSON.parse(fs.readFileSync(RELEASE_NOTES_FILE, 'utf-8'));
    if (notes.features && Array.isArray(notes.features) && notes.features.length > 0) {
      return notes.features.join(';');
    }
  } catch {
    // release-notes.json 不存在或格式错误，忽略
  }
  return '';
}

// ── 加载完整版本信息对象 ───────────────────────────
function loadReleaseNotesObj() {
  try {
    return JSON.parse(fs.readFileSync(RELEASE_NOTES_FILE, 'utf-8'));
  } catch {
    return { version: '∞+1', updated_at: '', features: [] };
  }
}

// ── VPN系统介绍HTML (通用模块) ─────────────────────
function getVpnSystemIntroHtml(releaseNotes) {
  const version = (releaseNotes && releaseNotes.version) || '∞+1';
  const updatedAt = (releaseNotes && releaseNotes.updated_at) || '';

  return `
    <!-- VPN系统介绍 -->
    <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%); border-radius: 12px; padding: 20px; margin: 0 0 24px; border: 1px solid #d6dce5;">
      <h3 style="color: #1a1a2e; font-size: 15px; margin: 0 0 12px; font-weight: 700;">🔰 关于光湖语言世界 · VPN专线</h3>
      <p style="color: #555; font-size: 13px; margin: 0 0 16px; line-height: 1.8;">
        本VPN节点由<strong style="color: #333;">光湖语言系统</strong>完全自主研发，<strong style="color: #e74c3c;">仅供团队内部自用</strong>。<br>
        非商业服务，不面向公众开放。所有用户均为受邀团队成员。
      </p>

      <h4 style="color: #1a1a2e; font-size: 14px; margin: 0 0 10px; font-weight: 600;">🏗️ 核心技术架构</h4>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin: 0 0 16px;">
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 12px; color: #667eea; font-size: 13px; font-weight: 600; width: 30%; white-space: nowrap;">传输协议</td>
          <td style="padding: 8px 12px; color: #444; font-size: 13px;">VLESS + Reality — 业界顶级隐蔽传输协议，流量特征完全伪装</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 12px; color: #667eea; font-size: 13px; font-weight: 600;">防御体系</td>
          <td style="padding: 8px 12px; color: #444; font-size: 13px;">蜂群防御 · Moving Target Defense — 多服务器动态融合/分裂，真节点永远隐匿</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 12px; color: #667eea; font-size: 13px; font-weight: 600;">隐私保护</td>
          <td style="padding: 8px 12px; color: #444; font-size: 13px;">用户守护Agent — 每条专线专属守护人格体，自毁式隐私保护</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 12px; color: #667eea; font-size: 13px; font-weight: 600;">智能选路</td>
          <td style="padding: 8px 12px; color: #444; font-size: 13px;">协议镜像加速 — AI自动探测最优路径，连接速度与稳定性大幅提升</td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
          <td style="padding: 8px 12px; color: #667eea; font-size: 13px; font-weight: 600;">自主进化</td>
          <td style="padding: 8px 12px; color: #444; font-size: 13px;">AI驱动进化引擎 — 系统自动检测并升级核心协议，无需手动操作</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #667eea; font-size: 13px; font-weight: 600;">安全层级</td>
          <td style="padding: 8px 12px; color: #444; font-size: 13px;">7层安全体系 — 语言膜·蜂群分裂·真节点隐匿·守护Agent·威胁切断·日志格式化·自毁消失</td>
        </tr>
      </table>

      <div style="background: rgba(102,126,234,0.1); border-radius: 8px; padding: 10px 14px;">
        <span style="color: #667eea; font-size: 13px; font-weight: 700;">📌 当前系统版本: ${escapeHtml(version)}</span>
        ${updatedAt ? `<span style="color: #999; font-size: 12px; margin-left: 12px;">更新于 ${escapeHtml(updatedAt)}</span>` : ''}
      </div>
    </div>`;
}

// ── 加载配置 ─────────────────────────────────
function loadConfig() {
  const config = {
    smtp_user: process.env.ZY_SMTP_USER || '',
    smtp_pass: process.env.ZY_SMTP_PASS || '',
    server_host: process.env.ZY_SERVER_HOST || ''
  };

  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      const k = key.trim();
      const v = vals.join('=').trim();
      if (!v) continue;
      if (k === 'ZY_SERVER_HOST' && !config.server_host) config.server_host = v;
      if (k === 'ZY_SMTP_USER' && !config.smtp_user) config.smtp_user = v;
      if (k === 'ZY_SMTP_PASS' && !config.smtp_pass) config.smtp_pass = v;
    }
  } catch { /* ignore */ }

  return config;
}

// ── SMTP发送邮件 ─────────────────────────────
function detectSmtpHost(email) {
  if (email.includes('@qq.com')) return 'smtp.qq.com';
  if (email.includes('@163.com')) return 'smtp.163.com';
  if (email.includes('@126.com')) return 'smtp.126.com';
  if (email.includes('@gmail.com')) return 'smtp.gmail.com';
  if (email.includes('@outlook.com') || email.includes('@hotmail.com')) return 'smtp.office365.com';
  if (email.includes('@yeah.net')) return 'smtp.yeah.net';
  return 'smtp.qq.com';
}

async function sendEmail(to, subject, htmlBody) {
  const config = loadConfig();
  if (!config.smtp_user || !config.smtp_pass) {
    throw new Error('SMTP未配置 (需要ZY_SMTP_USER和ZY_SMTP_PASS)');
  }

  const smtpHost = detectSmtpHost(config.smtp_user);
  const smtpPort = 465;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { socket.destroy(); } catch { /* ignore */ }
        reject(new Error('SMTP超时(30s)'));
      }
    }, 30000);

    const socket = tls.connect(smtpPort, smtpHost, {}, () => {
      let step = 0;
      let buffer = '';
      const from = config.smtp_user;

      const commands = [
        `EHLO zy-proxy\r\n`,
        `AUTH LOGIN\r\n`,
        `${Buffer.from(from).toString('base64')}\r\n`,
        `${Buffer.from(config.smtp_pass).toString('base64')}\r\n`,
        `MAIL FROM:<${from}>\r\n`,
        `RCPT TO:<${to}>\r\n`,
        `DATA\r\n`,
        `From: =?UTF-8?B?${Buffer.from('光湖语言世界').toString('base64')}?= <${from}>\r\nTo: <${to}>\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nContent-Type: text/html; charset=utf-8\r\nMIME-Version: 1.0\r\n\r\n${htmlBody}\r\n.\r\n`,
        `QUIT\r\n`
      ];

      // SMTP多行响应正确处理:
      // 多行响应格式: "250-xxx\r\n" (中间行用减号), 最终行: "250 xxx\r\n" (用空格)
      // 只有收到最终行(NNN + 空格)时才发送下一条命令
      socket.on('data', (chunk) => {
        buffer += chunk.toString();

        // 逐行处理完整的SMTP响应
        while (buffer.includes('\r\n')) {
          const lineEnd = buffer.indexOf('\r\n');
          const line = buffer.substring(0, lineEnd);
          buffer = buffer.substring(lineEnd + 2);

          // 检查是否为最终响应行 (NNN + 空格 或 NNN 结束)
          const match = line.match(/^(\d{3})([ -])/);
          if (!match) continue;

          const statusCode = parseInt(match[1], 10);
          const isFinal = match[2] === ' '; // 空格=最终行, 减号=还有后续行

          if (!isFinal) continue; // 多行响应中间行，等待最终行

          // 检查错误响应 (4xx/5xx)
          if (statusCode >= 400) {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              try { socket.destroy(); } catch { /* ignore */ }
              reject(new Error(`SMTP错误(${statusCode}): ${line}`));
            }
            return;
          }

          // 发送下一条命令
          if (step < commands.length) {
            socket.write(commands[step]);
            step++;
          }

          // 所有命令已发送且收到最终响应
          if (step >= commands.length && !settled) {
            settled = true;
            clearTimeout(timeoutId);
            try { socket.destroy(); } catch { /* ignore */ }
            resolve(true);
            return;
          }
        }
      });

      socket.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      });
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  });
}

// ── 加载所有启用用户 ─────────────────────────
function getEnabledUsers() {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return (data.users || []).filter(u => u.enabled !== false);
  } catch {
    return [];
  }
}

// ── 加载流量池状态 ────────────────────────────
function getPoolStatus() {
  try {
    return JSON.parse(fs.readFileSync(POOL_STATUS_FILE, 'utf8'));
  } catch {
    return { pool_total_gb: 2000, pool_used_gb: 0, pool_percentage: 0, period: '' };
  }
}

// ── 记录邮件发送日志 ─────────────────────────
function logEmail(type, recipients, success, error) {
  let log;
  try {
    log = JSON.parse(fs.readFileSync(EMAIL_LOG_FILE, 'utf8'));
  } catch {
    log = { entries: [] };
  }

  log.entries.push({
    type,
    recipients: Array.isArray(recipients) ? recipients.length : 1,
    success,
    error: error || null,
    time: new Date().toISOString()
  });

  // 只保留最近100条
  if (log.entries.length > 100) {
    log.entries = log.entries.slice(-100);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(EMAIL_LOG_FILE, JSON.stringify(log, null, 2));
}

// ── 反馈链接 (所有邮件底部附带) ───────────────
function getFeedbackFooter(config) {
  const host = config.server_host || 'guanghulab.com';
  return `
    <hr style="border: none; border-top: 1px solid #e8eaed; margin: 32px 0 24px;">
    <div style="text-align: center; padding: 16px 0;">
      <p style="color: #8c8c8c; font-size: 13px; margin: 0 0 12px; line-height: 1.6;">
        有建议或问题？欢迎反馈 👇
      </p>
      <a href="https://${host}/api/proxy-v3/feedback"
         style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.5px;">
        📝 提交意见反馈
      </a>
      <p style="color: #b0b0b0; font-size: 12px; margin: 14px 0 0; line-height: 1.5;">
        每周五 20:00 铸渊集中处理 · 每周一推送处理结果
      </p>
    </div>`;
}

// ── 通用邮件模板包装 ─────────────────────────
function wrapEmailTemplate(title, content, config) {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const feedbackFooter = getFeedbackFooter(config);

  return `
<!DOCTYPE html>
<html lang="zh-CN" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>光湖语言世界</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Microsoft YaHei, SimSun, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    /* 响应式断点 — 移动端优化 */
    @media only screen and (max-width: 620px) {
      .email-outer { width: 100% !important; padding: 8px !important; }
      .email-container { padding: 20px 16px !important; border-radius: 8px !important; }
      .email-title { font-size: 20px !important; }
      .email-subtitle { font-size: 12px !important; }
      .section-heading { font-size: 15px !important; }
      .alert-box { padding: 12px 14px !important; }
      .data-table td { padding: 10px 8px !important; font-size: 13px !important; }
      .action-btn { padding: 14px 24px !important; font-size: 14px !important; }
      .info-card { padding: 14px !important; }
      .footer-text { font-size: 11px !important; }
    }
    /* 超小屏幕 (< 400px) */
    @media only screen and (max-width: 400px) {
      .email-container { padding: 16px 12px !important; }
      .email-title { font-size: 18px !important; }
      .code-display { font-size: 28px !important; letter-spacing: 5px !important; }
    }
    /* 暗色模式支持 */
    @media (prefers-color-scheme: dark) {
      .email-outer { background: #1a1a2e !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #f0f2f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f0f2f5;">
    <tr>
      <td align="center" class="email-outer" style="padding: 24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">
          <!-- 主卡片 -->
          <tr>
            <td class="email-container" style="background: #ffffff; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

              <!-- 品牌头部 -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <h1 class="email-title" style="color: #1a1a2e; font-size: 22px; font-weight: 700; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif;">🌐 光湖语言世界</h1>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p class="email-subtitle" style="color: #8c8c8c; margin: 0; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif;">${title}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 20px;">
                    <div style="border-top: 2px solid #f0f2f5; width: 100%;"></div>
                  </td>
                </tr>
              </table>

              <!-- 正文内容 -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif; color: #333333;">
                <tr>
                  <td style="padding-top: 24px;">
                    ${content}
                  </td>
                </tr>
              </table>

              ${feedbackFooter}

              <!-- 底部版权 -->
              <hr style="border: none; border-top: 1px solid #e8eaed; margin: 20px 0;">
              <p class="footer-text" style="color: #b0b0b0; font-size: 12px; text-align: center; margin: 0; line-height: 1.8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Roboto, sans-serif;">
                光湖语言世界 · ∞版本 · ${now}<br>
                国作登字-2026-A-00037559
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 1: 月初重置通知
// ═══════════════════════════════════════════════
function generateMonthlyResetEmail(config) {
  const now = new Date();
  const month = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  const content = `
    <div class="alert-box" style="background: #f0faf3; border: 1px solid #c3e6cb; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #155724; font-size: 15px;">✅ ${month} 流量节点已重置</strong>
    </div>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px; font-weight: 600;">📊 本月配额</h3>
    <table class="data-table" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #f0f2f5;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px; width: 40%;">流量池</td>
        <td style="padding: 12px 16px; font-weight: 600; color: #1a1a2e; font-size: 14px;">2000 GB</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f2f5; background: #fafbfc;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">已使用</td>
        <td style="padding: 12px 16px; font-weight: 600; color: #28a745; font-size: 14px;">0 GB (已重置)</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f2f5;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">重置日期</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">每月1日</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">协议</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">VLESS + Reality</td>
      </tr>
    </table>

    <div class="info-card" style="background: #f8f9fa; border-radius: 10px; padding: 16px 20px; margin: 24px 0 0; border-left: 4px solid #667eea;">
      <p style="color: #555; font-size: 14px; margin: 0; line-height: 1.8;">
        💡 您无需任何操作，刷新订阅即可继续使用。<br>
        流量池为所有用户共享，请合理使用。
      </p>
    </div>`;

  return wrapEmailTemplate(`${month} · 流量重置通知`, content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 2: 更新升级通知
// ═══════════════════════════════════════════════
function generateUpdateNotifyEmail(description, config) {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const releaseNotes = loadReleaseNotesObj();
  const vpnIntro = getVpnSystemIntroHtml(releaseNotes);

  // 支持用分号或换行符分隔的多条更新内容，自动渲染为功能清单
  const items = description.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  let detailHtml;
  if (items.length > 1) {
    detailHtml = `
    <ul style="margin: 0; padding-left: 20px; color: #333; line-height: 2.2;">
      ${items.map(item => `<li style="color: #444; font-size: 14px; padding: 2px 0;">${escapeHtml(item)}</li>`).join('\n      ')}
    </ul>`;
  } else {
    detailHtml = `<p style="margin: 0; color: #444; line-height: 1.9; font-size: 14px;">${escapeHtml(description).replace(/\n/g, '<br>')}</p>`;
  }

  const content = `
    <div class="alert-box" style="background: #e8f4fd; border: 1px solid #b8daff; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #004085; font-size: 15px;">🔄 系统已完成升级</strong>
    </div>

    ${vpnIntro}

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px; font-weight: 600;">📋 本次更新内容 · 版本 ${escapeHtml(releaseNotes.version || '∞+1')}</h3>
    <div class="info-card" style="background: #fafbfc; border-radius: 10px; padding: 20px; line-height: 1.8; border: 1px solid #e8eaed;">
      ${detailHtml}
    </div>

    <div class="info-card" style="background: #f8f9fa; border-radius: 10px; padding: 16px 20px; margin: 24px 0 0; border-left: 4px solid #667eea;">
      <p style="color: #555; font-size: 14px; margin: 0; line-height: 1.8;">
        ⏰ 更新时间: ${now}<br>
        💡 大部分更新只需刷新订阅即可生效。如需重新下载订阅链接，会另行通知。
      </p>
    </div>`;

  return wrapEmailTemplate('系统升级通知', content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 3: 流量预警通知
// ═══════════════════════════════════════════════
function generateTrafficWarnEmail(percentage, poolStatus, config) {
  const usedGB = poolStatus.pool_used_gb ? poolStatus.pool_used_gb.toFixed(1) : '?';
  const totalGB = poolStatus.pool_total_gb || 2000;
  const remainGB = (totalGB - parseFloat(usedGB)).toFixed(1);

  let urgencyColor, urgencyBg, urgencyBorder, urgencyText;
  if (percentage >= 100) {
    urgencyColor = '#721c24'; urgencyBg = '#fdf0f1'; urgencyBorder = '#f5c6cb';
    urgencyText = '⛔ 流量池已耗尽！所有连接已暂停。';
  } else if (percentage >= 90) {
    urgencyColor = '#856404'; urgencyBg = '#fffbeb'; urgencyBorder = '#ffeaa7';
    urgencyText = `⚠️ 流量池仅剩 ${remainGB}GB，请节约使用！`;
  } else {
    urgencyColor = '#0c5460'; urgencyBg = '#e8f7fc'; urgencyBorder = '#bee5eb';
    urgencyText = `📊 流量池已使用 ${percentage}%，剩余 ${remainGB}GB`;
  }

  const barColor = percentage >= 90 ? '#dc3545' : percentage >= 70 ? '#ffc107' : '#28a745';

  const content = `
    <div class="alert-box" style="background: ${urgencyBg}; border: 1px solid ${urgencyBorder}; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: ${urgencyColor}; font-size: 15px;">${urgencyText}</strong>
    </div>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px; font-weight: 600;">📊 流量池状态</h3>
    <table class="data-table" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #f0f2f5;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px; width: 40%;">已使用</td>
        <td style="padding: 12px 16px; font-weight: 600; color: #1a1a2e; font-size: 14px;">${usedGB} GB</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f2f5; background: #fafbfc;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">总配额</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">${totalGB} GB</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f2f5;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">使用率</td>
        <td style="padding: 12px 16px; font-weight: 600; color: ${urgencyColor}; font-size: 14px;">${percentage}%</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">剩余</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">${remainGB} GB</td>
      </tr>
    </table>

    <!-- 进度条 -->
    <div style="background: #e9ecef; border-radius: 10px; height: 24px; margin: 20px 0; overflow: hidden;">
      <div style="background: ${barColor}; height: 100%; width: ${Math.min(percentage, 100)}%; border-radius: 10px;"></div>
    </div>

    <p style="color: #8c8c8c; font-size: 13px; margin: 0; line-height: 1.6;">
      流量池每月1日重置。所有用户共享 ${totalGB}GB 月配额。
    </p>`;

  return wrapEmailTemplate('流量预警通知', content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 4: 安全风险提醒 (单用户)
// ═══════════════════════════════════════════════
function generateSecurityWarnEmail(message, config) {
  const content = `
    <div class="alert-box" style="background: #fffbeb; border: 1px solid #ffc107; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #856404; font-size: 15px;">🛡️ 安全提醒</strong>
    </div>

    <div class="info-card" style="background: #fafbfc; border-radius: 10px; padding: 20px; color: #444; line-height: 1.9; font-size: 14px; border: 1px solid #e8eaed; margin: 0 0 24px;">
      ${escapeHtml(message).replace(/\n/g, '<br>')}
    </div>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px; font-weight: 600;">💡 安全建议</h3>
    <ul style="color: #555; line-height: 2.2; padding-left: 20px; margin: 0; font-size: 14px;">
      <li style="padding: 2px 0;">避免同时使用多个VPN客户端</li>
      <li style="padding: 2px 0;">关闭不使用的VPN连接</li>
      <li style="padding: 2px 0;">确保订阅链接仅个人使用</li>
      <li style="padding: 2px 0;">如有异常，请及时反馈</li>
    </ul>`;

  return wrapEmailTemplate('安全使用提醒', content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 5: 反馈确认回复
// ═══════════════════════════════════════════════
function generateFeedbackAckEmail(config) {
  const content = `
    <div class="alert-box" style="background: #f0faf3; border: 1px solid #c3e6cb; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #155724; font-size: 15px;">✅ 您的反馈已收到</strong>
    </div>

    <p style="color: #555; line-height: 1.9; font-size: 14px; margin: 0 0 20px;">
      感谢您的宝贵意见！铸渊将在以下时间处理：
    </p>

    <table class="data-table" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #f0f2f5;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px; width: 40%;">📥 收集截止</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">每周五 20:00</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f2f5; background: #fafbfc;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">🔍 深度分析</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">周五晚间 (AI辅助评估)</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">📤 结果推送</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">每周一 09:00</td>
      </tr>
    </table>

    <div class="info-card" style="background: #f8f9fa; border-radius: 10px; padding: 16px 20px; margin: 24px 0 0; border-left: 4px solid #667eea;">
      <p style="color: #8c8c8c; font-size: 13px; margin: 0; line-height: 1.8;">
        注: 并非所有需求都会被采纳。铸渊会基于系统安全性、架构完整性和整体规划进行评估。
      </p>
    </div>`;

  return wrapEmailTemplate('反馈已收到', content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 6: 带宽共享验证码 (∞+1)
// ═══════════════════════════════════════════════
function generateBandwidthAuthEmail(code, config) {
  const releaseNotes = loadReleaseNotesObj();
  const vpnIntro = getVpnSystemIntroHtml(releaseNotes);

  // 授权页面网址 (纯文本，不插入可点击链接，防止QQ邮箱拦截)
  const authSiteUrl = `https://${BW_AUTH_HOST}/auth`;

  const content = `
    <div class="alert-box" style="background: #e8f4fd; border: 1px solid #b8daff; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #004085; font-size: 15px;">🌊 带宽共享加速 · 授权验证</strong>
    </div>

    ${vpnIntro}

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 12px; font-weight: 600;">🔑 带宽共享加速 · 验证码授权</h3>
    <p style="color: #444; line-height: 1.9; font-size: 14px; margin: 0 0 24px;">
      本邮件为<strong>光湖语言世界</strong>带宽共享加速计划的授权验证通知。<br>
      带宽共享为<strong>自愿参与</strong>机制，参与后将提升全网连接速度与稳定性。<br>
      如您确认授权，请复制以下验证码并按照下方步骤操作：
    </p>

    <!-- 验证码展示区 -->
    <div class="info-card" style="background: #f0f7ff; border: 2px dashed #667eea; border-radius: 14px; padding: 28px 20px; margin: 0 0 24px; text-align: center;">
      <p style="color: #8c8c8c; font-size: 13px; margin: 0 0 12px;">您的验证码 (15分钟内有效)</p>
      <p class="code-display" style="font-size: 40px; font-weight: 700; color: #1a1a2e; letter-spacing: 10px; margin: 0; font-family: Consolas, Monaco, 'Courier New', monospace;">${code}</p>
    </div>

    <!-- 操作步骤 (纯文本，不含可点击链接) -->
    <div class="info-card" style="background: #f0f4ff; border: 1px solid #d0d8ff; border-radius: 10px; padding: 20px; margin: 0 0 24px;">
      <h4 style="color: #004085; margin: 0 0 12px; font-size: 14px; font-weight: 600;">📋 授权操作步骤</h4>
      <ol style="color: #444; line-height: 2.2; font-size: 14px; padding-left: 20px; margin: 0 0 16px;">
        <li>打开<strong>谷歌浏览器</strong>（Chrome）</li>
        <li>在地址栏中<strong>手动输入</strong>以下网址，按回车访问：</li>
      </ol>
      <div style="background: #e8edf6; border-radius: 8px; padding: 14px 16px; text-align: center; margin: 0 0 16px;">
        <p style="font-size: 18px; font-weight: 700; color: #1a1a2e; letter-spacing: 1px; margin: 0; font-family: Consolas, Monaco, 'Courier New', monospace; word-break: break-all;">${escapeHtml(authSiteUrl)}</p>
      </div>
      <ol start="3" style="color: #444; line-height: 2.2; font-size: 14px; padding-left: 20px; margin: 0;">
        <li>在页面中输入您的邮箱地址和上方验证码</li>
        <li>点击「<strong>我同意授权</strong>」按钮完成授权</li>
      </ol>
    </div>

    <!-- 同意说明 -->
    <div class="info-card" style="background: #f0faf3; border-radius: 10px; padding: 18px 20px; margin: 0 0 12px; border-left: 4px solid #28a745;">
      <h4 style="color: #155724; margin: 0 0 8px; font-size: 14px; font-weight: 600;">✅ 授权确认 · 提交验证码</h4>
      <p style="color: #555; font-size: 13px; margin: 0; line-height: 1.9;">
        您的闲置带宽将纳入光湖语言世界加速网络。<br>
        参与带宽共享的用户越多，全网加速效能越高，您的连接速度将同步提升。
      </p>
    </div>

    <!-- 不同意说明 -->
    <div class="info-card" style="background: #f8f9fa; border-radius: 10px; padding: 18px 20px; margin: 0 0 12px; border-left: 4px solid #6c757d;">
      <h4 style="color: #495057; margin: 0 0 8px; font-size: 14px; font-weight: 600;">❌ 暂不参与 · 无需操作</h4>
      <p style="color: #555; font-size: 13px; margin: 0; line-height: 1.9;">
        本功能为自愿参与机制，不影响您的正常服务使用。<br>
        未参与带宽共享的用户将通过系统默认带宽通道连接，服务质量不受影响。<br>
        如后续需要参与，可通过仪表盘页面重新发起授权申请。
      </p>
    </div>

    <!-- 安全说明 -->
    <div class="info-card" style="background: #fffbeb; border: 1px solid #ffc107; border-radius: 10px; padding: 16px 20px; margin: 16px 0 0;">
      <p style="color: #856404; font-size: 13px; margin: 0; line-height: 1.8;">
        🔒 <strong>安全机制说明</strong>：本系统为内部授权用户专用，所有参与者均为受邀成员。
        您的IP地址仅用于带宽加速调度，系统采用 <strong>SHA256 + 盐值</strong> 加密存储，外部无法访问。
        当系统检测到安全风险时，将自动执行以下保护措施：
        即时切断所有共享通道、格式化全部共享记录确保无痕清除。
        风险解除后，系统将自动重新分配订阅链接。您的隐私安全由铸渊守护体系全程保障。
      </p>
    </div>`;

  return wrapEmailTemplate('带宽共享授权验证', content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 7: 风险提示通知 (∞+1 · 全体用户)
// ═══════════════════════════════════════════════
function generateThreatAlertEmail(message, config) {
  const content = `
    <div class="alert-box" style="background: #fdf0f1; border: 1px solid #f5c6cb; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #721c24; font-size: 15px;">⚠️ 安全风险提示</strong>
    </div>

    <div class="info-card" style="background: #fafbfc; border-radius: 10px; padding: 20px; color: #444; line-height: 1.9; font-size: 14px; border: 1px solid #e8eaed; margin: 0 0 24px;">
      ${escapeHtml(message).replace(/\n/g, '<br>')}
    </div>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px; font-weight: 600;">🛡️ 系统已自动执行以下保护措施</h3>
    <ul style="color: #555; line-height: 2.2; padding-left: 20px; margin: 0 0 24px; font-size: 14px;">
      <li style="padding: 2px 0;">所有带宽共享通道已安全切断</li>
      <li style="padding: 2px 0;">用户IP和共享记录已加密隔离</li>
      <li style="padding: 2px 0;">VPN基础服务不受影响，可继续正常使用</li>
      <li style="padding: 2px 0;">系统正在自动处理风险，无需您手动操作</li>
    </ul>

    <div class="info-card" style="background: #f0faf3; border: 1px solid #c3e6cb; border-radius: 10px; padding: 16px 20px; margin: 0;">
      <p style="color: #155724; font-size: 14px; margin: 0; line-height: 1.8;">
        💡 您只需等待系统处理完毕。危机解除后，我们会发送安全恢复通知。<br>
        若需要重新建立连接，只需刷新订阅即可。
      </p>
    </div>`;

  return wrapEmailTemplate('安全风险提示', content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 8: 安全恢复通知 (∞+1 · 全体用户)
// ═══════════════════════════════════════════════
function generateThreatClearedEmail(config) {
  const content = `
    <div class="alert-box" style="background: #f0faf3; border: 1px solid #c3e6cb; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #155724; font-size: 15px;">✅ 安全风险已解除</strong>
    </div>

    <p style="color: #444; line-height: 1.9; font-size: 14px; margin: 0 0 24px;">
      光湖语言世界的安全系统已完成风险处理。<br>
      所有服务已恢复正常运行。
    </p>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px; font-weight: 600;">📋 您需要做的</h3>
    <div class="info-card" style="background: #f0f7ff; border-radius: 10px; padding: 20px; line-height: 1.9; border: 1px solid #d6e4f0; margin: 0 0 20px;">
      <p style="color: #333; margin: 0; font-size: 14px;">
        <strong>只需一步</strong>：打开您的VPN客户端，刷新一下订阅即可。<br>
        您的订阅地址不变，内部节点已自动更新。
      </p>
    </div>

    <div class="info-card" style="background: #f8f9fa; border-radius: 10px; padding: 16px 20px; margin: 0; border-left: 4px solid #667eea;">
      <p style="color: #555; font-size: 13px; margin: 0; line-height: 1.8;">
        💡 如果之前您参与了带宽共享加速计划，共享通道已被安全重置。<br>
        如需重新参与，您可以在仪表盘页面重新授权。感谢您的理解与支持！
      </p>
    </div>`;

  return wrapEmailTemplate('安全恢复通知', content, config);
}

// ═══════════════════════════════════════════════
// 📧 邮件类型 9: V3订阅链接 (含系统介绍 + 带宽共享邀请)
// ═══════════════════════════════════════════════
function generateSubscriptionV3Email(subUrl, dashboardUrl, config) {
  const releaseNotes = loadReleaseNotesObj();
  const vpnIntro = getVpnSystemIntroHtml(releaseNotes);

  const content = `
    <div class="alert-box" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 10px; padding: 16px 20px; margin: 0 0 24px;">
      <strong style="color: #155724; font-size: 15px;">✅ 光湖语言世界 V3 正式版 · 专属订阅</strong>
    </div>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 12px; font-weight: 600;">📱 订阅链接</h3>
    <div class="info-card" style="background: #f0f4ff; border: 1px solid #d0d8ff; border-radius: 10px; padding: 16px 20px; word-break: break-all; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 13px; margin: 0 0 8px; color: #333;">
      ${escapeHtml(subUrl)}
    </div>
    <p style="color: #999; font-size: 12px; margin: 0 0 24px;">
      ⚠️ 此链接为个人专属，请勿对外分享。全部用户共享 2000GB 月流量池。
    </p>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 12px; font-weight: 600;">📊 流量仪表盘</h3>
    <div class="info-card" style="background: #fff8e1; border: 1px solid #ffe082; border-radius: 10px; padding: 16px 20px; word-break: break-all; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 13px; margin: 0 0 8px; color: #333;">
      ${escapeHtml(dashboardUrl)}
    </div>
    <p style="color: #999; font-size: 12px; margin: 0 0 24px;">
      💡 在浏览器中打开，可查看实时流量统计与节点状态。
    </p>

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 16px; font-weight: 600;">📋 客户端配置指引</h3>
    <div class="info-card" style="background: #fafbfc; border-radius: 10px; padding: 20px; border: 1px solid #e8eaed; margin: 0 0 24px;">
      <h4 style="color: #555; margin: 0 0 8px; font-size: 14px; font-weight: 600;">🍎 iOS (Shadowrocket)</h4>
      <ol style="color: #666; line-height: 2; font-size: 13px; padding-left: 20px; margin: 0 0 16px;">
        <li>打开 Shadowrocket → 点击右上角 <strong>+</strong></li>
        <li>选择 <strong>Subscribe</strong> (订阅) → 粘贴订阅链接</li>
        <li>点击完成 → 选择节点 → 开启连接</li>
      </ol>
      <h4 style="color: #555; margin: 0 0 8px; font-size: 14px; font-weight: 600;">💻 Mac / Windows (Clash Verge)</h4>
      <ol style="color: #666; line-height: 2; font-size: 13px; padding-left: 20px; margin: 0 0 16px;">
        <li>打开 Clash Verge → 点击 <strong>Profiles</strong></li>
        <li>粘贴订阅链接到输入框 → 点击 <strong>Import</strong></li>
        <li>选中新配置 → 开启系统代理</li>
      </ol>
      <h4 style="color: #555; margin: 0 0 8px; font-size: 14px; font-weight: 600;">🤖 Android (ClashMi / Clash Meta)</h4>
      <ol style="color: #666; line-height: 2; font-size: 13px; padding-left: 20px; margin: 0;">
        <li>打开 ClashMi → <strong>Profile</strong> → <strong>New Profile</strong></li>
        <li>选择 <strong>URL</strong> → 粘贴订阅链接</li>
        <li>保存 → 选中配置 → 启动</li>
      </ol>
    </div>

    ${vpnIntro}

    <h3 class="section-heading" style="color: #1a1a2e; font-size: 16px; margin: 0 0 12px; font-weight: 600;">📊 服务配额</h3>
    <table class="data-table" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; margin: 0 0 24px;">
      <tr style="border-bottom: 1px solid #f0f2f5;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px; width: 40%;">月流量池</td>
        <td style="padding: 12px 16px; font-weight: 600; color: #1a1a2e; font-size: 14px;">2000 GB (共享配额)</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f2f5; background: #fafbfc;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">重置日期</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">每月1日</td>
      </tr>
      <tr style="border-bottom: 1px solid #f0f2f5;">
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">传输协议</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">VLESS + Reality</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; color: #666; font-size: 14px;">节点位置</td>
        <td style="padding: 12px 16px; color: #1a1a2e; font-size: 14px;">🇸🇬 新加坡 (多节点)</td>
      </tr>
    </table>

    <!-- 带宽共享邀请 (纯文本网址，不含可点击链接，防止QQ邮箱拦截) -->
    <div style="background: linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%); border: 1px solid #b8daff; border-radius: 12px; padding: 20px; margin: 0 0 16px;">
      <h3 style="color: #004085; font-size: 15px; margin: 0 0 12px; font-weight: 700;">🌊 带宽共享加速计划 · 自愿参与</h3>
      <p style="color: #444; font-size: 13px; margin: 0 0 16px; line-height: 1.9;">
        光湖语言世界支持带宽共享加速机制。参与用户的闲置带宽将纳入全网加速池，
        提升所有用户的连接速度与稳定性。此功能为<strong>自愿参与</strong>机制，
        不参与不影响正常服务使用。
      </p>
      <div style="background: #e8edf6; border-radius: 8px; padding: 14px 16px; text-align: center; margin: 0 0 16px;">
        <p style="color: #666; font-size: 12px; margin: 0 0 6px;">请在谷歌浏览器中手动输入以下网址访问授权页面：</p>
        <p style="font-size: 16px; font-weight: 700; color: #1a1a2e; letter-spacing: 1px; margin: 0; font-family: Consolas, Monaco, 'Courier New', monospace;">https://${escapeHtml(BW_AUTH_HOST)}/auth</p>
      </div>
      <p style="color: #888; font-size: 12px; margin: 0; line-height: 1.8;">
        在授权页面中输入您的邮箱和系统发送的验证码，点击「我同意授权」完成操作。<br>
        如暂不参与，无需任何操作。此邮件仅为系统通知，不参与不产生任何影响。
      </p>
    </div>

    <div class="info-card" style="background: #f8f9fa; border-radius: 10px; padding: 16px 20px; margin: 0; border-left: 4px solid #667eea;">
      <p style="color: #555; font-size: 13px; margin: 0; line-height: 1.8;">
        🔒 <strong>安全机制说明</strong>：所有参与带宽共享的用户IP地址均采用 SHA256 + 盐值 加密存储。
        系统检测到风险时将自动切断共享通道并清除所有记录。您的隐私安全由铸渊守护体系全程保障。
      </p>
    </div>`;

  return wrapEmailTemplate('V3 专属订阅 · 光湖语言世界', content, config);
}

// ── HTML转义 ─────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════
// 📧 批量发送函数
// ═══════════════════════════════════════════════

/**
 * 给所有启用用户发送邮件
 * @param {string} subject 邮件主题
 * @param {Function} htmlGenerator 生成HTML的函数(接收config参数)
 * @returns {Promise<{sent: number, failed: number, errors: string[]}>}
 */
async function sendToAllUsers(subject, htmlGenerator) {
  const users = getEnabledUsers();
  const config = loadConfig();

  if (users.length === 0) {
    console.log('[邮件中枢] 无启用用户，跳过发送');
    return { sent: 0, failed: 0, errors: [] };
  }

  const html = htmlGenerator(config);
  let sent = 0;
  let failed = 0;
  const errors = [];

  console.log(`[邮件中枢] 开始批量发送 (${users.length}位用户): ${subject}`);

  for (const user of users) {
    try {
      await sendEmail(user.email, subject, html);
      sent++;
      console.log(`  ✅ ${user.email}`);
      // 间隔500ms避免SMTP限流
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      failed++;
      errors.push(`${user.email}: ${err.message}`);
      console.error(`  ❌ ${user.email}: ${err.message}`);
    }
  }

  console.log(`[邮件中枢] 发送完成: ${sent}成功 / ${failed}失败`);
  return { sent, failed, errors };
}

// ═══════════════════════════════════════════════
// 📧 公开API (供auto-evolution.js调用)
// ═══════════════════════════════════════════════

/**
 * 发送月初重置通知给所有用户
 */
async function sendMonthlyResetEmail() {
  const result = await sendToAllUsers(
    '🌐 光湖语言世界 · 本月流量已重置',
    (config) => generateMonthlyResetEmail(config)
  );
  logEmail('monthly-reset', result.sent + result.failed, result.sent, result.errors.join('; '));
  return result;
}

/**
 * 发送更新通知给所有用户
 * @param {string} description 更新说明
 */
async function sendUpdateNotifyEmail(description) {
  const result = await sendToAllUsers(
    '🌐 光湖语言世界 · 系统已升级',
    (config) => generateUpdateNotifyEmail(description, config)
  );
  logEmail('update-notify', result.sent + result.failed, result.sent, result.errors.join('; '));
  return result;
}

/**
 * 发送流量预警给所有用户
 * @param {number} percentage 流量使用百分比
 */
async function sendTrafficWarnEmail(percentage) {
  const poolStatus = getPoolStatus();
  const result = await sendToAllUsers(
    `🌐 光湖语言世界 · 流量预警 (${percentage}%)`,
    (config) => generateTrafficWarnEmail(percentage, poolStatus, config)
  );
  logEmail('traffic-warn', result.sent + result.failed, result.sent, result.errors.join('; '));
  return result;
}

/**
 * 发送安全提醒给单个用户
 * @param {string} email 目标邮箱
 * @param {string} message 安全提醒内容
 */
async function sendSecurityWarnEmail(email, message) {
  const config = loadConfig();
  const html = generateSecurityWarnEmail(message, config);

  try {
    await sendEmail(email, '🛡️ 光湖语言世界 · 安全提醒', html);
    console.log(`[邮件中枢] ✅ 安全提醒已发送: ${email}`);
    logEmail('security-warn', email, true, null);
    return { sent: 1, failed: 0 };
  } catch (err) {
    console.error(`[邮件中枢] ❌ 安全提醒发送失败: ${err.message}`);
    logEmail('security-warn', email, false, err.message);
    return { sent: 0, failed: 1 };
  }
}

/**
 * 发送反馈确认给单个用户
 * @param {string} email 目标邮箱
 */
async function sendFeedbackAckEmail(email) {
  const config = loadConfig();
  const html = generateFeedbackAckEmail(config);

  try {
    await sendEmail(email, '🌐 光湖语言世界 · 反馈已收到', html);
    console.log(`[邮件中枢] ✅ 反馈确认已发送: ${email}`);
    logEmail('feedback-ack', email, true, null);
    return { sent: 1, failed: 0 };
  } catch (err) {
    console.error(`[邮件中枢] ❌ 反馈确认发送失败: ${err.message}`);
    logEmail('feedback-ack', email, false, err.message);
    return { sent: 0, failed: 1 };
  }
}

/**
 * 发送更新通知给单个用户 (分别发送模式)
 * @param {string} email 目标邮箱
 * @param {string} description 更新说明
 */
async function sendUpdateNotifySingleEmail(email, description) {
  const config = loadConfig();
  const html = generateUpdateNotifyEmail(description, config);

  try {
    await sendEmail(email, '🌐 光湖语言世界 · 系统已升级', html);
    console.log(`[邮件中枢] ✅ 更新通知已发送: ${email}`);
    logEmail('update-notify-single', email, true, null);
    return { sent: 1, failed: 0 };
  } catch (err) {
    console.error(`[邮件中枢] ❌ 更新通知发送失败: ${err.message}`);
    logEmail('update-notify-single', email, false, err.message);
    return { sent: 0, failed: 1 };
  }
}

/**
 * 列出所有启用用户的邮箱 (供下拉选择)
 * @returns {string[]} 邮箱列表
 */
function listUserEmails() {
  const users = getEnabledUsers();
  return users.map(u => u.email);
}

/**
 * 发送带宽共享验证码给单个用户 (∞+1)
 * 邮件仅含验证码 + 纯文本网址引导，不含可点击链接 (QQ邮箱反拦截)
 * @param {string} email 目标邮箱
 * @param {string} code 6位验证码
 */
async function sendBandwidthAuthEmail(email, code) {
  const config = loadConfig();
  const html = generateBandwidthAuthEmail(code, config);

  try {
    await sendEmail(email, '🌊 光湖语言世界 · 带宽共享授权验证码', html);
    console.log(`[邮件中枢] ✅ 带宽验证码已发送: ${email}`);
    logEmail('bandwidth-auth', email, true, null);
    return { sent: 1, failed: 0 };
  } catch (err) {
    console.error(`[邮件中枢] ❌ 带宽验证码发送失败: ${err.message}`);
    logEmail('bandwidth-auth', email, false, err.message);
    return { sent: 0, failed: 1 };
  }
}

/**
 * 发送风险提示给所有用户 (∞+1)
 * @param {string} message 风险描述
 */
async function sendThreatAlertEmail(message) {
  const result = await sendToAllUsers(
    '⚠️ 光湖语言世界 · 安全风险提示',
    (config) => generateThreatAlertEmail(message, config)
  );
  logEmail('threat-alert', result.sent + result.failed, result.sent, result.errors.join('; '));
  return result;
}

/**
 * 发送安全恢复通知给所有用户 (∞+1)
 */
async function sendThreatClearedEmail() {
  const result = await sendToAllUsers(
    '✅ 光湖语言世界 · 安全风险已解除',
    (config) => generateThreatClearedEmail(config)
  );
  logEmail('threat-cleared', result.sent + result.failed, result.sent, result.errors.join('; '));
  return result;
}

/**
 * 发送V3订阅链接给单个用户 (含系统介绍 + 带宽共享邀请)
 * 自动从users.json查找用户token，构建订阅/仪表盘/授权URL
 * @param {string} email 目标邮箱
 */
async function sendSubscriptionV3Email(email) {
  const config = loadConfig();
  const users = getEnabledUsers();
  const user = users.find(u => u.email === email);

  if (!user || !user.token) {
    console.error(`[邮件中枢] ❌ 用户不存在或token无效: ${email}`);
    return { sent: 0, failed: 1 };
  }

  const host = config.server_host || 'guanghulab.com';
  const subUrl = `https://${host}/api/proxy-v3/sub/${user.token}`;
  const dashboardUrl = `https://${host}/api/proxy-v3/dashboard/${user.token}`;

  const html = generateSubscriptionV3Email(subUrl, dashboardUrl, config);

  try {
    await sendEmail(email, '🌐 光湖语言世界 · V3专属订阅链接', html);
    console.log(`[邮件中枢] ✅ V3订阅已发送: ${email}`);
    logEmail('subscription-v3', email, true, null);
    return { sent: 1, failed: 0 };
  } catch (err) {
    console.error(`[邮件中枢] ❌ V3订阅发送失败: ${err.message}`);
    logEmail('subscription-v3', email, false, err.message);
    return { sent: 0, failed: 1 };
  }
}

/**
 * 一键发送带宽共享验证码给所有用户 (∞+1)
 * 自动提取所有启用用户邮箱，为每位用户生成独立验证码并加密发送
 */
async function sendBandwidthAuthAllEmail() {
  const users = getEnabledUsers();
  const config = loadConfig();

  if (users.length === 0) {
    console.log('[邮件中枢] 无启用用户，跳过发送');
    return { sent: 0, failed: 0, errors: [] };
  }

  let bwPool;
  try {
    bwPool = require('./bandwidth-pool-agent');
  } catch (err) {
    console.error('[邮件中枢] ❌ 无法加载带宽池模块:', err.message);
    return { sent: 0, failed: 0, errors: ['无法加载bandwidth-pool-agent模块'] };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];

  console.log(`[邮件中枢] 开始一键批量发送带宽验证码 (${users.length}位用户)`);

  for (const user of users) {
    try {
      // 为每位用户生成独立验证码
      const authCode = bwPool.createAuthCode(user.email);

      // 邮件仅含验证码 + 纯文本网址引导，不含可点击链接 (QQ邮箱反拦截)
      const html = generateBandwidthAuthEmail(authCode, config);
      await sendEmail(user.email, '🌊 光湖语言世界 · 带宽共享授权验证码', html);
      sent++;
      console.log(`  ✅ ${user.email}`);
      // 间隔500ms避免SMTP限流
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      failed++;
      errors.push(`${user.email}: ${err.message}`);
      console.error(`  ❌ ${user.email}: ${err.message}`);
    }
  }

  console.log(`[邮件中枢] 带宽验证码批量发送完成: ${sent}成功 / ${failed}失败`);
  logEmail('bandwidth-auth-all', sent + failed, sent, errors.join('; '));
  return { sent, failed, errors };
}


// ═══════════════════════════════════════════════
// CLI 主入口
// ═══════════════════════════════════════════════
async function main() {
  const [,, action, arg1, arg2] = process.argv;

  if (!action) {
    console.log('📧 光湖语言世界 · 邮件通信中枢');
    console.log('用法:');
    console.log('  node email-hub.js monthly-reset                — 月初重置通知 (全部用户)');
    console.log('  node email-hub.js update-notify [描述]          — 一键发送更新通知 (全部用户)');
    console.log('  node email-hub.js update-notify-single <邮箱> [描述] — 单独发送更新通知');
    console.log('  node email-hub.js traffic-warn <百分比>         — 流量预警通知 (全部用户)');
    console.log('  node email-hub.js security-warn <邮箱> <消息>   — 安全风险提醒 (单用户)');
    console.log('  node email-hub.js feedback-ack <邮箱>           — 反馈确认回复 (单用户)');
    console.log('  node email-hub.js bandwidth-auth <邮箱>         — 发送带宽共享验证码 (单用户·∞+1)');
    console.log('  node email-hub.js bandwidth-auth-all            — 一键发送带宽验证码 (全部用户·∞+1)');
    console.log('  node email-hub.js threat-alert <消息>           — 全体用户风险提示 (∞+1)');
    console.log('  node email-hub.js threat-cleared                — 全体用户安全恢复通知 (∞+1)');
    console.log('  node email-hub.js send-subscription-v3 <邮箱>   — V3订阅链接 (含系统介绍+带宽共享邀请)');
    console.log('  node email-hub.js list-emails                  — 列出所有用户邮箱');
    console.log('');
    console.log('💡 描述支持分号分隔多条内容，自动渲染为功能清单:');
    console.log('   node email-hub.js update-notify "新增智能选路;优化连接速度;修复断连问题"');
    console.log('💡 省略描述时自动读取 config/release-notes.json 中的版本特性');
    console.log('💡 bandwidth-auth-all 会自动提取所有用户邮箱，为每人生成独立验证码加密发送');
    process.exit(0);
  }

  switch (action) {
    case 'monthly-reset': {
      const result = await sendMonthlyResetEmail();
      console.log(`📧 月初重置通知: ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    case 'update-notify': {
      const desc = arg1 || loadReleaseNotes();
      if (!desc) {
        console.error('❌ 请提供更新描述，或在 config/release-notes.json 中配置版本特性');
        process.exit(1);
      }
      const result = await sendUpdateNotifyEmail(desc);
      console.log(`📧 更新通知 (一键发送): ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    case 'update-notify-single': {
      if (!arg1) {
        console.error('❌ 请提供邮箱');
        console.error('用法: node email-hub.js update-notify-single <邮箱> [描述]');
        process.exit(1);
      }
      const singleDesc = arg2 || loadReleaseNotes();
      if (!singleDesc) {
        console.error('❌ 请提供更新描述，或在 config/release-notes.json 中配置版本特性');
        process.exit(1);
      }
      const result = await sendUpdateNotifySingleEmail(arg1, singleDesc);
      console.log(`📧 更新通知 (单独发送): ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    case 'traffic-warn': {
      const pct = parseInt(arg1, 10);
      if (isNaN(pct)) {
        console.error('❌ 请提供流量使用百分比 (数字)');
        process.exit(1);
      }
      const result = await sendTrafficWarnEmail(pct);
      console.log(`📧 流量预警: ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    case 'security-warn': {
      if (!arg1 || !arg2) {
        console.error('❌ 请提供邮箱和消息');
        process.exit(1);
      }
      await sendSecurityWarnEmail(arg1, arg2);
      break;
    }

    case 'feedback-ack': {
      if (!arg1) {
        console.error('❌ 请提供邮箱');
        process.exit(1);
      }
      await sendFeedbackAckEmail(arg1);
      break;
    }

    case 'list-emails': {
      const emails = listUserEmails();
      if (emails.length === 0) {
        console.log('[邮件中枢] 暂无启用用户');
      } else {
        console.log(`📧 当前启用用户邮箱 (${emails.length}位):`);
        emails.forEach((email, i) => {
          console.log(`  ${i + 1}. ${email}`);
        });
      }
      break;
    }

    case 'bandwidth-auth': {
      if (!arg1) {
        console.error('❌ 请提供邮箱');
        console.error('用法: node email-hub.js bandwidth-auth <邮箱>');
        process.exit(1);
      }
      // 生成验证码
      const bwPool = require('./bandwidth-pool-agent');
      const authCode = bwPool.createAuthCode(arg1);

      // 邮件仅含验证码 + 纯文本网址引导，不含可点击链接 (QQ邮箱反拦截)
      const result = await sendBandwidthAuthEmail(arg1, authCode);
      console.log(`📧 带宽验证码: ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    case 'bandwidth-auth-all': {
      const resultAll = await sendBandwidthAuthAllEmail();
      console.log(`📧 带宽验证码 (一键全发): ${resultAll.sent}成功 / ${resultAll.failed}失败`);
      break;
    }

    case 'threat-alert': {
      if (!arg1) {
        console.error('❌ 请提供风险消息');
        console.error('用法: node email-hub.js threat-alert <消息>');
        process.exit(1);
      }
      const result = await sendThreatAlertEmail(arg1);
      console.log(`📧 风险提示: ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    case 'threat-cleared': {
      const result = await sendThreatClearedEmail();
      console.log(`📧 安全恢复通知: ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    case 'send-subscription-v3': {
      if (!arg1) {
        console.error('❌ 请提供邮箱');
        console.error('用法: node email-hub.js send-subscription-v3 <邮箱>');
        process.exit(1);
      }
      const result = await sendSubscriptionV3Email(arg1);
      console.log(`📧 V3订阅链接: ${result.sent}成功 / ${result.failed}失败`);
      break;
    }

    default:
      console.error(`❌ 未知操作: ${action}`);
      process.exit(1);
  }
}

// 导出API (供其他模块调用)
module.exports = {
  sendMonthlyResetEmail,
  sendUpdateNotifyEmail,
  sendUpdateNotifySingleEmail,
  sendTrafficWarnEmail,
  sendSecurityWarnEmail,
  sendFeedbackAckEmail,
  sendBandwidthAuthEmail,
  sendBandwidthAuthAllEmail,
  sendThreatAlertEmail,
  sendThreatClearedEmail,
  sendSubscriptionV3Email,
  getEnabledUsers,
  listUserEmails,
  loadReleaseNotes,
  loadReleaseNotesObj,
  sendEmail
};

// CLI直接运行
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 邮件中枢异常:', err.message);
    process.exit(1);
  });
}
