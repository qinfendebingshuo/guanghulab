#!/usr/bin/env node
'use strict';

/**
 * AOAC-02 · 合并哨兵 (Action Merge Sentinel)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 半Agent（CI侧）
 * 
 * 唤醒条件：PR合并到main
 * 职责：收集CI日志（通过/失败/报错/警告）
 * 输出：data/aoac/merge-result-log.json
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'aoac', 'merge-result-log.json');
const CHAIN_STATUS_PATH = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
const REPO = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
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

function githubRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.github.com${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'AOAC-Merge-Sentinel/1.0',
        'Accept': 'application/vnd.github.v3+json',
        ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function collectMergeInfo() {
  const prNumber = process.env.PR_NUMBER;
  const prTitle = process.env.PR_TITLE || '';
  const mergeCommitSha = process.env.MERGE_COMMIT_SHA || '';
  const headSha = process.env.HEAD_SHA || '';
  const baseBranch = process.env.BASE_BRANCH || 'main';

  let checkRuns = [];
  let ciSummary = { total: 0, passed: 0, failed: 0, skipped: 0 };

  // Collect check runs for the merge commit
  if (mergeCommitSha && GITHUB_TOKEN) {
    try {
      const checks = await githubRequest(`/repos/${REPO}/commits/${mergeCommitSha}/check-runs?per_page=100`);
      if (checks && checks.check_runs) {
        checkRuns = checks.check_runs.map(cr => ({
          name: cr.name,
          status: cr.status,
          conclusion: cr.conclusion,
          started_at: cr.started_at,
          completed_at: cr.completed_at,
          output_title: cr.output ? cr.output.title : null,
          output_summary: cr.output ? (cr.output.summary || '').slice(0, 200) : null
        }));
        ciSummary = {
          total: checkRuns.length,
          passed: checkRuns.filter(c => c.conclusion === 'success').length,
          failed: checkRuns.filter(c => c.conclusion === 'failure').length,
          skipped: checkRuns.filter(c => c.conclusion === 'skipped' || c.conclusion === 'cancelled').length
        };
      }
    } catch (err) {
      console.error('⚠️ 获取CI检查结果失败:', err.message);
    }
  }

  // Collect combined status
  let combinedStatus = 'unknown';
  if (mergeCommitSha && GITHUB_TOKEN) {
    try {
      const status = await githubRequest(`/repos/${REPO}/commits/${mergeCommitSha}/status`);
      if (status && status.state) {
        combinedStatus = status.state;
      }
    } catch (err) {
      console.error('⚠️ 获取合并状态失败:', err.message);
    }
  }

  // Determine overall result
  const overallResult = ciSummary.failed > 0 ? 'failure' :
    ciSummary.passed === ciSummary.total && ciSummary.total > 0 ? 'success' :
    combinedStatus !== 'unknown' ? combinedStatus : 'no_checks';

  return {
    aoac_agent: 'AOAC-02',
    aoac_agent_name: 'action-merge-sentinel',
    status: 'half_ready',
    timestamp: getBeijingTime(),
    timestamp_utc: new Date().toISOString(),
    merge: {
      pr_number: prNumber ? parseInt(prNumber) : null,
      pr_title: prTitle.slice(0, 200),
      merge_commit_sha: mergeCommitSha,
      head_sha: headSha,
      base_branch: baseBranch
    },
    ci: {
      combined_status: combinedStatus,
      overall_result: overallResult,
      summary: ciSummary,
      check_runs: checkRuns.slice(0, 30)
    },
    ready_for_fusion: true,
    next_agent: 'AOAC-03 (chain-fusion)'
  };
}

async function main() {
  console.log('🔍 AOAC-02 · 合并哨兵 · 唤醒中...');
  console.log(`📅 ${getBeijingTime()}`);

  try {
    const mergeLog = await collectMergeInfo();

    writeJSON(OUTPUT_PATH, mergeLog);
    console.log(`✅ 合并结果已写入: ${path.relative(ROOT, OUTPUT_PATH)}`);
    console.log(`   PR #${mergeLog.merge.pr_number}: ${mergeLog.merge.pr_title}`);
    console.log(`   CI结果: ${mergeLog.ci.overall_result}`);
    console.log(`   ✅${mergeLog.ci.summary.passed} ❌${mergeLog.ci.summary.failed} ⏭${mergeLog.ci.summary.skipped}`);

    // Update chain status
    const chainStatus = readJSON(CHAIN_STATUS_PATH) || {};
    if (chainStatus.agents && chainStatus.agents['AOAC-02']) {
      chainStatus.agents['AOAC-02'].status = 'half_ready';
      chainStatus.agents['AOAC-02'].last_run = new Date().toISOString();
      writeJSON(CHAIN_STATUS_PATH, chainStatus);
    }

    // Output for workflow
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, `ci_result=${mergeLog.ci.overall_result}\n`);
      fs.appendFileSync(outputFile, `ready_for_fusion=true\n`);
    }

    console.log('🔍 AOAC-02 · 半Agent就绪 · 准备触发AOAC-03合体');
  } catch (err) {
    console.error('❌ AOAC-02 执行失败:', err.message);
    process.exitCode = 1;
  }
}

main();
