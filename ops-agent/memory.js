/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 铸渊运维守卫 · 永久记忆系统
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-MEM-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 存储层级:
 *   1. 文件存储（始终可用，JSON文件）
 *   2. PostgreSQL（可选，连接到 age_os 数据库时启用）
 *
 * 记忆类型:
 *   - event: 巡检事件（健康检查、修复、告警）
 *   - repair: 修复记录
 *   - ticket: 工单记录
 *   - chat: 对话历史
 *   - config: 配置变更
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── 文件存储路径 ──────────────────────────

const MEMORY_DIR = process.env.OPS_MEMORY_DIR ||
  path.join(__dirname, 'data');
const EVENTS_FILE = path.join(MEMORY_DIR, 'events.jsonl');
const TICKETS_FILE = path.join(MEMORY_DIR, 'tickets.json');
const STATS_FILE = path.join(MEMORY_DIR, 'stats.json');

// 确保目录存在
function ensureDir() {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
  } catch { /* ignore if already exists */ }
}

// ── 事件日志（追加写入 JSONL） ─────────────

function logEvent(type, data) {
  ensureDir();
  const entry = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    timestamp: new Date().toISOString(),
    ...data
  };
  try {
    fs.appendFileSync(EVENTS_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error(`[Memory] 写入事件失败: ${err.message}`);
  }
  return entry;
}

/**
 * 查询最近的事件
 * @param {Object} filter - { type, since, limit }
 */
function queryEvents(filter = {}) {
  const { type, since, limit = 50 } = filter;
  try {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    const lines = fs.readFileSync(EVENTS_FILE, 'utf-8')
      .split('\n')
      .filter(l => l.trim());

    let events = [];
    // 从末尾往前读，提高效率
    for (let i = lines.length - 1; i >= 0 && events.length < limit * 2; i--) {
      try {
        events.push(JSON.parse(lines[i]));
      } catch { /* skip malformed lines */ }
    }

    if (type) {
      events = events.filter(e => e.type === type);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }

    return events.slice(0, limit);
  } catch {
    return [];
  }
}

// ── 工单管理 ──────────────────────────────

function loadTickets() {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  ensureDir();
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

function createTicket(data) {
  const tickets = loadTickets();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayCount = tickets.filter(t => t.id.includes(dateStr)).length;
  const ticket = {
    id: `OPS-${dateStr}-${String(todayCount + 1).padStart(3, '0')}`,
    title: data.title,
    description: data.description,
    severity: data.severity || 'medium',
    category: data.category || 'unknown',
    source: 'ops-agent',
    direction: data.direction || '待判断',
    status: 'open',
    diagnosis: data.diagnosis || '',
    suggestedFix: data.suggestedFix || '',
    relatedService: data.relatedService || '',
    autoRepairAttempts: data.autoRepairAttempts || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null
  };
  tickets.push(ticket);
  saveTickets(tickets);

  // 同时记为事件
  logEvent('ticket', { ticketId: ticket.id, title: ticket.title, severity: ticket.severity });

  return ticket;
}

function updateTicket(ticketId, updates) {
  const tickets = loadTickets();
  const idx = tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return null;
  Object.assign(tickets[idx], updates, { updatedAt: new Date().toISOString() });
  if (updates.status === 'resolved') {
    tickets[idx].resolvedAt = new Date().toISOString();
  }
  saveTickets(tickets);
  return tickets[idx];
}

function getOpenTickets() {
  return loadTickets().filter(t => t.status === 'open');
}

function getAllTickets(limit = 100) {
  return loadTickets().slice(-limit);
}

// ── 统计数据 ──────────────────────────────

function loadStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) return getDefaultStats();
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  } catch {
    return getDefaultStats();
  }
}

function saveStats(stats) {
  ensureDir();
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

function getDefaultStats() {
  return {
    totalChecks: 0,
    totalRepairs: 0,
    totalTickets: 0,
    totalChats: 0,
    lastQuickCheck: null,
    lastDeepCheck: null,
    lastDailyReport: null,
    uptimeStart: new Date().toISOString(),
    issuesByCategory: {},
    repairSuccessRate: { success: 0, fail: 0 }
  };
}

function incrementStat(key, amount = 1) {
  const stats = loadStats();
  if (typeof stats[key] === 'number') {
    stats[key] += amount;
  } else {
    stats[key] = amount;
  }
  saveStats(stats);
  return stats;
}

function updateStatField(key, value) {
  const stats = loadStats();
  stats[key] = value;
  saveStats(stats);
  return stats;
}

// ── 上下文构建（给 LLM 提供历史记忆） ────────

function buildMemoryContext() {
  const stats = loadStats();
  const recentEvents = queryEvents({ limit: 10 });
  const openTickets = getOpenTickets();

  let context = '## 运维守卫记忆\n';
  context += `- 启动时间: ${stats.uptimeStart}\n`;
  context += `- 总巡检次数: ${stats.totalChecks}\n`;
  context += `- 总修复次数: ${stats.totalRepairs}\n`;
  context += `- 开放工单数: ${openTickets.length}\n`;

  if (recentEvents.length > 0) {
    context += '\n## 最近事件\n';
    for (const evt of recentEvents.slice(0, 5)) {
      context += `- [${evt.timestamp}] ${evt.type}: ${evt.summary || evt.title || JSON.stringify(evt).slice(0, 100)}\n`;
    }
  }

  if (openTickets.length > 0) {
    context += '\n## 开放工单\n';
    for (const t of openTickets) {
      context += `- ${t.id}: ${t.title} (${t.severity}) — ${t.direction}\n`;
    }
  }

  return context;
}

module.exports = {
  logEvent,
  queryEvents,
  createTicket,
  updateTicket,
  getOpenTickets,
  getAllTickets,
  loadStats,
  incrementStat,
  updateStatField,
  buildMemoryContext,
  MEMORY_DIR
};
