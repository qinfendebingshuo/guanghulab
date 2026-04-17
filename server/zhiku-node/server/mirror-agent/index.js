/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · 镜鉴 Agent · 主入口
 * ═══════════════════════════════════════════════════════════
 *
 * 五步闭环：照镜子 → 差异感知 → 自主评估 → 生成工单 → 等待审批
 *
 * 运行模式：
 *   1. 被 server.js 集成调用（API 路由）
 *   2. 定时自主执行（内置 scheduler）
 *   3. 手动触发（API: POST /api/mirror/scan）
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const { MIRROR_CONFIG, getEnabledSources } = require('./config');
const { takeAllSnapshots } = require('./snapshot-engine');
const { analyzeAll } = require('./diff-engine');
const { evaluate } = require('./llm-evaluator');
const { createTicket, listTickets, getTicket, updateTicketStatus } = require('./ticket-generator');
const { recordScan, recordTicket, getMemorySummary } = require('./memory');

let scanTimer = null;
let isScanning = false;
let lastScanResult = null;

/**
 * 执行完整五步闭环扫描
 */
async function runFullScan() {
  if (isScanning) {
    return { error: true, message: '扫描正在进行中，请稍后' };
  }

  isScanning = true;
  const startTime = Date.now();
  const log = [];

  try {
    log.push(`[${new Date().toISOString()}] 镜鉴 Agent 开始扫描...`);

    // Step 1: 照镜子 — 拍摄快照
    log.push('[Step 1] 照镜子 — 拉取数据源快照...');
    const snapshots = await takeAllSnapshots();
    log.push(`[Step 1] 完成: ${snapshots.length} 个数据源已快照`);

    // Step 2: 差异感知
    log.push('[Step 2] 差异感知 — 对比历史快照...');
    const sourceIds = snapshots.map(s => s.snapshot?.source_id).filter(Boolean);
    const diffs = analyzeAll(sourceIds);
    const significantDiffs = diffs.filter(d => d.severity !== 'none');
    log.push(`[Step 2] 完成: ${diffs.length} 个差异报告, ${significantDiffs.length} 个有显著变化`);

    // Step 3: 自主评估（LLM 推理）
    log.push('[Step 3] 自主评估 — 送入模型推理...');
    const evaluation = await evaluate(diffs);
    log.push(`[Step 3] 完成: needs_upgrade=${evaluation.needs_upgrade}, urgency=${evaluation.urgency}`);
    log.push(`[Step 3] 摘要: ${evaluation.summary}`);

    // Step 4: 生成工单（仅在需要升级时）
    let ticket = null;
    if (evaluation.needs_upgrade) {
      log.push('[Step 4] 生成工单...');
      const result = createTicket(evaluation, diffs);
      ticket = result.ticket;
      recordTicket(ticket);
      log.push(`[Step 4] 工单已创建: ${ticket.ticket_id} (${ticket.urgency})`);
    } else {
      log.push('[Step 4] 无需升级，跳过工单生成');
    }

    // Step 5: 记录到记忆层
    recordScan(snapshots, diffs, evaluation);

    const elapsed = Date.now() - startTime;
    log.push(`[完成] 扫描耗时 ${elapsed}ms`);

    lastScanResult = {
      success: true,
      scan_at: new Date().toISOString(),
      elapsed_ms: elapsed,
      sources_scanned: snapshots.length,
      diffs: diffs.map(d => ({
        source: d.source_name,
        severity: d.severity,
        changes: d.changes.length
      })),
      evaluation: {
        needs_upgrade: evaluation.needs_upgrade,
        urgency: evaluation.urgency,
        summary: evaluation.summary,
        model_used: evaluation.model_used
      },
      ticket: ticket ? {
        ticket_id: ticket.ticket_id,
        status: ticket.status
      } : null,
      log
    };

    return lastScanResult;
  } catch (err) {
    log.push(`[错误] ${err.message}`);
    lastScanResult = {
      success: false,
      error: err.message,
      scan_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startTime,
      log
    };
    return lastScanResult;
  } finally {
    isScanning = false;
  }
}

/**
 * 启动定时扫描
 */
