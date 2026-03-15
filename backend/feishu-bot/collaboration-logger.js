// backend/feishu-bot/collaboration-logger.js
// 铸渊 · 人类×人格体协作数据采集器
//
// 记录每次协作对话的完整记录，存入 collaboration-logs/ 目录
// 数据格式对齐 persona-brain-db 五张核心表 schema
//
// 采集内容：
//   - 人类发言 + 人格体回复
//   - 协作通道 (霜砚/宝宝人格体)
//   - 开发者画像关联
//   - SYSLOG v4.0 persona/collaboration/human_feedback 字段

'use strict';

const fs   = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════════════════

const LOGS_DIR = path.resolve(__dirname, '..', '..', 'collaboration-logs');
const MAX_BUFFER_SIZE = 50; // 缓冲 50 条记录后批量写入

// ══════════════════════════════════════════════════════════
// 内存缓冲
// ══════════════════════════════════════════════════════════

let buffer = [];

// ══════════════════════════════════════════════════════════
// 日志记录
// ══════════════════════════════════════════════════════════

/**
 * 记录一次对话交互
 * @param {object} entry
 * @param {string} entry.userId - 飞书用户 ID
 * @param {string} entry.devId - 开发者编号 (如 DEV-002)
 * @param {string} entry.userMessage - 人类发言
 * @param {string} entry.assistantReply - 人格体回复
 * @param {string} entry.channel - 协作通道 (shuangyan | persona)
 * @param {string} entry.personaId - 人格体 ID
 * @param {object} [entry.metadata] - 额外元数据
 */
function logInteraction(entry) {
  const record = {
    // 对齐 persona_memory 表结构
    interaction_id: generateId(),
    timestamp: new Date().toISOString(),
    persona_id: entry.personaId || 'ICE-GL-SY001', // 默认霜砚
    type: 'collaboration',

    // 对话内容
    user_id: entry.userId,
    dev_id: entry.devId || null,
    user_message: entry.userMessage,
    assistant_reply: entry.assistantReply,
    channel: entry.channel || 'shuangyan',

    // 对齐 dev_profiles 表
    interaction_context: {
      platform: 'feishu',
      message_type: 'text',
      channel: entry.channel || 'shuangyan',
    },

    // 元数据（SYSLOG v4.0 字段对齐）
    metadata: entry.metadata || {},
  };

  buffer.push(record);

  // 达到缓冲上限时自动刷新
  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush();
  }
}

/**
 * 记录 SYSLOG 回传中的协作数据
 * @param {object} syslog - SYSLOG v4.0 完整数据
 */
function logSyslogCollaboration(syslog) {
  if (!syslog) return;

  const devId = syslog.dev_id || syslog.developer_id || 'UNKNOWN';
  const broadcastId = syslog.broadcast_id || syslog.broadcastId || 'UNKNOWN';

  const record = {
    interaction_id: generateId(),
    timestamp: new Date().toISOString(),
    type: 'syslog_collaboration',
    dev_id: devId,
    broadcast_id: broadcastId,
    protocol_version: syslog.protocol_version,

    // SYSLOG v4.0 协作相关字段
    persona: syslog.persona || null,
    collaboration: syslog.collaboration || null,
    human_feedback: syslog.human_feedback || null,
    status: syslog.status || null,
    summary: syslog.summary || null,

    // 对齐 persona_memory 表
    memory_entry: {
      persona_id: syslog.persona?.persona_id || 'ICE-GL-SY001',
      type: 'event',
      title: 'SYSLOG 回传 · ' + broadcastId + ' · ' + devId,
      importance: calculateImportance(syslog),
      related_dev: devId,
      related_broadcast: broadcastId,
      tags: ['syslog', 'collaboration', broadcastId],
    },
  };

  buffer.push(record);

  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush();
  }
}

// ══════════════════════════════════════════════════════════
// 文件写入
// ══════════════════════════════════════════════════════════

/**
 * 将缓冲中的记录写入文件
 */
function flush() {
  if (buffer.length === 0) return;

  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = 'collab-' + dateStr + '.jsonl';
  const filepath = path.join(LOGS_DIR, filename);

  // 使用 JSONL 格式（每行一个 JSON 对象）
  const lines = buffer.map(r => JSON.stringify(r)).join('\n') + '\n';

  try {
    fs.appendFileSync(filepath, lines, 'utf8');
  } catch (e) {
    // 写入失败时不丢失数据，保留在缓冲中
    return;
  }

  buffer = [];
}

/**
 * 生成导出数据（对齐 persona-brain-db 的5张核心表）
 * @returns {object} 结构化数据，可直接导入到 persona-brain-db
 */
function exportForBrainDB() {
  flush(); // 先刷新缓冲

  const files = [];
  try {
    if (fs.existsSync(LOGS_DIR)) {
      files.push(...fs.readdirSync(LOGS_DIR)
        .filter(f => f.startsWith('collab-') && f.endsWith('.jsonl'))
        .sort()
        .reverse()
        .slice(0, 30)); // 最近 30 天
    }
  } catch (e) {
    return { error: e.message, records: [] };
  }

  const records = [];
  for (const file of files) {
    try {
      const lines = fs.readFileSync(path.join(LOGS_DIR, file), 'utf8')
        .split('\n')
        .filter(l => l.trim());
      for (const line of lines) {
        try {
          records.push(JSON.parse(line));
        } catch (e) { /* skip malformed lines */ }
      }
    } catch (e) { /* skip unreadable files */ }
  }

  // 结构化为 persona-brain-db 表格式
  return {
    total_records: records.length,
    persona_memory_entries: records
      .filter(r => r.memory_entry)
      .map(r => r.memory_entry),
    dev_interactions: records
      .filter(r => r.dev_id)
      .reduce((acc, r) => {
        if (!acc[r.dev_id]) acc[r.dev_id] = { dev_id: r.dev_id, interactions: 0, last_active: null };
        acc[r.dev_id].interactions++;
        acc[r.dev_id].last_active = r.timestamp;
        return acc;
      }, {}),
    collaboration_sessions: records
      .filter(r => r.type === 'collaboration'),
    syslog_collaborations: records
      .filter(r => r.type === 'syslog_collaboration'),
  };
}

// ══════════════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════════════

function generateId() {
  return 'CL-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function calculateImportance(syslog) {
  let score = 5; // 基础分
  if (syslog.status === 'completed') score += 2;
  if (syslog.human_feedback) score += 1;
  if (syslog.collaboration) score += 1;
  return Math.min(score, 10);
}

/**
 * 获取采集统计
 * @returns {object}
 */
function getStats() {
  const pending = buffer.length;
  let totalFiles = 0;

  try {
    if (fs.existsSync(LOGS_DIR)) {
      totalFiles = fs.readdirSync(LOGS_DIR)
        .filter(f => f.startsWith('collab-') && f.endsWith('.jsonl'))
        .length;
    }
  } catch (e) { /* ignore */ }

  return {
    pendingInBuffer: pending,
    totalLogFiles: totalFiles,
    logsDirectory: LOGS_DIR,
    maxBufferSize: MAX_BUFFER_SIZE,
  };
}

module.exports = {
  logInteraction,
  logSyslogCollaboration,
  flush,
  exportForBrainDB,
  getStats,
};
