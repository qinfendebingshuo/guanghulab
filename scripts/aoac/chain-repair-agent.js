#!/usr/bin/env node
'use strict';

/**
 * AOAC-07 · 链路修复Agent (Chain Repair Agent)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 修复Agent（3次自动修复）
 * 
 * 唤醒条件：Notion侧RECEIPT_DB打红色标签 / 定时检查
 * 职责：定位断链位置→自动修复→最多3次
 * 输出：data/aoac/repair-report.json
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const CHAIN_STATUS_PATH = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
const SYNC_LOG_PATH = path.join(ROOT, 'data', 'aoac', 'notion-sync-log.json');
const REPAIR_REPORT_PATH = path.join(ROOT, 'data', 'aoac', 'repair-report.json');
const HISTORY_DIR = path.join(ROOT, 'data', 'aoac', 'history');
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

const MAX_REPAIR_ATTEMPTS = 3;
const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';

function getBeijingTime() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().replace('T', ' ').slice(0, 19) + '+08:00';
}

function getDateStr() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function notionRequest(method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: NOTION_API_HOSTNAME,
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${parsed.message || data}`));
          else resolve(parsed);
        } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function diagnoseChain(chainStatus) {
  const issues = [];
  if (!chainStatus || !chainStatus.agents) {
    issues.push({ agent: 'ALL', issue: 'chain-status.json missing or corrupt', severity: 'critical' });
    return issues;
  }

  const agentOrder = ['AOAC-01', 'AOAC-02', 'AOAC-03', 'AOAC-04', 'AOAC-05', 'AOAC-06'];
  for (const id of agentOrder) {
    const agent = chainStatus.agents[id];
    if (!agent) {
      issues.push({ agent: id, issue: 'agent config missing', severity: 'warning' });
      continue;
    }
    if (agent.status === 'error') {
      issues.push({ agent: id, issue: `agent in error state`, severity: 'critical' });
    }
    if (!agent.last_run) {
      issues.push({ agent: id, issue: 'never executed', severity: 'info' });
    }
  }

  // Check sync log
  const syncLog = readJSON(SYNC_LOG_PATH);
  if (syncLog && syncLog.notion_sync && !syncLog.notion_sync.sent) {
    issues.push({
      agent: 'AOAC-06',
      issue: `Notion sync failed: ${syncLog.notion_sync.reason}`,
      severity: 'critical'
    });
  }

  return issues;
}

function attemptRepair(issues, attempt) {
  const results = [];

  for (const issue of issues) {
    if (issue.severity === 'info') continue;

    const result = {
      agent: issue.agent,
      issue: issue.issue,
      attempt,
      action: 'none',
      success: false
    };

    // Repair strategy: reset agent status
    if (issue.issue.includes('error state')) {
      const chainStatus = readJSON(CHAIN_STATUS_PATH);
      if (chainStatus && chainStatus.agents && chainStatus.agents[issue.agent]) {
        chainStatus.agents[issue.agent].status = 'idle';
        writeJSON(CHAIN_STATUS_PATH, chainStatus);
        result.action = 'reset_status_to_idle';
        result.success = true;
      }
    }

    // Repair strategy: re-trigger Notion sync on next AOAC-05 cycle
    if (issue.issue.includes('Notion sync failed') && attempt <= 2) {
      // Reset AOAC-06 status to idle so next AOAC-05 cycle will re-trigger it
      const cs = readJSON(CHAIN_STATUS_PATH);
      if (cs && cs.agents && cs.agents['AOAC-06']) {
        cs.agents['AOAC-06'].status = 'idle';
        writeJSON(CHAIN_STATUS_PATH, cs);
        result.action = 'reset_aoac06_for_retry';
        result.success = true;
      } else {
        result.action = 'cannot_reset_aoac06';
        result.success = false;
      }
    }

    // Repair strategy: recreate missing chain-status from default template
    if (issue.issue.includes('missing or corrupt')) {
      const templatePath = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
      if (!fs.existsSync(templatePath)) {
        // Recreate from scratch
        const defaultStatus = {
          _meta: { system: 'AGE OS Agent Chain (AOAC) v1.0', recreated: new Date().toISOString() },
          agents: {},
          chain_health: 'unknown',
          last_full_cycle: null,
          total_cycles: 0,
          total_repairs: 0
        };
        writeJSON(templatePath, defaultStatus);
        result.action = 'recreated_chain_status';
        result.success = true;
      } else {
        result.action = 'config_exists_no_action';
        result.success = true;
      }
    }

    results.push(result);
  }

  return results;
}

async function checkNotionReceipt() {
  const notionToken = process.env.ZY_NOTION_TOKEN || process.env.NOTION_TOKEN;
  const receiptDb = process.env.ZY_NOTION_RECEIPT_DB;

  if (!notionToken || !receiptDb) {
    return { checked: false, reason: 'missing_credentials' };
  }

  try {
    // Query latest AOAC sync receipts
    const body = {
      filter: {
        property: '类型',
        select: { equals: 'AOAC链路同步' }
      },
      sorts: [{ property: '时间戳', direction: 'descending' }],
      page_size: 5
    };

    const result = await notionRequest('POST', `/v1/databases/${receiptDb}/query`, body, notionToken);
    if (result && result.results && result.results.length > 0) {
      const latest = result.results[0];
      const status = latest.properties && latest.properties['状态'] &&
        latest.properties['状态'].select ? latest.properties['状态'].select.name : 'unknown';
      return {
        checked: true,
        latest_status: status,
        needs_repair: status === 'failed' || status === 'red' || status === '红色',
        page_id: latest.id
      };
    }
    return { checked: true, latest_status: 'no_records', needs_repair: false };
  } catch (err) {
    return { checked: false, reason: err.message };
  }
}

async function main() {
  console.log('🔧 AOAC-07 · 链路修复Agent · 唤醒中...');
  console.log(`📅 ${getBeijingTime()}`);

  const now = new Date();
  const dateStr = getDateStr();
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const repairId = `AOAC-REPAIR-${dateStr.replace(/-/g, '')}-${seq}`;

  // Step 1: Check Notion receipt status
  const receiptCheck = await checkNotionReceipt();
  console.log(`📋 Notion回执检查: ${JSON.stringify(receiptCheck)}`);

  // Step 2: Diagnose chain
  const chainStatus = readJSON(CHAIN_STATUS_PATH);
  const issues = diagnoseChain(chainStatus);
  console.log(`🔍 诊断发现 ${issues.length} 个问题`);

  const needsRepair = receiptCheck.needs_repair || issues.some(i => i.severity === 'critical');

  // Step 3: Attempt repairs (up to 3 times)
  const allRepairResults = [];
  let repairSuccess = false;

  if (needsRepair) {
    console.log('🔧 开始修复流程...');
    for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      console.log(`   第${attempt}次修复尝试...`);
      const results = attemptRepair(issues, attempt);
      allRepairResults.push({ attempt, results });

      const allFixed = results.every(r => r.success);
      if (allFixed) {
        repairSuccess = true;
        console.log(`   ✅ 第${attempt}次修复成功`);
        break;
      }
      console.log(`   ⚠️ 第${attempt}次修复部分失败`);
    }
  } else {
    console.log('✅ 链路健康，无需修复');
    repairSuccess = true;
  }

  // Step 4: Generate repair report
  const repairReport = {
    aoac_agent: 'AOAC-07',
    aoac_agent_name: 'chain-repair-agent',
    repair_id: repairId,
    timestamp: getBeijingTime(),
    timestamp_utc: now.toISOString(),
    receipt_check: receiptCheck,
    diagnosis: {
      total_issues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      issues
    },
    needed_repair: needsRepair,
    repair_attempts: allRepairResults,
    final_result: repairSuccess ? 'success' : 'failure',
    triggers_next: 'AOAC-08 (repair-supervisor)'
  };

  writeJSON(REPAIR_REPORT_PATH, repairReport);
  console.log(`📝 修复报告: ${repairId} → ${repairReport.final_result}`);

  // Archive
  const historyDir = path.join(HISTORY_DIR, dateStr);
  fs.mkdirSync(historyDir, { recursive: true });
  writeJSON(path.join(historyDir, `${repairId}.json`), repairReport);

  // Update chain status
  if (chainStatus && chainStatus.agents && chainStatus.agents['AOAC-07']) {
    chainStatus.agents['AOAC-07'].status = repairSuccess ? 'completed' : 'error';
    chainStatus.agents['AOAC-07'].last_run = now.toISOString();
    if (repairSuccess) chainStatus.agents['AOAC-07'].last_success = now.toISOString();
    chainStatus.total_repairs = (chainStatus.total_repairs || 0) + (needsRepair ? 1 : 0);
    writeJSON(CHAIN_STATUS_PATH, chainStatus);
  }

  // Output for workflow
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `repair_result=${repairReport.final_result}\n`);
    fs.appendFileSync(outputFile, `needed_repair=${needsRepair}\n`);
    fs.appendFileSync(outputFile, `repair_id=${repairId}\n`);
  }

  console.log(`🔧 AOAC-07 · 修复Agent完成 → ${repairReport.final_result}`);
}

main();
