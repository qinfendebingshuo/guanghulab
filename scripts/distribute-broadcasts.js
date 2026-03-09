// 铸渊广播分发引擎
// 检测 broadcasts-outbox/DEV-00X/ 新广播 → 复制到各开发者模块目录的 LATEST-BROADCAST.md

const fs = require('fs');
const path = require('path');

const OUTBOX = 'broadcasts-outbox';
const ARCHIVE = '.github/broadcasts/distributed';

// 开发者 → 模块目录映射表
const DEV_ROUTES = {
  'DEV-001': { name: '页页', dirs: ['backend', 'src'] },
  'DEV-002': { name: '肥猫', dirs: ['frontend', 'persona-selector', 'chat-bubble'] },
  'DEV-003': { name: '燕樊', dirs: ['settings', 'cloud-drive', 'frontend/chat', 'help-center'] },
  'DEV-004': { name: '之之', dirs: ['dingtalk-bot'] },
  'DEV-005': { name: '小草莓', dirs: ['status-board', 'cost-control', 'multi-persona'] },
  'DEV-009': { name: '花尔', dirs: ['user-center'] },
  'DEV-010': { name: '桔子', dirs: ['ticket-system', 'dashboard'] },
  'DEV-011': { name: '匆匆那年', dirs: [] }
};

if (!fs.existsSync(OUTBOX)) {
  console.log('📭 无 outbox');
  process.exit(0);
}

const devDirs = fs.readdirSync(OUTBOX).filter(d => 
  d.startsWith('DEV-') && fs.statSync(path.join(OUTBOX, d)).isDirectory()
);

let total = 0;

devDirs.forEach(devId => {
  const files = fs.readdirSync(path.join(OUTBOX, devId)).filter(f => f.endsWith('.md') || f.endsWith('.json'));
  if (files.length === 0) return;
  
  const route = DEV_ROUTES[devId];
  if (!route || route.dirs.length === 0) {
    console.warn('⚠️ ' + devId + ' 无映射');
    return;
  }
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(OUTBOX, devId, file), 'utf8');
    
    route.dirs.forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'LATEST-BROADCAST.md'), content);
      console.log(`📡 ${devId} (${route.name}) → ${dir}/LATEST-BROADCAST.md`);
    });
    
    if (!fs.existsSync(ARCHIVE)) fs.mkdirSync(ARCHIVE, { recursive: true });
    fs.renameSync(
      path.join(OUTBOX, devId, file), 
      path.join(ARCHIVE, new Date().toISOString().split('T')[0] + '-' + devId + '-' + file)
    );
    total++;
  });
});

console.log(`✅ 广播分发完成，共 ${total} 条`);
