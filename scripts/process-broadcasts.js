const fs = require('fs');
const path = require('path');

const BROADCAST_DIR = '.github/broadcasts';
const BRAIN = '.github/persona-brain';
const MEMORY = path.join(BRAIN, 'memory.json');
const GROWTH = path.join(BRAIN, 'growth-journal.md');

if (!fs.existsSync(BROADCAST_DIR)) {
  console.log('📭 无广播目录');
  process.exit(0);
}

const files = fs.readdirSync(BROADCAST_DIR).filter(f => f.endsWith('.json') || f.endsWith('.md'));
if (files.length === 0) {
  console.log('📭 无新广播');
  process.exit(0);
}

let memory = JSON.parse(fs.readFileSync(MEMORY, 'utf8'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(BROADCAST_DIR, file), 'utf8');
  console.log('📡 接收广播: ' + file);

  // 如果是 JSON 广播（规则变动）
  if (file.endsWith('.json')) {
    try {
      const broadcast = JSON.parse(content);
      
      if (broadcast.update_target === 'routing-map') {
        fs.writeFileSync(path.join(BRAIN, 'routing-map.json'), JSON.stringify(broadcast.data, null, 2));
        console.log('  ✅ routing-map.json 已按广播更新');
      }
      
      if (broadcast.update_target === 'copilot-instructions') {
        fs.writeFileSync('.github/copilot-instructions.md', broadcast.data);
        console.log('  ✅ copilot-instructions.md 已按广播更新');
      }
      
      memory.recent_events.unshift({
        date: new Date().toISOString().split('T')[0],
        type: 'broadcast_received',
        description: '接收广播: ' + (broadcast.title || file),
        by: broadcast.from || '妈妈'
      });
      memory.last_broadcast_received = new Date().toISOString();
      if (broadcast.rules_version) memory.active_rules_version = broadcast.rules_version;
    } catch (e) {
      console.error('❌ 广播解析失败: ' + file + ' -> ' + e.message);
    }
  }

  // 如果是 MD 广播（认知/成长更新）
  if (file.endsWith('.md')) {
    const growth = fs.readFileSync(GROWTH, 'utf8');
    fs.writeFileSync(GROWTH, growth + '\n\n## 广播接收 · ' + new Date().toISOString().split('T')[0] + '\n' + content);
    console.log('  ✅ 广播内容已追加到成长日记');
  }

  // 处理完移到 archive
  const archiveDir = path.join(BROADCAST_DIR, 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
  fs.renameSync(path.join(BROADCAST_DIR, file), path.join(archiveDir, file));
});

fs.writeFileSync(MEMORY, JSON.stringify(memory, null, 2));
console.log('✅ 广播处理完成，共 ' + files.length + ' 条');
