#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🛡️ 铸渊运维守卫 · 主入口
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-001
 * 端口: 3950
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - HTTP API 服务（供前端工单面板调用）
 *   - 定时巡检（快速5分钟 / 深度1小时 / 全量每天）
 *   - 自动修复 + 工单升级
 *   - 对话接口（LLM推理）
 *
 * 使用:
 *   node ops-agent/index.js              启动守卫服务
 *   pm2 start ops-agent/ecosystem.config.js
 */

'use strict';

const express = require('express');
const cron = require('node-cron');
const path = require('path');

const healthChecker = require('./health-checker');
const repairEngine = require('./repair-engine');
const memory = require('./memory');
const notifier = require('./notifier');
const llmClient = require('./llm-client');

// ── 进程保活 ──────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[OPS] 未捕获异常（进程保活）:', err.message);
  console.error('[OPS] 堆栈:', err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[OPS] 未处理的Promise拒绝（进程保活）:', reason);
});

// ── Express 应用 ──────────────────────────

const app = express();
const PORT = parseInt(process.env.OPS_AGENT_PORT || '3950', 10);
const MAX_RETRIES = parseInt(process.env.OPS_MAX_REPAIR_RETRIES || '3', 10);

app.use(express.json({ limit: '1mb' }));

// 静态文件 — 运维工单面板
app.use('/ops', express.static(path.join(__dirname, 'web')));

// ── SSE 实时推送 ──────────────────────────

const sseClients = new Set();

app.get('/ops/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('data: {"type":"connected","message":"运维守卫 SSE 已连接"}\n\n');

  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); });
});

function broadcast(eventType, data) {
  const payload = `data: ${JSON.stringify({ type: eventType, timestamp: new Date().toISOString(), ...data })}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// ── API: 健康检查 ─────────────────────────

app.get('/health', (_req, res) => {
  const stats = memory.loadStats();
  res.json({
    status: 'ok',
    agent: 'zy-ops-agent',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    stats: {
      totalChecks: stats.totalChecks,
      totalRepairs: stats.totalRepairs,
      openTickets: memory.getOpenTickets().length
    },
    timestamp: new Date().toISOString()
  });
});

// ── API: 手动触发巡检 ─────────────────────

app.get('/api/ops/check/quick', async (_req, res) => {
  try {
    const result = await runQuickCheck();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

app.get('/api/ops/check/deep', async (_req, res) => {
  try {
    const result = await runDeepCheck();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ── API: 工单 ──────────────────────────────

app.get('/api/ops/tickets', (_req, res) => {
  const status = _req.query.status;
  let tickets;
  if (status === 'open') {
    tickets = memory.getOpenTickets();
  } else {
    tickets = memory.getAllTickets();
  }
  res.json({ tickets, total: tickets.length });
});

app.patch('/api/ops/tickets/:id', (req, res) => {
  const updated = memory.updateTicket(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: true, message: '工单不存在' });
  }
  broadcast('ticket_updated', { ticket: updated });
  res.json({ ticket: updated });
});

// ── API: 对话 ──────────────────────────────

app.post('/api/ops/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: true, message: '缺少 message 字段' });
  }

  try {
    // 构建上下文
    const memoryContext = memory.buildMemoryContext();

    // 如果消息看起来像是在描述一个错误，先做快速巡检
    let liveContext = '';
    if (/连不上|离线|打不开|报错|崩溃|offline|error|crash|down/i.test(message)) {
      const quick = await healthChecker.quickCheck();
      liveContext = `\n\n## 实时巡检结果\n${quick.summary}\n`;
      for (const s of quick.services) {
        liveContext += `- ${s.name}(:${s.port}): ${s.status} ${s.latency ? s.latency + 'ms' : ''} ${s.error || ''}\n`;
      }
    }

    const context = memoryContext + liveContext;
    const result = await llmClient.chat(message, context);

    // 记录对话
    memory.logEvent('chat', { question: message.slice(0, 200), method: result.method });
    memory.incrementStat('totalChats');

    res.json({
      answer: result.answer,
      patternHints: result.patternHints,
      method: result.method,
      model: result.model,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: true, message: `对话失败: ${err.message}` });
  }
});

// ── API: 统计 ──────────────────────────────

app.get('/api/ops/stats', (_req, res) => {
  const stats = memory.loadStats();
  res.json(stats);
});

// ── API: 最近事件 ─────────────────────────

app.get('/api/ops/events', (req, res) => {
  const type = req.query.type;
  const limit = parseInt(req.query.limit || '20', 10);
  const events = memory.queryEvents({ type, limit });
  res.json({ events, total: events.length });
});

// ── 巡检 + 修复 + 告警逻辑 ─────────────────

let isChecking = false;

async function runQuickCheck() {
  if (isChecking) return { skipped: true, reason: '上一次巡检尚未完成' };
  isChecking = true;

  try {
    const result = await healthChecker.quickCheck();
    memory.incrementStat('totalChecks');
    memory.updateStatField('lastQuickCheck', new Date().toISOString());

    // 有问题 → 尝试修复
    if (result.issues.length > 0) {
      const repairResults = repairEngine.autoRepair(result.issues, MAX_RETRIES);
      memory.incrementStat('totalRepairs', repairResults.filter(r => r.repaired).length);

      // 修不了的 → 创建工单
      for (const r of repairResults) {
        if (r.escalate) {
          const ticket = memory.createTicket({
            title: `${r.issue.service} - ${r.issue.error || r.issue.status}`,
            description: r.message,
            severity: r.issue.severity,
            category: r.issue.category || 'service',
            direction: classifyDirection(r.issue),
            diagnosis: r.issue.error || r.issue.status,
            suggestedFix: r.issue.fix || '',
            relatedService: r.issue.service,
            autoRepairAttempts: r.retryCount || MAX_RETRIES
          });
          broadcast('new_ticket', { ticket });

          // 邮件通知
          await notifier.notifyTicketCreated(ticket);
        }
      }

      result.repairs = repairResults;

      // 高/紧急级别 → 邮件告警
      await notifier.alertOnIssues(result);
    }

    memory.logEvent('check', {
      type: 'quick',
      healthy: result.healthy,
      issueCount: result.issues.length,
      summary: result.summary
    });

    broadcast('check_complete', { type: 'quick', healthy: result.healthy, summary: result.summary });

    return result;
  } finally {
    isChecking = false;
  }
}

