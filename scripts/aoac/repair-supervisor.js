#!/usr/bin/env node
'use strict';

/**
 * AOAC-08 · 修复监督Agent (Repair Supervisor)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 监督Agent（修复监督层）
 * 
 * 唤醒条件：AOAC-07修复行为启动（事件触发）
 * 职责：监督修复过程→接收修复报告→判断最终结果
 * 成功→Notion标绿  失败→发邮件给冰朔
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createTransport } = (() => {
  try { return require('nodemailer'); }
  catch { return { createTransport: null }; }
})();

const ROOT = path.resolve(__dirname, '..', '..');
const REPAIR_REPORT_PATH = path.join(ROOT, 'data', 'aoac', 'repair-report.json');
const VERDICT_PATH = path.join(ROOT, 'data', 'aoac', 'supervisor-verdict.json');
const CHAIN_STATUS_PATH = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';

function getBeijingTime() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().replace('T', ' ').slice(0, 19) + '+08:00';
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

async function updateNotionReceiptGreen(pageId) {
  const notionToken = process.env.ZY_NOTION_TOKEN || process.env.NOTION_TOKEN;
  if (!notionToken || !pageId) return false;

  try {
    await notionRequest('PATCH', `/v1/pages/${pageId}`, {
      properties: {
        '状态': { select: { name: '✅ 已确认' } }
      }
    }, notionToken);
    return true;
  } catch (err) {
    console.error('⚠️ 更新Notion状态失败:', err.message);
    return false;
  }
}

async function sendAlertEmail(repairReport) {
  const smtpUser = process.env.ZY_SMTP_USER;
  const smtpPass = process.env.ZY_SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.log('⚠️ SMTP未配置，无法发送告警邮件');
    return { sent: false, reason: 'missing_smtp_credentials' };
  }

  // Use nodemailer if available, otherwise use raw SMTP via https webhook
  if (!createTransport) {
    console.log('⚠️ nodemailer不可用，将通过GitHub Issue告警');
    return { sent: false, reason: 'nodemailer_unavailable', fallback: 'github_issue' };
  }

  try {
    const transporter = createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const diagnosis = repairReport.diagnosis || {};
    const body = [
      `🔴 AOAC链路修复失败告警`,
      ``,
      `修复ID: ${repairReport.repair_id}`,
      `时间: ${repairReport.timestamp}`,
      `诊断问题: ${diagnosis.total_issues || 0}个 (关键: ${diagnosis.critical || 0}个)`,
      `修复尝试: ${(repairReport.repair_attempts || []).length}次`,
      `最终结果: ${repairReport.final_result}`,
      ``,
      `问题详情:`,
      ...(diagnosis.issues || []).map(i => `  - [${i.severity}] ${i.agent}: ${i.issue}`),
      ``,
      `请人工介入检查。`,
      ``,
      `—— 铸渊·AOAC-08监督Agent`
    ].join('\n');

    await transporter.sendMail({
      from: smtpUser,
      to: smtpUser,
      subject: `🔴 AOAC链路修复失败 · ${repairReport.repair_id}`,
      text: body
    });

    return { sent: true, method: 'email' };
  } catch (err) {
    console.error('❌ 邮件发送失败:', err.message);
    return { sent: false, reason: err.message };
  }
}

async function createAlertIssue(repairReport) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

  if (!token) return { created: false, reason: 'no_token' };

  const diagnosis = repairReport.diagnosis || {};
  const body = [
    `## 🔴 AOAC链路修复失败`,
    ``,
    `**修复ID**: ${repairReport.repair_id}`,
    `**时间**: ${repairReport.timestamp}`,
    `**诊断**: ${diagnosis.total_issues || 0}个问题 (${diagnosis.critical || 0}个关键)`,
    `**尝试**: ${(repairReport.repair_attempts || []).length}次修复`,
    `**结果**: ❌ ${repairReport.final_result}`,
    ``,
    `### 问题详情`,
    ...(diagnosis.issues || []).map(i => `- \`[${i.severity}]\` **${i.agent}**: ${i.issue}`),
    ``,
    `---`,
    `*此Issue由AOAC-08监督Agent自动创建，请冰朔人工介入*`
  ].join('\n');

  return new Promise((resolve) => {
    const reqBody = JSON.stringify({
      title: `🔴 AOAC链路修复失败 · ${repairReport.repair_id}`,
      body,
      labels: ['aoac-alert', 'needs-human']
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}/issues`,
      method: 'POST',
      headers: {
        'User-Agent': 'AOAC-Supervisor/1.0',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(reqBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ created: res.statusCode < 400, issue_number: parsed.number });
        } catch { resolve({ created: false }); }
      });
    });
    req.on('error', () => resolve({ created: false }));
    req.write(reqBody);
    req.end();
  });
}

async function main() {
  console.log('👁️ AOAC-08 · 修复监督Agent · 唤醒中...');
  console.log(`📅 ${getBeijingTime()}`);

  const now = new Date();
  const repairReport = readJSON(REPAIR_REPORT_PATH);

  if (!repairReport) {
    console.log('⚠️ 修复报告不存在，跳过监督');
    return;
  }

  const isSuccess = repairReport.final_result === 'success';
  const neededRepair = repairReport.needed_repair;

  let verdictAction = {};

  if (isSuccess || !neededRepair) {
    console.log('✅ 修复成功或无需修复');

    // Update Notion receipt to green if there's a page ID
    if (repairReport.receipt_check && repairReport.receipt_check.page_id) {
      const updated = await updateNotionReceiptGreen(repairReport.receipt_check.page_id);
      verdictAction.notion_updated = updated;
    }
    verdictAction.action = 'close_green';
  } else {
    console.log('🔴 修复失败 · 触发告警');

    // Try email first, then GitHub Issue as fallback
    const emailResult = await sendAlertEmail(repairReport);
    verdictAction.email = emailResult;

    if (!emailResult.sent) {
      const issueResult = await createAlertIssue(repairReport);
      verdictAction.github_issue = issueResult;
    }
    verdictAction.action = 'alert_human';
  }

  // Write supervisor verdict
  const verdict = {
    aoac_agent: 'AOAC-08',
    aoac_agent_name: 'repair-supervisor',
    timestamp: getBeijingTime(),
    timestamp_utc: now.toISOString(),
    repair_id: repairReport.repair_id,
    verdict: isSuccess || !neededRepair ? 'green' : 'red',
    needed_repair: neededRepair,
    repair_result: repairReport.final_result,
    action: verdictAction,
    chain_closed: isSuccess || !neededRepair
  };

  writeJSON(VERDICT_PATH, verdict);
  console.log(`📝 监督判定: ${verdict.verdict === 'green' ? '🟢' : '🔴'} ${verdict.verdict}`);

  // Update chain status
  const chainStatus = readJSON(CHAIN_STATUS_PATH) || {};
  if (chainStatus.agents && chainStatus.agents['AOAC-08']) {
    chainStatus.agents['AOAC-08'].status = 'completed';
    chainStatus.agents['AOAC-08'].last_run = now.toISOString();
    chainStatus.agents['AOAC-08'].last_success = now.toISOString();
  }
  if (chainStatus && verdict.chain_closed) {
    chainStatus.chain_health = 'healthy';
  }
  writeJSON(CHAIN_STATUS_PATH, chainStatus);

  // Output for workflow
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `verdict=${verdict.verdict}\n`);
    fs.appendFileSync(outputFile, `chain_closed=${verdict.chain_closed}\n`);
  }

  console.log(`👁️ AOAC-08 · 监督完成 · 闭环${verdict.chain_closed ? '✅' : '❌'}`);
}

main();
