// scripts/bridge/distribute.js
// 🌉 桥接·广播分发到 IM
//
// 根据分发清单，查询人格体注册表获取通知渠道，
// 将 PDF 下载链接推送到飞书/钉钉/邮箱
//
// 环境变量：
//   NOTION_TOKEN          Notion API token（查询人格体注册表）
//   DIST_MANIFEST         dist-manifest.json 路径
//   FEISHU_APP_ID         飞书 App ID
//   FEISHU_APP_SECRET     飞书 App Secret
//   DINGTALK_TOKEN        钉钉机器人 Token
//   SMTP_USER             邮件发送者
//   SMTP_PASS             邮件授权码

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUTPUT_DIR = path.join('data', 'broadcasts', 'pdf');

// ══════════════════════════════════════════════════════════
// HTTP 请求辅助
// ══════════════════════════════════════════════════════════

function httpsPost(hostname, apiPath, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname,
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: Object.assign({
        'Content-Type':   'application/json',
        'Content-Length':  Buffer.byteLength(payload),
      }, headers || {}),
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// 飞书分发
// ══════════════════════════════════════════════════════════

async function getFeishuToken() {
  const appId     = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) return null;

  const result = await httpsPost(
    'open.feishu.cn',
    '/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: appId, app_secret: appSecret }
  );

  const parsed = JSON.parse(result.body);
  return parsed.tenant_access_token || null;
}

async function sendFeishuMessage(token, chatId, title, downloadUrl) {
  const text = `📡 新广播已生成\n\n📋 ${title}\n\n📎 下载链接: ${downloadUrl}\n\n⏰ ${new Date().toISOString()}`;

  return httpsPost(
    'open.feishu.cn',
    '/open-apis/im/v1/messages?receive_id_type=chat_id',
    {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
    { 'Authorization': 'Bearer ' + token }
  );
}

// ══════════════════════════════════════════════════════════
// 钉钉分发
// ══════════════════════════════════════════════════════════

async function sendDingtalkMessage(webhookToken, title, downloadUrl) {
  const text = `📡 新广播已生成\n\n📋 ${title}\n\n📎 下载链接: ${downloadUrl}`;

  return httpsPost(
    'oapi.dingtalk.com',
    `/robot/send?access_token=${webhookToken}`,
    {
      msgtype: 'text',
      text: { content: text },
    }
  );
}

// ══════════════════════════════════════════════════════════
// 邮件分发
// ══════════════════════════════════════════════════════════

async function sendEmailNotification(to, title, downloadUrl) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.log('  ⚠️  SMTP 未配置，跳过邮件通知');
    return;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from:    `"光湖广播" <${smtpUser}>`,
      to:      to,
      subject: `📡 ${title}`,
      html:    `
        <h2>📡 新广播已生成</h2>
        <p><strong>标题:</strong> ${title}</p>
        <p><strong>下载链接:</strong> <a href="${downloadUrl}">${downloadUrl}</a></p>
        <p><em>— 光湖广播系统 · guanghulab.com</em></p>
      `,
    });
    console.log(`  ✅ 邮件已发送: ${to}`);
  } catch (e) {
    console.error(`  ❌ 邮件发送失败: ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════
// 主逻辑
// ══════════════════════════════════════════════════════════

async function main() {
  const manifestFile = process.env.DIST_MANIFEST ||
                       path.join(OUTPUT_DIR, 'dist-manifest.json');

  if (!fs.existsSync(manifestFile)) {
    console.log('📭 无 dist-manifest.json，跳过分发');
    process.exit(0);
  }

  const items = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (items.length === 0) {
    console.log('📭 分发列表为空，跳过');
    process.exit(0);
  }

  console.log(`📢 开始分发 ${items.length} 条广播…`);

  // 飞书 Token（一次性获取）
  let feishuToken = null;
  if (process.env.FEISHU_APP_ID) {
    try {
      feishuToken = await getFeishuToken();
      if (feishuToken) console.log('  🔑 飞书 Token 获取成功');
    } catch (e) {
      console.error(`  ⚠️  飞书 Token 获取失败: ${e.message}`);
    }
  }

  const dingtalkToken = process.env.DINGTALK_TOKEN;
  let distributed = 0;

  for (const item of items) {
    const title       = item.title || '光湖广播';
    const downloadUrl = item.download_url || '';

    if (!downloadUrl) {
      console.log(`  ⚠️  ${title}: 无下载链接，跳过`);
      continue;
    }

    console.log(`\n📡 分发: ${title}`);

    // 飞书分发（广播到默认群）
    if (feishuToken && process.env.FEISHU_BROADCAST_CHAT_ID) {
      try {
        await sendFeishuMessage(feishuToken, process.env.FEISHU_BROADCAST_CHAT_ID, title, downloadUrl);
        console.log('  ✅ 飞书群已推送');
      } catch (e) {
        console.error(`  ❌ 飞书推送失败: ${e.message}`);
      }
    }

    // 钉钉分发
    if (dingtalkToken) {
      try {
        await sendDingtalkMessage(dingtalkToken, title, downloadUrl);
        console.log('  ✅ 钉钉已推送');
      } catch (e) {
        console.error(`  ❌ 钉钉推送失败: ${e.message}`);
      }
    }

    // 邮件分发（发送给冰朔）
    if (process.env.SMTP_USER && process.env.ALERT_EMAIL) {
      await sendEmailNotification(process.env.ALERT_EMAIL, title, downloadUrl);
    }

    distributed++;
  }

  console.log(`\n✅ 分发完成 · ${distributed}/${items.length} 条广播已推送`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `distributed_count=${distributed}\n`
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });
