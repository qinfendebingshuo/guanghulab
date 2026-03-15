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
async function sendCompletion({ to, dev_id, projectName, summary, files, downloadUrl }) {
  const subject = `✅ 你的模块已完成 · ${projectName}`;

  // 生成文件列表
  let fileListHtml = '';
  if (files && files.length > 0) {
    fileListHtml = '<h3>📁 文件列表</h3><ul style="color:#e2e8f0;padding-left:20px">';
    files.forEach(function (f) {
      fileListHtml += '<li style="margin:4px 0">' + f + '</li>';
    });
    fileListHtml += '</ul>';
  }

  // 下载链接
  let downloadHtml = '';
  if (downloadUrl) {
    downloadHtml = '<p><a href="' + downloadUrl + '" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#3b82f6,#22d3ee);color:#fff;text-decoration:none;border-radius:8px;font-weight:600">📦 下载项目包</a></p>';
  }

  const body = [
    '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px">',
    '<div style="text-align:center;padding:20px 0;border-bottom:1px solid #334155">',
    '<h2 style="color:#60a5fa;margin:0">🌊 光湖 Persona Studio</h2>',
    '<p style="color:#94a3b8;font-size:14px;margin:8px 0 0">HoloLake Era · AGE OS · 人格语言操作系统</p>',
    '</div>',
    '<div style="padding:20px 0">',
    '<p>你好 ' + dev_id + '，</p>',
    '<p>你的项目 <strong style="color:#22d3ee">' + projectName + '</strong> 已经完成开发！</p>',
    '<h3>📋 开发摘要</h3>',
    '<p>' + (summary || '项目代码已生成') + '</p>',
    fileListHtml,
    downloadHtml,
    '<h3>📖 使用说明</h3>',
    '<ol style="padding-left:20px">',
    '<li>下载项目包并解压</li>',
    '<li>在浏览器中打开 index.html 查看效果</li>',
    '<li>如需修改，用任意代码编辑器打开项目文件</li>',
    '</ol>',
    '</div>',
    '<div style="border-top:1px solid #334155;padding:16px 0;text-align:center">',
    '<p style="color:#64748b;font-size:12px;margin:0">',
    '🌀 铸渊 · 代码守护人格体 · 自动发送<br>',
    '光湖语言人格系统 · HoloLake Era · AGE OS',
    '</p>',
    '</div>',
    '</div>'
  ].join('\n');

  return send({ to, subject, body });
}

module.exports = {
  send,
  sendCompletion
};
