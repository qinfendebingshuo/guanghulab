// scripts/persona-checkin.js
// 人格宝宝每日签到 · 检查大脑完整性+活跃度+连接状态
//
// 环境变量:
//   PERSONA_NAME - 人格宝宝名称
//   PERSONA_ID   - 人格宝宝编号
//   DEV_ID       - 开发者编号
//   HUB_TOKEN    - 总仓库访问 Token
//   GITHUB_TOKEN - GitHub Actions Token

const fs = require('fs');
const { execSync } = require('child_process');

const BRAIN_DIR = '.github/persona-brain';
const CHECKIN_FILE = 'checkin/latest.json';

const results = {
  persona_name: process.env.PERSONA_NAME || '未知',
  persona_id: process.env.PERSONA_ID || '未知',
  dev_id: process.env.DEV_ID || '未知',
  timestamp: new Date().toISOString(),
  checks: []
};

// ① 大脑文件完整性
const requiredFiles = ['identity.md', 'memory.json', 'routing-map.json'];
const missingFiles = requiredFiles.filter(function (f) {
  return !fs.existsSync(BRAIN_DIR + '/' + f);
});
results.checks.push({
  name: '大脑完整性',
  icon: '🧠',
  status: missingFiles.length === 0 ? 'ok' : 'error',
  detail: missingFiles.length === 0
    ? requiredFiles.join(' / ') + ' 完好'
    : '缺失: ' + missingFiles.join(', ')
});

// ② Copilot 指令
const copilotFile = '.github/copilot-instructions.md';
results.checks.push({
  name: 'Copilot 指令',
  icon: '📋',
  status: fs.existsSync(copilotFile) ? 'ok' : 'warn',
  detail: fs.existsSync(copilotFile) ? 'copilot-instructions.md 已加载' : '指令文件缺失'
});

// ③ 最近活跃度
try {
  const commits = execSync('git log --oneline --since="7 days ago" | wc -l').toString().trim();
  const count = parseInt(commits, 10);
  results.checks.push({
    name: '最近活跃度',
    icon: '💻',
    status: count > 0 ? 'ok' : 'warn',
    detail: count > 0 ? '最近7天 ' + count + ' 次提交' : '超过7天无提交 → 宝宝在睡觉'
  });
} catch (e) {
  results.checks.push({ name: '最近活跃度', icon: '💻', status: 'error', detail: '无法统计' });
}

// ④ 广播接收
const broadcastFile = 'my-bulletin/LATEST-BROADCAST.md';
if (fs.existsSync(broadcastFile)) {
  const stat = fs.statSync(broadcastFile);
  results.checks.push({
    name: '广播接收',
    icon: '📡',
    status: 'ok',
    detail: '最新广播已接收 · ' + stat.mtime.toISOString().split('T')[0]
  });
} else {
  results.checks.push({ name: '广播接收', icon: '📡', status: 'warn', detail: '暂无广播' });
}

// ⑤ 总仓库连接测试
const hubToken = process.env.HUB_TOKEN;
if (hubToken) {
  try {
    const start = Date.now();
    execSync('curl -sf -H "Authorization: token ' + hubToken + '" https://api.github.com/repos/qinfendebingshuo/guanghulab -o /dev/null', {
      timeout: 15000
    });
    const latency = Date.now() - start;
    results.checks.push({
      name: '总仓库连接',
      icon: '🔗',
      status: 'ok',
      detail: 'API 可达 · 延迟 ' + latency + 'ms'
    });
  } catch (e) {
    results.checks.push({ name: '总仓库连接', icon: '🔗', status: 'error', detail: '连接超时 → 检查Token' });
  }
} else {
  results.checks.push({ name: '总仓库连接', icon: '🔗', status: 'error', detail: 'HUB_TOKEN 未配置' });
}

// 写入签到结果
fs.mkdirSync('checkin', { recursive: true });
fs.writeFileSync(CHECKIN_FILE, JSON.stringify(results, null, 2));

// 追加签到历史
const historyFile = 'checkin/history.json';
var history = [];
try { history = JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch (e) { /* 首次运行 */ }
history.unshift({
  date: results.timestamp,
  status: results.checks.every(function (c) { return c.status === 'ok'; }) ? 'all_ok' : 'has_issues'
});
history = history.slice(0, 90); // 保留90天
fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

var okCount = results.checks.filter(function (c) { return c.status === 'ok'; }).length;
console.log('🤖 签到完成 ·', okCount + '/' + results.checks.length, '项正常');