function startScheduler() {
  if (scanTimer) return;

  const interval = MIRROR_CONFIG.scan_interval_ms;
  console.log(`[${MIRROR_CONFIG.agent_id}] 定时扫描已启动 · 间隔: ${interval / 3600000}h`);

  scanTimer = setInterval(async () => {
    console.log(`[${MIRROR_CONFIG.agent_id}] 定时扫描触发...`);
    try {
      await runFullScan();
    } catch (err) {
      console.error(`[${MIRROR_CONFIG.agent_id}] 定时扫描失败: ${err.message}`);
    }
  }, interval);

  // 不阻止进程退出
  if (scanTimer.unref) scanTimer.unref();
}

/**
 * 停止定时扫描
 */
function stopScheduler() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
    console.log(`[${MIRROR_CONFIG.agent_id}] 定时扫描已停止`);
  }
}

/**
 * 获取 Agent 状态
 */
function getStatus() {
  return {
    agent_id: MIRROR_CONFIG.agent_id,
    agent_name: MIRROR_CONFIG.agent_name,
    version: MIRROR_CONFIG.version,
    scheduler_active: !!scanTimer,
    is_scanning: isScanning,
    scan_interval: `${MIRROR_CONFIG.scan_interval_ms / 3600000}h`,
    last_scan: lastScanResult ? {
      success: lastScanResult.success,
      scan_at: lastScanResult.scan_at,
      elapsed_ms: lastScanResult.elapsed_ms
    } : null,
    memory: getMemorySummary(),
    enabled_sources: getEnabledSources().map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      github_repo: s.github_repo
    })),
    timestamp: new Date().toISOString(),
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559'
  };
}

/**
 * Express 路由注册器
 * 挂载到 /api/mirror/* 路径下
 */
function registerRoutes(app, verifyToken) {
  // GET /api/mirror/status — Agent 状态
  app.get('/api/mirror/status', verifyToken, (req, res) => {
    res.json({ error: false, data: getStatus() });
  });

  // POST /api/mirror/scan — 手动触发扫描
  app.post('/api/mirror/scan', verifyToken, async (req, res) => {
    try {
      const result = await runFullScan();
      res.json({ error: false, data: result });
    } catch (err) {
      res.status(500).json({ error: true, code: 'SCAN_FAILED', message: err.message });
    }
  });

  // GET /api/mirror/tickets — 列出工单
  app.get('/api/mirror/tickets', verifyToken, (req, res) => {
    const status = req.query.status || null;
    const tickets = listTickets(status);
    res.json({ error: false, total: tickets.length, tickets });
  });

  // GET /api/mirror/tickets/:id — 工单详情
  app.get('/api/mirror/tickets/:id', verifyToken, (req, res) => {
    const ticket = getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '工单不存在' });
    }
    res.json({ error: false, data: ticket });
  });

  // POST /api/mirror/tickets/:id/approve — 审批工单
  app.post('/api/mirror/tickets/:id/approve', verifyToken, (req, res) => {
    const { notes } = req.body || {};
    const ticket = updateTicketStatus(req.params.id, 'approved', notes || '铸渊审批通过');
    if (!ticket) {
      return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '工单不存在' });
    }
    res.json({ error: false, data: ticket, message: '工单已批准' });
  });

  // POST /api/mirror/tickets/:id/reject — 驳回工单
  app.post('/api/mirror/tickets/:id/reject', verifyToken, (req, res) => {
    const { notes } = req.body || {};
    const ticket = updateTicketStatus(req.params.id, 'rejected', notes || '铸渊驳回');
    if (!ticket) {
      return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '工单不存在' });
    }
    res.json({ error: false, data: ticket, message: '工单已驳回' });
  });

  // GET /api/mirror/memory — Agent 记忆摘要
  app.get('/api/mirror/memory', verifyToken, (req, res) => {
    res.json({ error: false, data: getMemorySummary() });
  });

  // GET /api/mirror/sources — 数据源列表
  app.get('/api/mirror/sources', verifyToken, (req, res) => {
    const { DATA_SOURCES } = require('./config');
    res.json({ error: false, total: DATA_SOURCES.length, sources: DATA_SOURCES });
  });

  // GET /api/mirror/last-scan — 最近一次扫描结果
  app.get('/api/mirror/last-scan', verifyToken, (req, res) => {
    if (!lastScanResult) {
      return res.json({ error: false, data: null, message: '尚未执行过扫描' });
    }
    res.json({ error: false, data: lastScanResult });
  });
}

module.exports = {
  runFullScan,
  startScheduler,
  stopScheduler,
  getStatus,
  registerRoutes
};
