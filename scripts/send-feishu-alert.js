// scripts/send-feishu-alert.js
// 铸渊 · 飞书告警通知脚本（供 GitHub Actions 工作流调用）
//
// 用法: node scripts/send-feishu-alert.js "工作流名称" "告警内容"
//
// 环境变量：
//   FEISHU_APP_ID      飞书应用 App ID
//   FEISHU_APP_SECRET  飞书应用 App Secret
//   ALERT_CHAT_ID      飞书群 chat_id

'use strict';

const https = require('https');

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const appId     = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const chatId    = process.env.ALERT_CHAT_ID;
  const workflow  = process.argv[2] || 'unknown';
  const detail    = process.argv[3] || '';

  if (!chatId) {
    console.log('⚠️ 未配置 ALERT_CHAT_ID，跳过告警');
    process.exit(0);
  }
  if (!appId || !appSecret) {
    console.log('⚠️ 未配置飞书 App 凭据，跳过告警');
    process.exit(0);
  }

  // 获取飞书 token
  const tokenRes = JSON.parse(await httpsPost(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: appId, app_secret: appSecret }
  ));
  const token = tokenRes.tenant_access_token;
  if (!token) {
    console.error('❌ 获取飞书 token 失败');
    process.exit(1);
  }

  // 发送消息
  const text = '🔴 GitHub Action 失败告警\n\n' +
    '工作流: ' + workflow + '\n' +
    '时间: ' + new Date().toISOString() + '\n' +
    (detail ? '详情: ' + detail + '\n' : '') +
    '请检查 GitHub Actions 日志。';

  await httpsPost(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
    {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }
  );

  console.log('✅ 告警已发送到飞书群');
}

main().catch(e => {
  console.error('❌ 告警发送失败:', e.message);
  process.exit(1);
});
