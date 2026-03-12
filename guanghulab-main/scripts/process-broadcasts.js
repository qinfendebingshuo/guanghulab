// scripts/process-broadcasts.js
// 铸渊大脑同步脚本
// 用途：读取 .github/broadcasts/ 下的广播 JSON，更新 routing-map.json 和 memory.json

const fs = require('fs');
const path = require('path');

const BROADCASTS_DIR = path.join(__dirname, '../.github/broadcasts');
const ROUTING_MAP_PATH = path.join(__dirname, '../.github/brain/routing-map.json');
const MEMORY_PATH = path.join(__dirname, '../.github/brain/memory.json');
const COPILOT_INSTRUCTIONS_PATH = path.join(__dirname, '../.github/copilot-instructions.md');

// 加载当前大脑状态
const routingMap = JSON.parse(fs.readFileSync(ROUTING_MAP_PATH, 'utf8'));
const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));

const processedDir = path.join(BROADCASTS_DIR, 'processed');
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// 读取所有待处理广播（排除 processed 子目录和示例文件）
const broadcasts = fs.readdirSync(BROADCASTS_DIR)
  .filter(f => f.endsWith('.json') && f !== 'example-broadcast.json')
  .map(f => ({ file: f, fullPath: path.join(BROADCASTS_DIR, f) }));

if (broadcasts.length === 0) {
  console.log('📭 没有待处理的广播。');
  process.exit(0);
}

console.log(`📡 发现 ${broadcasts.length} 个待处理广播...\n`);

const failedDir = path.join(BROADCASTS_DIR, 'failed');

broadcasts.forEach(({ file, fullPath }) => {
  let broadcast;
  try {
    broadcast = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    console.error(`❌ [PARSE ERROR] ${file}: ${e.message}`);
    // 归档失败广播并记录到 memory
    if (!fs.existsSync(failedDir)) fs.mkdirSync(failedDir, { recursive: true });
    fs.renameSync(fullPath, path.join(failedDir, file));
    memory.events.push({
      timestamp: new Date().toISOString(),
      broadcast_file: file,
      type: 'broadcast_parse_error',
      error: e.message,
    });
    return;
  }

  console.log(`📬 处理广播: ${broadcast.title || file}`);
  console.log(`   来源: ${broadcast.from || '未知'} · 日期: ${broadcast.date || '未知'}`);

  const event = {
    timestamp: new Date().toISOString(),
    broadcast_file: file,
    title: broadcast.title || file,
    from: broadcast.from || '未知',
    update_target: broadcast.update_target,
  };

  // 根据 update_target 分发处理
  if (broadcast.update_target === 'routing-map' && broadcast.data) {
    Object.entries(broadcast.data).forEach(([domain, domainData]) => {
      routingMap.domains[domain] = domainData;
      console.log(`   ✅ 已更新域: ${domain}`);
      event.added_domain = domain;
    });
    routingMap.version = broadcast.rules_version || routingMap.version;
    routingMap.last_updated = broadcast.date || new Date().toISOString().split('T')[0];
    routingMap.updated_by = broadcast.from || 'broadcast';

  } else if (broadcast.update_target === 'copilot-instructions' && broadcast.content) {
    // 追加到 copilot-instructions.md（防止重复写入）
    const existing = fs.readFileSync(COPILOT_INSTRUCTIONS_PATH, 'utf8');
    const marker = `<!-- 广播更新 ${broadcast.date}: ${broadcast.title} -->`;
    if (existing.includes(marker)) {
      console.log('   ⏭️  copilot-instructions.md 已包含此广播，跳过');
    } else {
      fs.writeFileSync(COPILOT_INSTRUCTIONS_PATH, existing + `\n\n${marker}\n${broadcast.content}`, 'utf8');
      console.log('   ✅ 已更新 copilot-instructions.md');
    }

  } else if (broadcast.update_target === 'growth-log' && broadcast.content) {
    // 追加到成长日记
    const growthLogPath = path.join(__dirname, '../.github/brain/growth-log.md');
    const entry = `\n\n## ${broadcast.date} · ${broadcast.title}\n\n${broadcast.content}\n`;
    fs.appendFileSync(growthLogPath, entry, 'utf8');
    console.log('   ✅ 已追加成长日记');

  } else {
    console.log(`   ⚠️  未知的 update_target: ${broadcast.update_target}，已跳过`);
    event.skipped = true;
  }

  memory.events.push(event);
  memory.stats.broadcasts_processed += 1;

  // 归档广播文件
  fs.renameSync(fullPath, path.join(processedDir, file));
  console.log(`   📦 广播已归档到 broadcasts/processed/${file}\n`);
});

// 重新计算覆盖率
let implemented = 0;
let total = 0;
Object.values(routingMap.domains).forEach(domain => {
  domain.interfaces.forEach(iface => {
    total++;
    if (iface.status === 'implemented') implemented++;
  });
});
memory.stats.coverage = {
  implemented,
  total,
  percent: total > 0 ? `${((implemented / total) * 100).toFixed(1)}%` : '0%',
};

memory.last_updated = new Date().toISOString();

// 写回文件
fs.writeFileSync(ROUTING_MAP_PATH, JSON.stringify(routingMap, null, 2) + '\n', 'utf8');
fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2) + '\n', 'utf8');

console.log(`✅ 铸渊大脑同步完成。覆盖率: ${implemented}/${total} (${memory.stats.coverage.percent})`);
