const fs = require('fs');
const path = require('path');

const BRAIN = '.github/persona-brain';
const requiredFiles = [
  'identity.md', 
  'memory.json', 
  'routing-map.json', 
  'responsibility.md', 
  'decision-log.md', 
  'growth-journal.md'
];

console.log('🔍 铸渊每日自检开始\n');

// 1. 大脑完整性检查
let brainOK = true;
requiredFiles.forEach(f => {
  const exists = fs.existsSync(path.join(BRAIN, f));
  console.log((exists ? '✅' : '❌') + ' ' + f);
  if (!exists) brainOK = false;
});

// 2. Schema 覆盖率
let schemaCount = 0;
const SCHEMA_DIR = 'src/schemas/hli';
const domains = ['auth', 'persona', 'user', 'ticket', 'dialogue', 'storage', 'dashboard'];

domains.forEach(d => {
  const sp = path.join(SCHEMA_DIR, d);
  if (fs.existsSync(sp)) {
    schemaCount += fs.readdirSync(sp).filter(f => f.endsWith('.schema.json')).length;
  }
});
console.log(`\n📊 HLI 覆盖率: ${schemaCount}/17`);

// 3. 未处理广播检查
const broadcastDir = '.github/broadcasts';
let pendingBroadcasts = 0;
if (fs.existsSync(broadcastDir)) {
  pendingBroadcasts = fs.readdirSync(broadcastDir).filter(f => 
    !fs.statSync(path.join(broadcastDir, f)).isDirectory()
  ).length;
}
console.log(`📬 待处理广播: ${pendingBroadcasts}`);

// 4. 更新 memory.json
let memory = JSON.parse(fs.readFileSync(path.join(BRAIN, 'memory.json'), 'utf8'));
memory.daily_selfcheck = {
  last_run: new Date().toISOString(),
  brain_integrity: brainOK ? 'ok' : 'missing_files',
  schema_coverage: schemaCount + '/17',
  pending_broadcasts: pendingBroadcasts
};
fs.writeFileSync(path.join(BRAIN, 'memory.json'), JSON.stringify(memory, null, 2));

console.log('\n' + (brainOK ? '✅' : '⚠️') + ' 铸渊自检完成');
