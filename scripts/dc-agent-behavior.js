/**
 * scripts/dc-agent-behavior.js
 * DC-03 · Agent 行为记录器
 *
 * 采集时机：每次铸渊处理 Notion 工单回写后附带写入
 * 存储位置：data/dc-reports/agent-behavior-YYYY-MM.json（按月累积）
 *
 * 用法：
 *   1. 作为模块引入：
 *      const { appendAgentBehaviorLog } = require('./dc-agent-behavior');
 *      appendAgentBehaviorLog({ type: '规则同步', auto_resolved: true, processing_sec: 18 });
 *
 *   2. 命令行调用：
 *      node scripts/dc-agent-behavior.js --type "规则同步" --auto --sec 18
 *      node scripts/dc-agent-behavior.js --type "工单回执" --human --sec 45 --llm-calls 3 --tokens 1200
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const DC_DIR = path.join(ROOT, 'data/dc-reports');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ━━━ 获取当月标识 ━━━

function getCurrentMonth() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 7);
}

// ━━━ 加载或初始化月度文件 ━━━

function loadMonthlyReport(month) {
  const filePath = path.join(DC_DIR, `agent-behavior-${month}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {
      month: month,
      tickets: [],
      llm_calls_total: 0,
      avg_tokens_per_call: 0,
      human_intervention_rate: 0
    };
  }
}

// ━━━ 重新计算统计指标 ━━━

function recalcStats(report) {
  const total = report.tickets.length;
  if (total === 0) return;

  const humanCount = report.tickets.filter(t => t.human_intervention).length;
  report.human_intervention_rate = parseFloat((humanCount / total).toFixed(2));
  // llm_calls_total 和 avg_tokens_per_call 在 append 时累加
}

// ━━━ 核心：追加行为记录 ━━━

function appendAgentBehaviorLog(ticketData) {
  fs.mkdirSync(DC_DIR, { recursive: true });

  const month  = ticketData.month || getCurrentMonth();
  const report = loadMonthlyReport(month);

  const record = {
    type: ticketData.type || 'unknown',
    auto_resolved: ticketData.auto_resolved !== false,
    human_intervention: ticketData.human_intervention === true,
    processing_sec: ticketData.processing_sec || 0,
    timestamp: new Date().toISOString()
  };

  report.tickets.push(record);

  // 累加 LLM 调用统计
  if (ticketData.llm_calls) {
    const prevTotal = report.llm_calls_total;
    report.llm_calls_total += ticketData.llm_calls;

    if (ticketData.tokens_per_call) {
      // 加权平均
      const prevTokens = report.avg_tokens_per_call * prevTotal;
      const newTokens  = ticketData.tokens_per_call * ticketData.llm_calls;
      report.avg_tokens_per_call = Math.round(
        (prevTokens + newTokens) / report.llm_calls_total
      );
    }
  }

  recalcStats(report);

  const filePath = path.join(DC_DIR, `agent-behavior-${month}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));

  console.log(`🤖 DC-03 · 行为记录已追加: ${record.type} (${month})`);
  return report;
}

// ━━━ CLI 模式 ━━━

function parseCli() {
  const args = process.argv.slice(2);
  if (args.length === 0) return null;

  const data = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
        data.type = args[++i]; break;
      case '--auto':
        data.auto_resolved = true; break;
      case '--human':
        data.human_intervention = true;
        data.auto_resolved = false; break;
      case '--sec':
        data.processing_sec = parseInt(args[++i], 10) || 0; break;
      case '--llm-calls':
        data.llm_calls = parseInt(args[++i], 10) || 0; break;
      case '--tokens':
        data.tokens_per_call = parseInt(args[++i], 10) || 0; break;
      case '--month':
        data.month = args[++i]; break;
    }
  }

  return data.type ? data : null;
}

// ━━━ 入口 ━━━

if (require.main === module) {
  const cliData = parseCli();
  if (cliData) {
    appendAgentBehaviorLog(cliData);
  } else {
    console.log('用法: node dc-agent-behavior.js --type "类型" [--auto|--human] [--sec N] [--llm-calls N] [--tokens N]');
    process.exit(1);
  }
}

module.exports = { appendAgentBehaviorLog };
