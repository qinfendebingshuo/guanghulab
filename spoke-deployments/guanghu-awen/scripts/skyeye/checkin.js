// 知秋天眼 · 签到模块
// 向主仓库铸渊发送心跳签到

const https = require('https');
const fs = require('fs');

const TOKEN = process.env.MAIN_REPO_TOKEN;
if (!TOKEN) {
  console.error('❌ MAIN_REPO_TOKEN 未配置');
  process.exit(1);
}
const MAIN_REPO = 'qinfendebingshuo/guanghulab';

// 读取扫描报告
const report = JSON.parse(
  fs.readFileSync('.github/persona-brain/skyeye-report.json', 'utf8')
);

const payload = {
  event_type: 'skyeye-checkin',
  client_payload: {
    dev_id: 'DEV-012',
    persona: '知秋',
    persona_id: 'PER-ZQ001',
    signature_hash: report.signature_hash,
    timestamp: new Date().toISOString(),
    repo: 'WENZHUOXI/guanghu-awen',
    status_summary: {
      brain_intact: report.brain_intact,
      skyeye_intact: report.skyeye_intact,
      last_scan_result: (report.brain_intact && report.skyeye_intact) ? 'healthy' : 'degraded',
      sovereign_files_ok: Object.values(report.sovereign_files).every(f => f.exists)
    }
  }
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'api.github.com',
  path: `/repos/${MAIN_REPO}/dispatches`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'ZhiQiu-SkyEye',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  if (res.statusCode === 204) {
    console.log('✅ 签到成功 · 铸渊已收到心跳');
  } else {
    console.error(`❌ 签到失败 · HTTP ${res.statusCode}`);
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.error(body));
  }
});

req.on('error', (e) => {
  console.error(`❌ 签到网络错误: ${e.message}`);
});

req.write(data);
req.end();
