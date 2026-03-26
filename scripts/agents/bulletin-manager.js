// scripts/agents/bulletin-manager.js
// Bulletin Manager · 公告板管理器
// ZY-P1-README-003 · Phase 1 · README Management Agent
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BULLETIN_PATH = path.join(ROOT, '.github/tianyen/bulletin-data.json');

/**
 * 读取公告数据
 * @returns {{ events: object[] }}
 */
function loadBulletin() {
  if (!fs.existsSync(BULLETIN_PATH)) {
    return { events: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(BULLETIN_PATH, 'utf8'));
    if (!Array.isArray(data.events)) {
      data.events = [];
    }
    return data;
  } catch (_) {
    return { events: [] };
  }
}

/**
 * 保存公告数据
 * @param {{ events: object[] }} data
 */
function saveBulletin(data) {
  const dir = path.dirname(BULLETIN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(BULLETIN_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 添加事件 · 去重（按 id）
 * @param {{ id: string, timestamp: string, event: string, status: string, handler: string, priority: number }} event
 * @returns {boolean} 是否成功添加（false = 已存在）
 */
function addEvent(event) {
  const data = loadBulletin();

  // 去重：相同 id 的事件不重复添加
  const existing = data.events.findIndex(e => e.id === event.id);
  if (existing >= 0) {
    return false;
  }

  data.events.push({
    id: event.id,
    timestamp: event.timestamp || new Date().toISOString(),
    event: event.event || '',
    status: event.status || 'active',
    handler: event.handler || '',
    priority: event.priority || 3
  });

  saveBulletin(data);
  return true;
}

/**
 * 更新事件状态
 * @param {string} eventId
 * @param {string} newStatus
 * @returns {boolean} 是否找到并更新
 */
function updateStatus(eventId, newStatus) {
  const data = loadBulletin();
  const idx = data.events.findIndex(e => e.id === eventId);
  if (idx < 0) return false;

  data.events[idx].status = newStatus;
  data.events[idx].updated_at = new Date().toISOString();
  saveBulletin(data);
  return true;
}

/**
 * 获取所有活跃事件
 * @returns {object[]}
 */
function getActive() {
  const data = loadBulletin();
  return data.events.filter(e => e.status !== 'resolved');
}

/**
 * 获取最近的事件
 * @param {number} limit
 * @returns {object[]}
 */
function getRecent(limit) {
  const data = loadBulletin();
  return data.events
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
    .slice(0, limit || 10);
}

/**
 * 清理过期事件
 * @param {number} maxAge - 最大存活时间（毫秒）
 * @returns {number} 被清理的数量
 */
function prune(maxAge) {
  const data = loadBulletin();
  const cutoff = Date.now() - maxAge;
  const before = data.events.length;

  data.events = data.events.filter(e => {
    const ts = new Date(e.timestamp).getTime();
    return ts >= cutoff;
  });

  const pruned = before - data.events.length;
  if (pruned > 0) {
    saveBulletin(data);
  }
  return pruned;
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('📋 Bulletin Manager · 公告板管理器\n');

  const active = getActive();
  console.log(`  活跃事件: ${active.length}`);

  const recent = getRecent(5);
  console.log(`  最近事件: ${recent.length}`);
}

module.exports = { addEvent, updateStatus, getActive, getRecent, prune, loadBulletin, saveBulletin };
