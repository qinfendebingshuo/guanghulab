#!/usr/bin/env node
'use strict';

/**
 * AOAC-03 · 合体引擎 (Chain Fusion Engine)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 全Agent（开发全链路感知）
 * 
 * 唤醒条件：AOAC-02完成（CI日志+开发日志双全）
 * 职责：合并两半日志→生成完整开发报告→写入触发信号
 * 输出：data/aoac/chain-report.json + data/aoac/readme-sync-trigger.json
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEV_LOG_PATH = path.join(ROOT, 'data', 'aoac', 'dev-session-log.json');
const MERGE_LOG_PATH = path.join(ROOT, 'data', 'aoac', 'merge-result-log.json');
const CHAIN_REPORT_PATH = path.join(ROOT, 'data', 'aoac', 'chain-report.json');
const TRIGGER_PATH = path.join(ROOT, 'data', 'aoac', 'readme-sync-trigger.json');
const CHAIN_STATUS_PATH = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
const HISTORY_DIR = path.join(ROOT, 'data', 'aoac', 'history');
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

function getBeijingTime() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().replace('T', ' ').slice(0, 19) + '+08:00';
}

function getDateStr() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().slice(0, 10);
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

function generateChangeSummary(devLog, mergeLog) {
  const parts = [];
  
  if (devLog && devLog.pr) {
    parts.push(`PR #${devLog.pr.number}: ${devLog.pr.title}`);
  }
  
  if (devLog && devLog.diff) {
    parts.push(`${devLog.diff.changed_files}个文件 (+${devLog.diff.additions} -${devLog.diff.deletions})`);
  }

  if (devLog && devLog.categories) {
    const cats = Object.keys(devLog.categories);
    if (cats.length > 0) {
      parts.push(`涉及: ${cats.join(', ')}`);
    }
  }

  if (mergeLog && mergeLog.ci) {
    parts.push(`CI: ${mergeLog.ci.overall_result} (✅${mergeLog.ci.summary.passed} ❌${mergeLog.ci.summary.failed})`);
  }

  return parts.join(' · ');
}

function main() {
  console.log('⚡ AOAC-03 · 合体引擎 · 唤醒中...');
  console.log(`📅 ${getBeijingTime()}`);

  const devLog = readJSON(DEV_LOG_PATH);
  const mergeLog = readJSON(MERGE_LOG_PATH);

  if (!devLog && !mergeLog) {
    console.log('⚠️ 开发日志和合并日志都不存在，生成空报告');
  }

  const now = new Date();
  const dateStr = getDateStr();
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const reportId = `AOAC-CHAIN-${dateStr.replace(/-/g, '')}-${seq}`;

  // Fuse the two halves
  const chainReport = {
    aoac_agent: 'AOAC-03',
    aoac_agent_name: 'dev-chain-agent',
    report_id: reportId,
    status: 'complete',
    timestamp: getBeijingTime(),
    timestamp_utc: now.toISOString(),
    fusion: {
      dev_sentinel: devLog ? 'present' : 'missing',
      merge_sentinel: mergeLog ? 'present' : 'missing',
      fusion_quality: devLog && mergeLog ? 'full' : 'partial'
    },
    development: {
      pr_number: (devLog && devLog.pr && devLog.pr.number) || (mergeLog && mergeLog.merge && mergeLog.merge.pr_number) || null,
      pr_title: (devLog && devLog.pr && devLog.pr.title) || (mergeLog && mergeLog.merge && mergeLog.merge.pr_title) || 'unknown',
      author: (devLog && devLog.pr && devLog.pr.author) || '',
      branch: (devLog && devLog.pr && devLog.pr.branch) || '',
      files_changed: (devLog && devLog.diff && devLog.diff.changed_files) || 0,
      additions: (devLog && devLog.diff && devLog.diff.additions) || 0,
      deletions: (devLog && devLog.diff && devLog.diff.deletions) || 0,
      categories: (devLog && devLog.categories) || {}
    },
    ci_result: {
      overall: (mergeLog && mergeLog.ci && mergeLog.ci.overall_result) || 'unknown',
      passed: (mergeLog && mergeLog.ci && mergeLog.ci.summary && mergeLog.ci.summary.passed) || 0,
      failed: (mergeLog && mergeLog.ci && mergeLog.ci.summary && mergeLog.ci.summary.failed) || 0,
      merge_commit: (mergeLog && mergeLog.merge && mergeLog.merge.merge_commit_sha) || ''
    },
    changes_summary: generateChangeSummary(devLog, mergeLog),
    triggered_by: 'AOAC-02',
    triggers_next: 'AOAC-04 (readme-sync-module)'
  };

  // Write chain report
  writeJSON(CHAIN_REPORT_PATH, chainReport);
  console.log(`✅ 链路报告已生成: ${reportId}`);
  console.log(`   ${chainReport.changes_summary}`);

  // Write trigger signal for AOAC-04
  const trigger = {
    trigger_id: `AOAC-TRIGGER-${dateStr.replace(/-/g, '')}-${seq}`,
    source: 'AOAC-03',
    target: 'AOAC-04',
    chain_report_id: reportId,
    timestamp: now.toISOString(),
    action: 'readme_sync'
  };
  writeJSON(TRIGGER_PATH, trigger);
  console.log('📡 触发信号已发送 → AOAC-04');

  // Archive to history
  const historyDir = path.join(HISTORY_DIR, dateStr);
  fs.mkdirSync(historyDir, { recursive: true });
  writeJSON(path.join(historyDir, `${reportId}.json`), chainReport);

  // Update chain status
  const chainStatus = readJSON(CHAIN_STATUS_PATH) || {};
  if (chainStatus.agents) {
    if (chainStatus.agents['AOAC-03']) {
      chainStatus.agents['AOAC-03'].status = 'completed';
      chainStatus.agents['AOAC-03'].last_run = now.toISOString();
      chainStatus.agents['AOAC-03'].last_success = now.toISOString();
    }
    chainStatus.chain_health = chainReport.ci_result.overall === 'success' ? 'healthy' : 'warning';
  }
  writeJSON(CHAIN_STATUS_PATH, chainStatus);

  console.log('⚡ AOAC-03 · 合体完成 · 链路报告已归档');
}

main();
