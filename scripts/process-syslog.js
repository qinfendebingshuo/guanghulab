// scripts/process-syslog.js
// 铸渊 SYSLOG Pipeline
// 读取 syslog-inbox/ 下的日志条目，处理后归档到 syslog-processed/
// 触发：syslog-inbox/ 目录有新文件 push 到 main 分支

'use strict';

const fs   = require('fs');
const path = require('path');

const INBOX_DIR    = 'syslog-inbox';
const ARCHIVE_DIR  = 'syslog-processed';
const BRAIN_DIR    = '.github/brain';
const MEMORY_PATH  = path.join(BRAIN_DIR, 'memory.json');
const DEV_STATUS_PATH = '.github/persona-brain/dev-status.json';

// ─── 加载大脑 ────────────────────────────────────────────
let memory = {};
try {
  memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
} catch (_) {
  memory = { events: [], stats: { broadcasts_processed: 0 } };
}
if (!memory.events)              memory.events = [];
if (!memory.stats)               memory.stats  = {};
if (!memory.stats.broadcasts_processed) memory.stats.broadcasts_processed = 0;
if (!memory.stats.syslog_processed)     memory.stats.syslog_processed = 0;

// ─── 扫描 inbox ──────────────────────────────────────────
if (!fs.existsSync(INBOX_DIR)) {
  console.log('📭 syslog-inbox/ 目录不存在，跳过');
  process.exit(0);
}

const files = fs.readdirSync(INBOX_DIR)
  .filter(f => f.endsWith('.json') && f !== '.gitkeep');

if (files.length === 0) {
  console.log('📭 syslog-inbox/ 无待处理条目');
  process.exit(0);
}

console.log(`📥 发现 ${files.length} 条 syslog 条目，开始处理...\n`);

// ─── 按月归档路径 ─────────────────────────────────────────
function archiveDir(timestamp) {
  const month = (timestamp || new Date().toISOString()).slice(0, 7); // "2026-03"
  const dir   = path.join(ARCHIVE_DIR, month);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── 处理每条 syslog ──────────────────────────────────────
files.forEach(file => {
  const fullPath = path.join(INBOX_DIR, file);
  let entry;

  try {
    entry = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (e) {
    console.error(`❌ [INVALID JSON] ${file}: ${e.message}，跳过`);
    return;
  }

  console.log(`📋 处理: ${file}`);
  console.log(`   类型: ${entry.type || '未知'} · 来自: ${entry.from || '未知'} · 标题: ${entry.title || ''}`);

  const event = {
    timestamp:  entry.timestamp || new Date().toISOString(),
    type:       'syslog_' + (entry.type || 'unknown'),
    syslog_id:  entry.syslog_id || file,
    title:      entry.title     || '(无标题)',
    from:       entry.from      || '未知',
    file,
  };

  // ── 根据类型分发处理 ──
  switch (entry.type) {

    case 'broadcast': {
      // 广播类：追加到 brain/memory.json events，与现有 broadcast pipeline 互补
      memory.stats.broadcasts_processed += 1;
      event.content_preview = (entry.content || '').slice(0, 80);
      console.log('   ✅ 广播已记录到大脑记忆');
      break;
    }

    case 'auth': {
      // 授权类：记录授权事件，写入 memory
      event.target_dev_id    = entry.target_dev_id;
      event.target_name      = entry.target_name;
      event.permission_level = entry.permission_level;
      event.authorized_by    = entry.authorized_by || '冰朔';
      event.valid_until      = entry.valid_until;
      console.log(`   ✅ 授权记录：${entry.target_name}（${entry.target_dev_id}）· 权限：${entry.permission_level}`);
      break;
    }

    case 'inspect': {
      // 巡检类：记录巡检结果
      event.inspect_result = entry.result || 'unknown';
      event.issues_found   = entry.issues_found || 0;
      console.log(`   ✅ 巡检记录：结果 ${event.inspect_result} · 发现问题 ${event.issues_found} 个`);
      break;
    }

    case 'alert': {
      // 告警类
      event.severity = entry.priority || 'normal';
      console.log(`   ⚠️  告警记录：${entry.title} · 优先级 ${event.severity}`);
      break;
    }

    default:
      console.log(`   ℹ️  未知类型 "${entry.type}"，已记录原始内容`);
      event.raw = entry;
  }

  // 写入大脑记忆
  memory.events.push(event);
  memory.stats.syslog_processed = (memory.stats.syslog_processed || 0) + 1;
  memory.last_updated = new Date().toISOString();

  // 归档文件
  const destDir  = archiveDir(entry.timestamp);
  const destPath = path.join(destDir, file);
  fs.renameSync(fullPath, destPath);
  console.log(`   📦 已归档到 ${destPath}\n`);
});

// ─── 保存大脑 ─────────────────────────────────────────────
// 只保留最近 100 条事件，防止 memory.json 无限膨胀
if (memory.events.length > 100) {
  memory.events = memory.events.slice(-100);
}
fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));

console.log(`✅ SYSLOG Pipeline 完成 · 累计处理 ${memory.stats.syslog_processed} 条`);
