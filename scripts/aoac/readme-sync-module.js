#!/usr/bin/env node
'use strict';

/**
 * AOAC-04 · 首页同步模块 (README Sync Module)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 半Agent（事件唤醒）
 * 
 * 唤醒条件：data/aoac/readme-sync-trigger.json 被写入
 * 职责：解析链路报告→提取进度变更→准备README更新数据
 * 输出：data/aoac/readme-update-payload.json
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CHAIN_REPORT_PATH = path.join(ROOT, 'data', 'aoac', 'chain-report.json');
const TRIGGER_PATH = path.join(ROOT, 'data', 'aoac', 'readme-sync-trigger.json');
const PAYLOAD_PATH = path.join(ROOT, 'data', 'aoac', 'readme-update-payload.json');
const CHAIN_STATUS_PATH = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

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

function extractReadmeUpdates(chainReport) {
  if (!chainReport) return null;

  const updates = {
    aoac_section: '',
    progress_entries: [],
    status_badge: '🟢'
  };

  // Build AOAC status line
  const dev = chainReport.development || {};
  const ci = chainReport.ci_result || {};

  const ciBadge = ci.overall === 'success' ? '✅' :
    ci.overall === 'failure' ? '❌' : '⚠️';

  updates.status_badge = ciBadge;
  updates.aoac_section = [
    `| ${chainReport.report_id || 'N/A'} | PR #${dev.pr_number || '?'} | ${(dev.pr_title || '').slice(0, 50)} | ${dev.files_changed || 0}文件 +${dev.additions || 0}/-${dev.deletions || 0} | ${ciBadge} ${ci.overall || 'unknown'} | ${chainReport.timestamp || ''} |`
  ].join('\n');

  // Progress entry for consciousness chain
  if (dev.pr_title) {
    updates.progress_entries.push({
      type: 'dev_merge',
      title: dev.pr_title,
      result: ci.overall,
      timestamp: chainReport.timestamp
    });
  }

  return updates;
}

function main() {
  console.log('📋 AOAC-04 · 首页同步模块 · 唤醒中...');
  console.log(`📅 ${getBeijingTime()}`);

  // Check trigger
  const trigger = readJSON(TRIGGER_PATH);
  if (!trigger) {
    console.log('⚠️ 无触发信号，跳过');
    return;
  }
  console.log(`📡 收到触发信号: ${trigger.trigger_id}`);

  // Read chain report
  const chainReport = readJSON(CHAIN_REPORT_PATH);
  if (!chainReport) {
    console.log('⚠️ 链路报告不存在，跳过');
    return;
  }

  // Extract README updates
  const updates = extractReadmeUpdates(chainReport);
  
  const now = new Date();
  const payload = {
    aoac_agent: 'AOAC-04',
    aoac_agent_name: 'readme-sync-module',
    payload_id: `AOAC-PAYLOAD-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    timestamp: getBeijingTime(),
    timestamp_utc: now.toISOString(),
    source_report: chainReport.report_id,
    updates,
    changes_summary: chainReport.changes_summary,
    trigger_master: true,
    next_agent: 'AOAC-05 (readme-master-agent)'
  };

  writeJSON(PAYLOAD_PATH, payload);
  console.log(`✅ README更新数据已准备: ${payload.payload_id}`);
  console.log(`   ${chainReport.changes_summary}`);

  // Update chain status
  const chainStatus = readJSON(CHAIN_STATUS_PATH) || {};
  if (chainStatus.agents && chainStatus.agents['AOAC-04']) {
    chainStatus.agents['AOAC-04'].status = 'completed';
    chainStatus.agents['AOAC-04'].last_run = now.toISOString();
    chainStatus.agents['AOAC-04'].last_success = now.toISOString();
  }
  writeJSON(CHAIN_STATUS_PATH, chainStatus);

  console.log('📋 AOAC-04 · 半Agent完成 · 触发AOAC-05主控');
}

main();