async function runDeepCheck() {
  if (isChecking) return { skipped: true, reason: '上一次巡检尚未完成' };
  isChecking = true;

  try {
    const result = await healthChecker.deepCheck();
    memory.incrementStat('totalChecks');
    memory.updateStatField('lastDeepCheck', new Date().toISOString());

    // 有问题 → 修复 + 告警（同 quickCheck 逻辑）
    if (result.issues.length > 0) {
      const repairResults = repairEngine.autoRepair(result.issues, MAX_RETRIES);
      memory.incrementStat('totalRepairs', repairResults.filter(r => r.repaired).length);

      for (const r of repairResults) {
        if (r.escalate) {
          const ticket = memory.createTicket({
            title: `${r.issue.service} - ${r.issue.error || r.issue.status}`,
            description: r.message,
            severity: r.issue.severity,
            category: r.issue.category || 'service',
            direction: classifyDirection(r.issue),
            diagnosis: r.issue.error || r.issue.status,
            suggestedFix: r.issue.fix || '',
            relatedService: r.issue.service,
            autoRepairAttempts: r.retryCount || MAX_RETRIES
          });
          broadcast('new_ticket', { ticket });
          await notifier.notifyTicketCreated(ticket);
        }
      }

      result.repairs = repairResults;
      await notifier.alertOnIssues(result);
    }

    memory.logEvent('check', {
      type: 'deep',
      healthy: result.healthy,
      issueCount: result.issues.length,
      summary: result.summary
    });

    broadcast('check_complete', { type: 'deep', healthy: result.healthy, summary: result.summary });

    return result;
  } finally {
    isChecking = false;
  }
}

async function runDailyReport() {
  const report = await healthChecker.fullReport();
  memory.updateStatField('lastDailyReport', new Date().toISOString());
  memory.logEvent('daily_report', {
    reportId: report.report_id,
    healthy: report.healthy,
    issueCount: report.issues.length,
    summary: report.summary
  });

  await notifier.sendDailyReport(report);
  broadcast('daily_report', { reportId: report.report_id, summary: report.summary });

  return report;
}

/**
 * 判断问题处理方向
 */
function classifyDirection(issue) {
  const err = (issue.error || '').toLowerCase();
  const service = (issue.service || '').toLowerCase();

  // 密钥/配置问题 → 冰朔自己解决
  if (/api.*key|unauthorized|密钥|token/i.test(err)) {
    return '冰朔自行配置 — 检查 .env 文件中的API密钥';
  }
  // 代码错误 → 推给铸渊
  if (/syntaxerror|typeerror|referenceerror|代码/i.test(err)) {
    return '推给铸渊修代码 — 需要在GitHub仓库修复';
  }
  // 资源问题 → 冰朔确认
  if (/内存|磁盘|enomem|enospc/i.test(err)) {
    return '资源不足 — 可能需要升级服务器或清理空间';
  }
  // 进程问题 → 运维守卫已尝试修复
  if (/pm2|进程|restart|offline/i.test(err + service)) {
    return '进程异常 — 运维守卫已尝试自动重启';
  }
  return '待判断 — 需要进一步诊断';
}

// ── 定时调度 ──────────────────────────────

// 每5分钟快速巡检
cron.schedule('*/5 * * * *', () => {
  console.log('[OPS] ⏰ 定时快速巡检');
  runQuickCheck().catch(err => {
    console.error('[OPS] 快速巡检失败:', err.message);
  });
}, { timezone: 'Asia/Shanghai' });

// 每小时深度巡检
cron.schedule('0 * * * *', () => {
  console.log('[OPS] ⏰ 定时深度巡检');
  runDeepCheck().catch(err => {
    console.error('[OPS] 深度巡检失败:', err.message);
  });
}, { timezone: 'Asia/Shanghai' });

// 每天早上8点全量报告
cron.schedule('0 8 * * *', () => {
  console.log('[OPS] ⏰ 每日健康报告');
  runDailyReport().catch(err => {
    console.error('[OPS] 每日报告失败:', err.message);
  });
}, { timezone: 'Asia/Shanghai' });

// ── 启动服务 ──────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════════');
  console.log('  🛡️ 铸渊运维守卫 · ZY-OPS-001 已启动');
  console.log(`  端口: ${PORT}`);
  console.log(`  面板: http://127.0.0.1:${PORT}/ops/`);
  console.log('  巡检: 快速5分钟 · 深度1小时 · 全量每天8:00');
  console.log('  签发: 铸渊 · ICE-GL-ZY001');
  console.log('═══════════════════════════════════════════════');

  memory.logEvent('startup', { port: PORT, version: '1.0.0' });

  // 启动后立即做一次快速巡检
  setTimeout(() => {
    console.log('[OPS] 启动后首次巡检...');
    runQuickCheck().catch(err => {
      console.error('[OPS] 首次巡检失败:', err.message);
    });
  }, 5000);
});
