// scripts/save-collaboration-log.js
// 铸渊 · 协作数据归档脚本
//
// 将 collaboration-logs/ 目录中的 JSONL 数据
// 结构化对齐 persona-brain-db 五张核心表 schema
// 生成可直接导入的 JSON 文件
//
// 用法: node scripts/save-collaboration-log.js
//
// 输出:
//   collaboration-logs/exports/persona-memory-import.json
//   collaboration-logs/exports/dev-interactions-import.json

'use strict';

const fs   = require('fs');
const path = require('path');

const LOGS_DIR    = path.resolve(__dirname, '..', 'collaboration-logs');
const EXPORT_DIR  = path.join(LOGS_DIR, 'exports');

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

function main() {
  console.log('📊 协作数据归档开始...');

  // 1. 扫描 JSONL 文件
  if (!fs.existsSync(LOGS_DIR)) {
    console.log('📭 无协作日志目录');
    process.exit(0);
  }

  const files = fs.readdirSync(LOGS_DIR)
    .filter(f => f.startsWith('collab-') && f.endsWith('.jsonl'))
    .sort();

  if (files.length === 0) {
    console.log('📭 无协作日志文件');
    process.exit(0);
  }

  console.log('  → 发现 ' + files.length + ' 个日志文件');

  // 2. 读取所有记录
  const records = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(LOGS_DIR, file), 'utf8')
      .split('\n')
      .filter(l => l.trim());
    for (const line of lines) {
      try {
        records.push(JSON.parse(line));
      } catch (e) { /* skip malformed */ }
    }
  }

  console.log('  → 共 ' + records.length + ' 条记录');

  // 3. 结构化导出

  // 3a. persona_memory 表导入数据
  const memoryEntries = records
    .filter(r => r.memory_entry || r.type === 'collaboration')
    .map(r => {
      if (r.memory_entry) {
        return {
          memory_id: r.interaction_id,
          ...r.memory_entry,
          content: r.type === 'collaboration'
            ? 'User: ' + (r.user_message || '').slice(0, 500) + '\nAssistant: ' + (r.assistant_reply || '').slice(0, 500)
            : r.summary || r.memory_entry.title,
          timestamp: r.timestamp,
        };
      }
      return {
        memory_id: r.interaction_id,
        persona_id: r.persona_id || r.personaId || 'ICE-GL-SY001',
        type: 'learning',
        title: '飞书对话 · ' + (r.channel || 'shuangyan'),
        content: 'User: ' + (r.user_message || '').slice(0, 500) + '\nAssistant: ' + (r.assistant_reply || '').slice(0, 500),
        importance: 3,
        related_dev: r.dev_id || null,
        tags: ['feishu', 'collaboration', r.channel || 'shuangyan'],
        timestamp: r.timestamp,
      };
    });

  // 3b. dev_profiles 交互统计
  const devInteractions = {};
  for (const r of records) {
    const devId = r.dev_id;
    if (!devId) continue;
    if (!devInteractions[devId]) {
      devInteractions[devId] = {
        dev_id: devId,
        total_interactions: 0,
        syslog_count: 0,
        chat_count: 0,
        last_active_at: null,
        channels_used: new Set(),
        broadcasts_referenced: new Set(),
      };
    }
    const d = devInteractions[devId];
    d.total_interactions++;
    if (r.type === 'syslog_collaboration') d.syslog_count++;
    if (r.type === 'collaboration') d.chat_count++;
    if (!d.last_active_at || r.timestamp > d.last_active_at) {
      d.last_active_at = r.timestamp;
    }
    if (r.channel) d.channels_used.add(r.channel);
    if (r.broadcast_id && r.broadcast_id !== 'UNKNOWN') d.broadcasts_referenced.add(r.broadcast_id);
  }

  // Set 转 Array 用于 JSON 序列化
  for (const key of Object.keys(devInteractions)) {
    devInteractions[key].channels_used = Array.from(devInteractions[key].channels_used);
    devInteractions[key].broadcasts_referenced = Array.from(devInteractions[key].broadcasts_referenced);
  }

  // 4. 写入导出文件
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const memoryFile = path.join(EXPORT_DIR, 'persona-memory-import.json');
  fs.writeFileSync(memoryFile, JSON.stringify({
    table: 'persona_memory',
    exported_at: new Date().toISOString(),
    total: memoryEntries.length,
    entries: memoryEntries,
  }, null, 2));
  console.log('  → 导出 persona_memory: ' + memoryEntries.length + ' 条');

  const devFile = path.join(EXPORT_DIR, 'dev-interactions-import.json');
  fs.writeFileSync(devFile, JSON.stringify({
    table: 'dev_profiles',
    exported_at: new Date().toISOString(),
    total: Object.keys(devInteractions).length,
    profiles: devInteractions,
  }, null, 2));
  console.log('  → 导出 dev_profiles: ' + Object.keys(devInteractions).length + ' 个开发者');

  console.log('✅ 协作数据归档完成');
  console.log('  导出目录: ' + EXPORT_DIR);
}

main();
