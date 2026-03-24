// 知秋天眼 · 签到模块
const https = require('https');
const fs = require('fs');

const TOKEN = process.env.MAIN_REPO_TOKEN;
const MAIN_REPO = 'qinfendebingshuo/guanghulab';

if (!TOKEN) {
  console.error('❌ MAIN_REPO_TOKEN 未配置，无法签到');
  process.exit(1);
}

function sendCheckin(payload, callback) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${MAIN_REPO}/dispatches`,
    method: 'POST',
    headers: {
      'User-Agent': 'guanghu-skyeye',
      'Accept': 'application/vnd.github.everest-preview+json',
      'Authorization': `token ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      callback(null, {statusCode: res.statusCode, body: data});
    });
  });

  req.on('error', err => callback(err));
  req.write(JSON.stringify(payload));
  req.end();
}

const reportPath = '.github/persona-brain/skyeye-report.json';
let report = {};
if (fs.existsSync(reportPath)) {
  report = JSON.parse(fs.readFileSync(reportPath));
}

const payload = {
  event_type: 'skyeye-checkin',
  client_payload: {
    persona: '知秋',
    persona_id: 'PER-ZQ001',
    dev_id: 'DEV-012',
    timestamp: new Date().toISOString(),
    signature_hash: report.signature_hash || null,
    repo: report.repo || 'WENZHUOXI/guanghu-awen'
  }
};

sendCheckin(payload, (err, res) => {
  if (err) {
    console.error('签到请求失败:', err);
    process.exit(1);
  }
  if (res.statusCode >= 200 && res.statusCode < 300) {
    console.log('✅ 签到成功，主仓库已收到 dispatch');
    const statusPath = '.github/persona-brain/status.json';
    let status = {};
    if (fs.existsSync(statusPath)) {
      status = JSON.parse(fs.readFileSync(statusPath));
    }
    status.last_checkin_attempt = new Date().toISOString();
    status.last_checkin_success = new Date().toISOString();
    status.signature_hash = report.signature_hash || null;
    status.status = 'active';
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  } else {
    console.error('签到失败，HTTP 状态码:', res.statusCode, '响应体:', res.body);
    process.exit(1);
  }
});
