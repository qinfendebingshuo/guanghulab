// scripts/gate-guard-log.js
// 铸渊·智能门禁·日志引擎
//
// 将门禁事件写入 memory.json
//
// 环境变量：
//   PUSH_ACTOR       — 推送者 GitHub username
//   GATE_ACTION      — 门禁判定（pass/fix/revert）
//   GATE_VIOLATION    — 违规类型（可选）
//   GATE_FILES       — 违规文件列表（可选）

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, '../.github/persona-brain/memory.json');

function main() {
  const actor = process.env.PUSH_ACTOR || 'unknown';
  const action = process.env.GATE_ACTION || 'unknown';
  const violationType = process.env.GATE_VIOLATION || '';
  const violationFiles = process.env.GATE_FILES || '';

  console.log(`📝 门禁日志记录 · ${actor} · ${action}`);

  // 读取 memory.json
  let memory;
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  } catch (e) {
    console.error('⚠️ 无法读取 memory.json:', e.message);
    return;
  }

  // 构建门禁事件
  const event = {
    date: new Date().toISOString().split('T')[0],
    type: 'gate_guard',
    description: buildDescription(actor, action, violationType, violationFiles),
    by: '铸渊·智能门禁'
  };

  // 检查是否有相同日期+类型+描述的事件（避免重复）
  const isDuplicate = memory.recent_events && memory.recent_events.some(e =>
    e.date === event.date &&
    e.type === event.type &&
    e.description === event.description
  );

  if (isDuplicate) {
    console.log('ℹ️ 相同事件已存在，跳过写入');
    return;
  }

  // 添加事件
  if (!memory.recent_events) {
    memory.recent_events = [];
  }
  memory.recent_events.unshift(event);

  // 保留最近 20 条事件
  if (memory.recent_events.length > 20) {
    memory.recent_events = memory.recent_events.slice(0, 20);
  }

  // 更新时间戳
  memory.last_updated = new Date().toISOString();

  // 写入
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2) + '\n', 'utf8');
  console.log('✅ 门禁事件已写入 memory.json');
}

function buildDescription(actor, action, violationType, violationFiles) {
  switch (action) {
    case 'pass':
      return `门禁放行 · ${actor} 的 push 通过检查`;
    case 'revert':
      return `门禁回退 · ${actor} 的 push 被回退 · 原因: ${violationType || '路径越权'} · 文件: ${violationFiles || '无'}`;
    case 'fix':
      return `门禁修复 · ${actor} 的 push 路径已自动修复 · 文件: ${violationFiles || '无'}`;
    default:
      return `门禁事件 · ${actor} · ${action}`;
  }
}

main();
