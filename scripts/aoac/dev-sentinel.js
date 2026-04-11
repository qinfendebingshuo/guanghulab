#!/usr/bin/env node
'use strict';

/**
 * AOAC-01 · 副驾驶哨兵 (Copilot Dev Sentinel)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 半Agent（开发侧）
 * 
 * 唤醒条件：PR创建/更新时触发
 * 职责：记录Copilot开发过程——改了哪些文件、做了什么、PR描述
 * 输出：data/aoac/dev-session-log.json
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'aoac', 'dev-session-log.json');
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
        'User-Agent': 'AOAC-Dev-Sentinel/1.0',
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

async function collectPRInfo() {
  const prNumber = process.env.PR_NUMBER;
  const prTitle = process.env.PR_TITLE || '';
  const prBody = process.env.PR_BODY || '';
  const prAuthor = process.env.PR_AUTHOR || '';
  const prBranch = process.env.PR_BRANCH || '';
  const eventName = process.env.EVENT_NAME || 'pull_request';

  let filesChanged = [];
  let diffStats = { additions: 0, deletions: 0, changed_files: 0 };

  if (prNumber && GITHUB_TOKEN) {
    try {
      const files = await githubRequest(`/repos/${REPO}/pulls/${prNumber}/files?per_page=100`);
      if (Array.isArray(files)) {
        filesChanged = files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes
        }));
        diffStats = {
          additions: files.reduce((s, f) => s + (f.additions || 0), 0),
          deletions: files.reduce((s, f) => s + (f.deletions || 0), 0),
          changed_files: files.length
        };
      }
    } catch (err) {
      console.error('⚠️ 获取PR文件列表失败:', err.message);
    }
  }

  // Categorize changes
  const categories = {};
  for (const f of filesChanged) {
    let cat = 'other';
    if (f.filename.startsWith('.github/workflows/')) cat = 'workflow';
    else if (f.filename.startsWith('scripts/')) cat = 'script';
    else if (f.filename.startsWith('server/')) cat = 'server';
    else if (f.filename.startsWith('hldp/')) cat = 'hldp';
    else if (f.filename.startsWith('brain/')) cat = 'brain';
    else if (f.filename.startsWith('data/')) cat = 'data';
    else if (f.filename.startsWith('docs/') || f.filename.endsWith('.md')) cat = 'docs';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(f.filename);
  }

  return {
    aoac_agent: 'AOAC-01',
    aoac_agent_name: 'copilot-dev-sentinel',
    status: 'half_ready',
    timestamp: getBeijingTime(),
    timestamp_utc: new Date().toISOString(),
    event: eventName,
    pr: {
      number: prNumber ? parseInt(prNumber) : null,
      title: prTitle.slice(0, 200),
      body_summary: prBody.slice(0, 500),
      author: prAuthor,
      branch: prBranch
    },
    diff: diffStats,
    files_changed: filesChanged.slice(0, 50),
    categories,
    waiting_for: 'AOAC-02 (merge-sentinel)'
  };
}

async function main() {
  console.log('🔭 AOAC-01 · 副驾驶哨兵 · 唤醒中...');
  console.log(`📅 ${getBeijingTime()}`);

  try {
    const sessionLog = await collectPRInfo();

    writeJSON(OUTPUT_PATH, sessionLog);
    console.log(`✅ 开发日志已写入: ${path.relative(ROOT, OUTPUT_PATH)}`);
    console.log(`   PR #${sessionLog.pr.number}: ${sessionLog.pr.title}`);
    console.log(`   文件变更: ${sessionLog.diff.changed_files} 个文件`);
    console.log(`   +${sessionLog.diff.additions} -${sessionLog.diff.deletions}`);

    // Update chain status
    const chainStatus = readJSON(CHAIN_STATUS_PATH) || {};
    if (chainStatus.agents && chainStatus.agents['AOAC-01']) {
      chainStatus.agents['AOAC-01'].status = 'half_ready';
      chainStatus.agents['AOAC-01'].last_run = new Date().toISOString();
      writeJSON(CHAIN_STATUS_PATH, chainStatus);
    }

    console.log('🔭 AOAC-01 · 半Agent就绪 · 等待AOAC-02合体');
  } catch (err) {
    console.error('❌ AOAC-01 执行失败:', err.message);
    process.exitCode = 1;
  }
}

main();
