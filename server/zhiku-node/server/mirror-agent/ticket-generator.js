/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · Step 4 · 生成工单 — 工单引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 将 LLM 评估结果转化为工单，推送到铸渊巡检队列
 * 工单格式：MIRROR-YYYYMMDD-NNN
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MIRROR_CONFIG } = require('./config');

/**
 * 生成工单编号
 * 格式: MIRROR-YYYYMMDD-NNN
 */
function generateTicketId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  // 查找今天已有的工单数量
  const dir = MIRROR_CONFIG.ticket_dir;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const todayFiles = fs.readdirSync(dir)
      .filter(f => f.startsWith(`${MIRROR_CONFIG.ticket_prefix}-${dateStr}-`));
    const seq = String(todayFiles.length + 1).padStart(3, '0');
    return `${MIRROR_CONFIG.ticket_prefix}-${dateStr}-${seq}`;
  } catch {
    return `${MIRROR_CONFIG.ticket_prefix}-${dateStr}-001`;
  }
}

/**
 * 创建工单
 *
 * @param {Object} evaluation  — LLM 评估结果
 * @param {Array}  diffs       — 原始差异数据
 * @returns {Object} 工单对象
 */
function createTicket(evaluation, diffs) {
  const ticketId = generateTicketId();

  const ticket = {
    ticket_id: ticketId,
    created_at: new Date().toISOString(),
    status: 'pending_review', // pending_review | approved | rejected | executed | rolled_back
    agent: MIRROR_CONFIG.agent_id,
    agent_version: MIRROR_CONFIG.version,

    // 摘要
    summary: evaluation.summary || '镜面 Agent 自动生成工单',
    urgency: evaluation.urgency || 'low',
    needs_upgrade: evaluation.needs_upgrade || false,

    // 评估详情
    evaluation: {
      model_used: evaluation.model_used,
      evaluated_at: evaluation.evaluated_at,
      recommendations: evaluation.recommendations || [],
      rollback_plan: evaluation.rollback_plan || '恢复上一次快照版本的索引配置',
      risk_assessment: evaluation.risk_assessment || '未评估'
    },

    // 关联差异
    diffs: diffs.map(d => ({
      source_id: d.source_id,
      source_name: d.source_name,
      severity: d.severity,
      changes_count: d.changes.length,
      changes_summary: d.changes.map(c => c.description)
    })),

    // 审批链
    approval: {
      reviewer: '铸渊 · ICE-GL-ZY001',
      reviewed_at: null,
      decision: null,
      notes: null
    },

    // 执行记录
    execution: {
      started_at: null,
      completed_at: null,
      success: null,
      logs: []
    },

    // 溯源
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559'
  };

  // 保存工单文件
  const filepath = path.join(MIRROR_CONFIG.ticket_dir, `${ticketId}.json`);
  try {
    fs.mkdirSync(MIRROR_CONFIG.ticket_dir, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(ticket, null, 2), 'utf8');
  } catch (err) {
    ticket._save_error = err.message;
  }

  return { ticket, filepath };
}

/**
 * 列出所有工单（按状态过滤）
 */
function listTickets(status = null) {
  const dir = MIRROR_CONFIG.ticket_dir;
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
    const tickets = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (status) {
      return tickets.filter(t => t.status === status);
    }
    return tickets;
  } catch {
    return [];
  }
}

/**
 * 校验工单 ID 格式，防止路径穿越
 * 合法格式: MIRROR-YYYYMMDD-NNN
 */
function sanitizeTicketId(ticketId) {
  if (typeof ticketId !== 'string') return null;
  // 只允许 PREFIX-DIGITS-DIGITS 格式，拒绝任何路径字符
  if (!/^[A-Z]+-\d{8}-\d{3}$/.test(ticketId)) return null;
  return ticketId;
}

/**
 * 获取单个工单
 */
function getTicket(ticketId) {
  const safeId = sanitizeTicketId(ticketId);
  if (!safeId) return null;
  const filepath = path.join(MIRROR_CONFIG.ticket_dir, `${safeId}.json`);
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 更新工单状态（铸渊审批）
 */
function updateTicketStatus(ticketId, status, notes = '') {
  const safeId = sanitizeTicketId(ticketId);
  if (!safeId) return null;
  const ticket = getTicket(safeId);
  if (!ticket) return null;

  ticket.status = status;
  if (status === 'approved' || status === 'rejected') {
    ticket.approval.reviewed_at = new Date().toISOString();
    ticket.approval.decision = status;
    ticket.approval.notes = notes;
  }

  const filepath = path.join(MIRROR_CONFIG.ticket_dir, `${safeId}.json`);
  fs.writeFileSync(filepath, JSON.stringify(ticket, null, 2), 'utf8');
  return ticket;
}

/**
 * 记录工单执行日志
 */
function logTicketExecution(ticketId, logEntry) {
  const safeId = sanitizeTicketId(ticketId);
  if (!safeId) return null;
  const ticket = getTicket(safeId);
  if (!ticket) return null;

  if (!ticket.execution.started_at) {
    ticket.execution.started_at = new Date().toISOString();
  }
  ticket.execution.logs.push({
    timestamp: new Date().toISOString(),
    ...logEntry
  });

  const filepath = path.join(MIRROR_CONFIG.ticket_dir, `${safeId}.json`);
  fs.writeFileSync(filepath, JSON.stringify(ticket, null, 2), 'utf8');
  return ticket;
}

/**
 * 标记工单执行完成
 */
function completeTicket(ticketId, success, finalNotes = '') {
  const safeId = sanitizeTicketId(ticketId);
  if (!safeId) return null;
  const ticket = getTicket(safeId);
  if (!ticket) return null;

  ticket.execution.completed_at = new Date().toISOString();
  ticket.execution.success = success;
  ticket.status = success ? 'executed' : 'rolled_back';

  if (finalNotes) {
    ticket.execution.logs.push({
      timestamp: new Date().toISOString(),
      message: finalNotes,
      type: success ? 'complete' : 'rollback'
    });
  }

  const filepath = path.join(MIRROR_CONFIG.ticket_dir, `${safeId}.json`);
  fs.writeFileSync(filepath, JSON.stringify(ticket, null, 2), 'utf8');
  return ticket;
}

module.exports = {
  generateTicketId,
  createTicket,
  listTickets,
  getTicket,
  updateTicketStatus,
  logTicketExecution,
  completeTicket
};
