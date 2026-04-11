#!/usr/bin/env node
'use strict';

/**
 * AOAC-06 · Notion同步信号Agent (Notion Sync Signal)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 同步信号发送
 * 
 * 唤醒条件：AOAC-05完成后触发
 * 职责：向Notion发送同步信号→写入回执DB→本地留底
 * 输出到Notion：ZY_NOTION_RECEIPT_DB写入记录
 * 输出到仓库：data/aoac/notion-sync-log.json
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const MASTER_REPORT_PATH = path.join(ROOT, 'data', 'aoac', 'master-report.json');
const SYNC_LOG_PATH = path.join(ROOT, 'data', 'aoac', 'notion-sync-log.json');
const CHAIN_STATUS_PATH = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;

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

function richText(content) {
  const text = String(content || '').slice(0, NOTION_RICH_TEXT_MAX);
  return [{ type: 'text', text: { content: text } }];
}

function titleProp(content) {
  return [{ type: 'text', text: { content: String(content || '').slice(0, 120) } }];
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
          if (res.statusCode >= 400) {
            reject(new Error(`Notion API ${res.statusCode}: ${parsed.message || data}`));
          } else {
            resolve(parsed);
          }
        } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Notion API timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function sendNotionSync(masterReport) {
  const notionToken = process.env.ZY_NOTION_TOKEN || process.env.NOTION_TOKEN;
  const receiptDb = process.env.ZY_NOTION_RECEIPT_DB;

  if (!notionToken || !receiptDb) {
    console.log('⚠️ Notion密钥未配置 (ZY_NOTION_TOKEN / ZY_NOTION_RECEIPT_DB)，跳过Notion同步');
    return { sent: false, reason: 'missing_credentials' };
  }

  const now = new Date();
  const dateStr = getDateStr();
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const syncId = `AOAC-SYNC-${dateStr.replace(/-/g, '')}-${seq}`;

  const body = {
    parent: { database_id: receiptDb },
    properties: {
      '标题': { title: titleProp(`${syncId} · AOAC链路同步`) },
      '类型': { select: { name: 'AOAC链路同步' } },
      '状态': { select: { name: 'pending_confirmation' } },
      '时间戳': { date: { start: now.toISOString() } }
    },
    children: [
      {
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: richText('📊 AOAC链路同步信号') }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: richText(
            `同步ID: ${syncId}\n` +
            `日期: ${dateStr}\n` +
            `来源: github/aoac-readme-master\n` +
            `拉取自: README.md + data/aoac/master-report.json\n` +
            `变更摘要: ${(masterReport && masterReport.changes_summary) || '定时巡检'}\n` +
            `链路健康: ${(masterReport && masterReport.chain_health) || 'unknown'}\n` +
            `仓库状态: 工作流${(masterReport && masterReport.repo_status && masterReport.repo_status.total_workflows) || '?'}个 · 脚本${(masterReport && masterReport.repo_status && masterReport.repo_status.total_scripts) || '?'}个`
          )
        }
      }
    ]
  };

  try {
    const result = await notionRequest('POST', '/v1/pages', body, notionToken);
    console.log(`✅ Notion回执已写入: ${syncId}`);
    return { sent: true, sync_id: syncId, notion_page_id: result.id };
  } catch (err) {
    console.error('❌ Notion同步失败:', err.message);
    return { sent: false, reason: err.message };
  }
}

async function main() {
  console.log('📡 AOAC-06 · Notion同步信号 · 唤醒中...');
  console.log(`📅 ${getBeijingTime()}`);

  const now = new Date();
  const masterReport = readJSON(MASTER_REPORT_PATH);

  // Send to Notion
  const notionResult = await sendNotionSync(masterReport);

  // Write local sync log
  const syncLog = {
    aoac_agent: 'AOAC-06',
    aoac_agent_name: 'notion-sync-signal',
    timestamp: getBeijingTime(),
    timestamp_utc: now.toISOString(),
    master_report_id: masterReport ? masterReport.report_id : null,
    notion_sync: notionResult,
    changes_summary: masterReport ? masterReport.changes_summary : null,
    next_check: 'AOAC-07 (chain-repair) at 23:30 CST'
  };

  writeJSON(SYNC_LOG_PATH, syncLog);
  console.log(`📝 同步日志已保存: ${path.relative(ROOT, SYNC_LOG_PATH)}`);

  // Update chain status
  const chainStatus = readJSON(CHAIN_STATUS_PATH) || {};
  if (chainStatus.agents && chainStatus.agents['AOAC-06']) {
    chainStatus.agents['AOAC-06'].status = notionResult.sent ? 'completed' : 'warning';
    chainStatus.agents['AOAC-06'].last_run = now.toISOString();
    if (notionResult.sent) chainStatus.agents['AOAC-06'].last_success = now.toISOString();
  }
  writeJSON(CHAIN_STATUS_PATH, chainStatus);

  // Output for workflow
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `notion_sent=${notionResult.sent}\n`);
    fs.appendFileSync(outputFile, `sync_id=${notionResult.sync_id || 'none'}\n`);
  }

  console.log(notionResult.sent
    ? '📡 AOAC-06 · Notion同步完成 · 等待Notion侧确认'
    : '⚠️ AOAC-06 · Notion同步跳过/失败 · 本地日志已保存');
}

main();
