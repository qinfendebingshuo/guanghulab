/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · 记忆层 — Agent 成长记忆
 * ═══════════════════════════════════════════════════════════
 *
 * 每次镜像对比的结果、评估决策、升级历史，都写入记忆文件
 * Agent 随时间成长：历史越多，评估越精准
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { MIRROR_CONFIG } = require('./config');

const MEMORY_FILE = path.join(MIRROR_CONFIG.memory_dir, 'mirror-memory.json');
const MAX_EVENTS = 500; // 保留最近 500 条事件

/**
 * 加载记忆
 */
function loadMemory() {
  try {
    fs.mkdirSync(MIRROR_CONFIG.memory_dir, { recursive: true });
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    }
  } catch {
    // corrupt file — reset
  }

  return {
    agent_id: MIRROR_CONFIG.agent_id,
    created_at: new Date().toISOString(),
    total_scans: 0,
    total_tickets: 0,
    total_upgrades: 0,
    last_scan_at: null,
    source_stats: {},
    events: [],
    learnings: []
  };
}

/**
 * 保存记忆
 */
function saveMemory(memory) {
  // 限制事件数量
  if (memory.events.length > MAX_EVENTS) {
    memory.events = memory.events.slice(-MAX_EVENTS);
  }
  memory.updated_at = new Date().toISOString();

  try {
    fs.mkdirSync(MIRROR_CONFIG.memory_dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
  } catch (err) {
    console.error(`[${MIRROR_CONFIG.agent_id}] 记忆保存失败: ${err.message}`);
  }
}

/**
 * 记录一次扫描事件
 */
function recordScan(scanResults, diffs, evaluation) {
  const memory = loadMemory();

  memory.total_scans++;
  memory.last_scan_at = new Date().toISOString();

  // 更新数据源统计
  for (const result of scanResults) {
    const sid = result.snapshot?.source_id;
    if (!sid) continue;

    if (!memory.source_stats[sid]) {
      memory.source_stats[sid] = {
        name: result.snapshot.source_name,
        total_probes: 0,
        online_count: 0,
        offline_count: 0,
        last_seen_online: null,
        upstream_versions: []
      };
    }

    const stats = memory.source_stats[sid];
    stats.total_probes++;

    if (result.snapshot.probe?.reachable) {
      stats.online_count++;
      stats.last_seen_online = new Date().toISOString();
    } else {
      stats.offline_count++;
    }

    if (result.snapshot.upstream) {
      const ver = result.snapshot.upstream.tag || result.snapshot.upstream.sha;
      if (ver && !stats.upstream_versions.includes(ver)) {
        stats.upstream_versions.push(ver);
        if (stats.upstream_versions.length > 20) {
          stats.upstream_versions = stats.upstream_versions.slice(-20);
        }
      }
    }
  }

  // 记录事件
  memory.events.push({
    type: 'scan',
    timestamp: new Date().toISOString(),
    sources_scanned: scanResults.length,
    diffs_found: diffs.filter(d => d.severity !== 'none').length,
    needs_upgrade: evaluation.needs_upgrade || false,
    urgency: evaluation.urgency || 'none',
    summary: evaluation.summary || ''
  });

  saveMemory(memory);
  return memory;
}

/**
 * 记录工单生成事件
 */
function recordTicket(ticket) {
  const memory = loadMemory();
  memory.total_tickets++;

  memory.events.push({
    type: 'ticket_created',
    timestamp: new Date().toISOString(),
    ticket_id: ticket.ticket_id,
    urgency: ticket.urgency,
    summary: ticket.summary
  });

  saveMemory(memory);
}

/**
 * 记录升级执行事件
 */
function recordUpgrade(ticketId, success, notes) {
  const memory = loadMemory();
  if (success) memory.total_upgrades++;

  memory.events.push({
    type: success ? 'upgrade_success' : 'upgrade_failed',
    timestamp: new Date().toISOString(),
    ticket_id: ticketId,
    notes
  });

  // 学习：成功/失败的模式
  memory.learnings.push({
    timestamp: new Date().toISOString(),
    ticket_id: ticketId,
    outcome: success ? 'success' : 'failure',
    lesson: notes
  });

  if (memory.learnings.length > 100) {
    memory.learnings = memory.learnings.slice(-100);
  }

  saveMemory(memory);
}

/**
 * 获取记忆摘要（用于 LLM 上下文）
 */
function getMemorySummary() {
  const memory = loadMemory();
  return {
    agent_id: memory.agent_id,
    total_scans: memory.total_scans,
    total_tickets: memory.total_tickets,
    total_upgrades: memory.total_upgrades,
    last_scan_at: memory.last_scan_at,
    sources: Object.entries(memory.source_stats).map(([id, stats]) => ({
      id,
      name: stats.name,
      reliability: stats.total_probes > 0
        ? `${Math.round(stats.online_count / stats.total_probes * 100)}%`
        : 'unknown',
      latest_version: stats.upstream_versions.length > 0
        ? stats.upstream_versions[stats.upstream_versions.length - 1]
        : 'unknown'
    })),
    recent_learnings: memory.learnings.slice(-5)
  };
}

module.exports = {
  loadMemory,
  saveMemory,
  recordScan,
  recordTicket,
  recordUpgrade,
  getMemorySummary
};
