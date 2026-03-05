const fs = require('fs');
const path = require('path');

// === 最多保留的最近事件条数 ===
const MAX_RECENT_EVENTS = 50;

const BRAIN_DIR = '.github/persona-brain';

let memory, kb, journal;
try {
  memory = JSON.parse(fs.readFileSync(path.join(BRAIN_DIR, 'memory.json'), 'utf8'));
  kb = JSON.parse(fs.readFileSync(path.join(BRAIN_DIR, 'knowledge-base.json'), 'utf8'));
  journal = fs.readFileSync(path.join(BRAIN_DIR, 'growth-journal.md'), 'utf8');
} catch (err) {
  console.error('❌ 铸渊大脑文件读取失败：', err.message);
  process.exit(1);
}

const today = new Date().toISOString().split('T')[0];
console.log(`🔍 铸渊每日自检开始 · ${today}`);

// === ① 大脑文件完整性检查 ===
const requiredFiles = [
  'identity.md', 'memory.json', 'routing-map.json',
  'responsibility.md', 'decision-log.md', 'growth-journal.md',
  'dev-status.json', 'knowledge-base.json'
];
const missing = requiredFiles.filter(f => !fs.existsSync(path.join(BRAIN_DIR, f)));
if (missing.length > 0) {
  console.error('⚠️ 缺失文件：' + missing.join(', '));
} else {
  console.log('✅ 大脑文件完整性：全部就绪');
}

// === ② 知识库去重与整理 ===
const seen = new Set();
const uniqueFaq = kb.faq.filter(item => {
  const key = item.q.toLowerCase().trim();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
if (uniqueFaq.length < kb.faq.length) {
  console.log(`🧹 知识库去重：${kb.faq.length} → ${uniqueFaq.length}`);
  kb.faq = uniqueFaq;
}
kb.last_updated = today;
fs.writeFileSync(path.join(BRAIN_DIR, 'knowledge-base.json'), JSON.stringify(kb, null, 2));

// === ③ 记忆整理（只保留最近50条事件） ===
if (memory.recent_events && memory.recent_events.length > MAX_RECENT_EVENTS) {
  memory.recent_events = memory.recent_events.slice(0, MAX_RECENT_EVENTS);
  console.log(`🧹 记忆整理：截断到${MAX_RECENT_EVENTS}条最近事件`);
}
memory.last_updated = new Date().toISOString();
memory.total_selfchecks = (memory.total_selfchecks || 0) + 1;

if (!memory.recent_events) memory.recent_events = [];
memory.recent_events.unshift({
  date: today,
  type: 'daily_selfcheck',
  description: `每日自检完成 · 知识库${uniqueFaq.length}条 · 缺失文件${missing.length}个`,
  by: '铸渊自检'
});
fs.writeFileSync(path.join(BRAIN_DIR, 'memory.json'), JSON.stringify(memory, null, 2));

// === ④ 成长日记追加 ===
const newEntry = `\n## ${today} · 每日自检\n`
  + `- 大脑文件完整性：${missing.length === 0 ? '✅' : '⚠️ 缺失 ' + missing.join(', ')}\n`
  + `- 知识库条目：${uniqueFaq.length}条\n`
  + `- 累计自检次数：${memory.total_selfchecks}\n`
  + `- 累计CI运行：${memory.total_ci_runs || 0}次\n`
  + `- HLI覆盖率：${memory.hli_coverage || '未知'}\n`;
fs.writeFileSync(path.join(BRAIN_DIR, 'growth-journal.md'), journal + newEntry);

console.log(`\n🔍 铸渊每日自检完成 · ${today}`);
console.log(`📊 知识库：${uniqueFaq.length}条 · 自检次数：${memory.total_selfchecks}`);
