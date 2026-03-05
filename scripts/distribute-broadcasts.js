// scripts/distribute-broadcasts.js
// 铸渊广播分发引擎
// 检测 broadcasts-outbox/DEV-00X/ 中的新广播 → 复制到各开发者模块目录的 LATEST-BROADCAST.md

const fs = require('fs');
const path = require('path');

const OUTBOX = 'broadcasts-outbox';
const ARCHIVE = '.github/broadcasts/distributed';

// ========== 开发者 → 模块目录 路由映射表 ==========
// 新增开发者时，在此表新增一行即可
const DEV_ROUTES = {
  'DEV-001': { name: '页页',     dirs: ['backend', 'src'] },
  'DEV-002': { name: '肥猫',     dirs: ['frontend', 'persona-selector', 'chat-bubble'] },
  'DEV-003': { name: '燕樊',     dirs: ['settings', 'cloud-drive'] },
  'DEV-004': { name: '之之',     dirs: ['dingtalk-bot'] },
  'DEV-005': { name: '小草莓',   dirs: ['status-board'] },
  'DEV-009': { name: '花尔',     dirs: ['user-center'] },
  'DEV-010': { name: '桔子',     dirs: ['ticket-system'] },
  'DEV-011': { name: '匆匆那年', dirs: [] }, // 待分配模块后补充
};

if (!fs.existsSync(OUTBOX)) {
  console.log('📭 无 broadcasts-outbox 目录');
  process.exit(0);
}

// 扫描 outbox 下每个 DEV-00X 子目录
const devDirs = fs.readdirSync(OUTBOX, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name.startsWith('DEV-'))
  .map(entry => entry.name);

if (devDirs.length === 0) {
  console.log('📭 无新广播待分发');
  process.exit(0);
}

let totalDistributed = 0;

devDirs.forEach(devId => {
  const outboxDir = path.join(OUTBOX, devId);
  const files = fs.readdirSync(outboxDir).filter(f =>
    f.endsWith('.md') || f.endsWith('.json')
  );

  if (files.length === 0) return;

  const route = DEV_ROUTES[devId];
  if (!route || route.dirs.length === 0) {
    console.warn('⚠️ ' + devId + ' 无模块目录映射，广播保留在 outbox');
    return;
  }

  files.forEach(file => {
    const rawContent = fs.readFileSync(path.join(outboxDir, file), 'utf8');

    // 对 JSON 格式广播做基础校验
    if (file.endsWith('.json')) {
      try {
        JSON.parse(rawContent);
      } catch (e) {
        console.error('❌ [INVALID JSON] ' + path.join(outboxDir, file) + ' → ' + e.message + '，跳过分发');
        return;
      }
    }

    // 写入该开发者的每个模块目录
    route.dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const targetFile = path.join(dir, 'LATEST-BROADCAST.md');
      fs.writeFileSync(targetFile, rawContent);
      console.log('📡 ' + devId + '(' + route.name + ') → ' + targetFile);
    });

    // 归档已分发广播（使用 UTC 时间戳确保跨时区一致性）
    if (!fs.existsSync(ARCHIVE)) fs.mkdirSync(ARCHIVE, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archivePath = path.join(ARCHIVE, timestamp + '-' + devId + '-' + file);
    fs.renameSync(path.join(outboxDir, file), archivePath);

    totalDistributed++;
  });
});

console.log('\n✅ 广播分发完成，共 ' + totalDistributed + ' 条');
