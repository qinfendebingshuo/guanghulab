/**
 * 全链路审计追溯系统 · Audit Trail
 * 语言膜核心组件
 *
 * 每一条通过语言膜的请求都会被记录：
 *   WHO  — 谁发起的（HLDP编号 / IP / 会话ID）
 *   WHAT — 什么操作（HLDP格式化的指令内容）
 *   WHEN — 什么时间（ISO时间戳）
 *   WHERE — 在哪个频道/模块（频道编号/模块编号）
 *   HOW  — 执行结果（成功/失败/异常）
 *   WHY  — 什么触发的（上下文链路）
 *
 * 编号: SY-MEMBRANE-AUDIT-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 审计日志存储目录
const AUDIT_DIR = process.env.ZY_AUDIT_DIR
  || path.join(process.env.ZY_ROOT || process.cwd(), 'data', 'audit-trail');

/**
 * 生成审计事件ID
 * 格式: AT-YYYYMMDD-HHmmss-XXXX
 */
function generateAuditId() {
  const now = new Date();
  const date = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `AT-${date}-${rand}`;
}

/**
 * 创建审计条目
 *
 * @param {object} params
 * @param {string} params.who         — 请求发起者标识
 * @param {string} params.what        — 操作描述
 * @param {string} [params.where]     — 频道/模块标识
 * @param {string} [params.why]       — 触发原因/上下文
 * @param {string} [params.sourceIp]  — 来源IP
 * @param {string} [params.sessionId] — 会话ID
 * @returns {object} 审计条目
 */
function createEntry(params) {
  return {
    audit_id: generateAuditId(),
    timestamp: new Date().toISOString(),
    who: params.who || 'unknown',
    what: params.what || '',
    when: new Date().toISOString(),
    where: params.where || 'membrane-gateway',
    why: params.why || '',
    how: 'pending',
    source_ip: params.sourceIp || '',
    session_id: params.sessionId || '',
    responsibility: 'undetermined',
  };
}

/**
 * 完成审计条目（填入执行结果）
 *
 * @param {object} entry            — createEntry 返回的条目
 * @param {string} result           — 'success' | 'failure' | 'error' | 'denied'
 * @param {string} [responsibility] — 'system' | 'human' | 'persona'
 * @param {string} [detail]         — 附加信息
 * @returns {object} 完成后的审计条目
 */
function completeEntry(entry, result, responsibility, detail) {
  entry.how = result;
  entry.responsibility = responsibility || 'system';
  entry.completed_at = new Date().toISOString();
  if (detail) {
    entry.detail = detail;
  }
  return entry;
}

/**
 * 持久化审计条目到磁盘
 * 按日期分文件存储: data/audit-trail/YYYY-MM-DD.jsonl
 *
 * @param {object} entry — 审计条目
 */
function persist(entry) {
  try {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filePath = path.join(AUDIT_DIR, `${dateStr}.jsonl`);
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // 审计系统自身不能阻塞请求流，记录到 stderr
    process.stderr.write(`[AUDIT] persist error: ${err.message}\n`);
  }
}

/**
 * 查询审计日志
 *
 * @param {object} [filter]
 * @param {string} [filter.date]  — 'YYYY-MM-DD'
 * @param {string} [filter.who]   — 按 who 过滤
 * @param {number} [filter.limit] — 最大返回条数
 * @returns {Array} 审计条目列表
 */
function query(filter) {
  const opts = filter || {};
  const dateStr = opts.date || new Date().toISOString().slice(0, 10);
  const filePath = path.join(AUDIT_DIR, `${dateStr}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean);

  let entries = lines.map(line => {
    try { return JSON.parse(line); } catch (_) { return null; }
  }).filter(Boolean);

  if (opts.who) {
    entries = entries.filter(e => e.who === opts.who);
  }

  if (opts.limit && opts.limit > 0) {
    entries = entries.slice(-opts.limit);
  }

  return entries;
}

module.exports = {
  createEntry,
  completeEntry,
  persist,
  query,
  generateAuditId,
  AUDIT_DIR,
};
