/**
 * persona-studio · 邮件发送工具
 * 使用 nodemailer 发送开发完成通知
 */
const nodemailer = require('nodemailer');

/**
 * 创建邮件传输器
 * 支持通过环境变量配置 SMTP
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.qq.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

/**
 * 发送邮件
 */
async function send({ to, subject, body }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[Email] SMTP not configured, skipping send to:', to);
    return { skipped: true, reason: 'SMTP not configured' };
  }

  const info = await transporter.sendMail({
    from: `"光湖 Persona Studio" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: body
  });

  console.log('[Email] Sent:', info.messageId);
  return { sent: true, messageId: info.messageId };
}

/**
 * 发送开发完成通知
 */
async function sendCompletion({ to, dev_id, projectName, summary }) {
  const subject = `✅ 你的模块已完成 · ${projectName}`;
  const body = [
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">',
    '<h2 style="color:#0969da">🌊 光湖 Persona Studio</h2>',
    '<hr>',
    `<p>你好 ${dev_id}，</p>`,
    `<p>你的项目 <strong>${projectName}</strong> 已经完成开发！</p>`,
    '<h3>📋 开发摘要</h3>',
    `<p>${summary || '项目代码已生成'}</p>`,
    '<hr>',
    '<p style="color:#656d76;font-size:12px">',
    '光湖语言人格系统 · HoloLake Era · AGE OS<br>',
    '此邮件由知秋自动发送',
    '</p>',
    '</div>'
  ].join('\n');

  return send({ to, subject, body });
}

module.exports = {
  send,
  sendCompletion
};
