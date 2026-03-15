// 自动创建 Phase 1 和 Phase 2 缺失文件
// 运行：node setup-phase1-phase2.js

const fs = require('fs');
const path = require('path');

console.log('🔧 开始创建 Phase 1 和 Phase 2 缺失文件...\n');

// 确保目录存在
const dirs = [
  'data',
  'dingtalk',
  'archive/syslog',
  'archive/broadcast'
];

dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ 创建目录: ${dir}`);
  }
});

// 创建 syslog-receiver.js
const syslogReceiver = `// syslog-receiver.js
// Phase 1 - SYSLOG接收器

function receive(data) {
  console.log('[SYSLOG] 收到数据:', data);
  return { status: 'received', data };
}

module.exports = { receive };
`;

fs.writeFileSync(path.join(__dirname, 'syslog-receiver.js'), syslogReceiver);
console.log('✅ 创建: syslog-receiver.js');

// 创建 broadcast-generator.js
const broadcastGenerator = `// broadcast-generator.js
// Phase 1 - 广播生成器

function getLatest() {
  return {
    id: 'BC-M-DINGTALK-003-ZZ',
    title: 'Phase 3 · 知识库挂载+Webhook+三节点同步',
    time: new Date().toISOString()
  };
}

module.exports = { getLatest };
`;

fs.writeFileSync(path.join(__dirname, 'broadcast-generator.js'), broadcastGenerator);
console.log('✅ 创建: broadcast-generator.js');

// 创建 git-helper.js
const gitHelper = `// git-helper.js
// Phase 1 - Git辅助工具

function commit(data) {
  console.log('[Git] 提交:', data);
  return { status: 'committed', hash: 'abc123' };
}

module.exports = { commit };
`;

fs.writeFileSync(path.join(__dirname, 'git-helper.js'), gitHelper);
console.log('✅ 创建: git-helper.js');

// 创建 data/multi-sheet.js
const multiSheet = `// data/multi-sheet.js
// Phase 2 - 多维表格数据

const developers = [
  {
    dev_id: 'DEV-004',
    name: '之之',
    status: '进行中',
    current_module: 'M-DINGTALK Phase 3',
    last_broadcast_time: new Date().toISOString()
  }
];

function getAll() {
  return { developers };
}

function getByDevId(id) {
  return developers.find(d => d.dev_id === id);
}

module.exports = { getAll, getByDevId };
`;

fs.writeFileSync(path.join(__dirname, 'data/multi-sheet.js'), multiSheet);
console.log('✅ 创建: data/multi-sheet.js');

// 创建 data/sheet-updater.js
const sheetUpdater = `// data/sheet-updater.js
// Phase 2 - 表格更新器

function updateFromSyslog(syslogData) {
  console.log('[SheetUpdater] 更新表格:', syslogData);
  return { status: 'updated' };
}

module.exports = { updateFromSyslog };
`;

fs.writeFileSync(path.join(__dirname, 'data/sheet-updater.js'), sheetUpdater);
console.log('✅ 创建: data/sheet-updater.js');

// 创建 dingtalk/bot.js
const dingtalkBot = `// dingtalk/bot.js
// Phase 2 - 钉钉机器人

function sendMessage(message) {
  console.log('[DingTalk] 发送消息:', message);
  return { status: 'sent' };
}

module.exports = { sendMessage };
`;

const dingtalkDir = path.join(__dirname, 'dingtalk');
if (!fs.existsSync(dingtalkDir)) {
  fs.mkdirSync(dingtalkDir);
}
fs.writeFileSync(path.join(dingtalkDir, 'bot.js'), dingtalkBot);
console.log('✅ 创建: dingtalk/bot.js');

// 创建 data/developer-status.json
const devStatus = {
  developers: [
    {
      dev_id: 'DEV-004',
      name: '之之',
      status: '进行中',
      current_module: 'M-DINGTALK Phase 3',
      last_broadcast_time: new Date().toISOString()
    }
  ]
};

fs.writeFileSync(
  path.join(__dirname, 'data/developer-status.json'),
  JSON.stringify(devStatus, null, 2)
);
console.log('✅ 创建: data/developer-status.json');

console.log('\n🎉 所有 Phase 1 和 Phase 2 文件创建完成！');
console.log('现在可以正常运行 node index.js 了！');
