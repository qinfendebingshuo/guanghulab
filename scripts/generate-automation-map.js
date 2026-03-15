// scripts/generate-automation-map.js
// 自动化地图生成器 · Automation Map Generator
//
// 功能：扫描 .github/workflows/ 和自动化脚本，生成 brain/automation-map.json
// 触发方式：
//   - GitHub Actions: daily-maintenance.yml
//   - 本地：node scripts/generate-automation-map.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, 'brain');
const OUT_PATH  = path.join(BRAIN_DIR, 'automation-map.json');

const now    = new Date();
const nowISO = now.toISOString();

// ── 工具函数 ──

function safeRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function listFiles(dirPath, ext) {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => !ext || f.endsWith(ext))
      .filter(f => !f.startsWith('.'));
  } catch { return []; }
}

// ── 解析单个 workflow ──

function parseWorkflow(file, content) {
  const nameMatch = content.match(/^name:\s*(.+)/m);
  const name = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : file;

  const triggers = [];
  if (/^\s{2,4}push:/m.test(content)) triggers.push('push');
  if (/^\s{2,4}pull_request:/m.test(content)) triggers.push('pull_request');
  if (/^\s{2,4}issues:/m.test(content)) triggers.push('issues');
  if (/^\s{2,4}issue_comment:/m.test(content)) triggers.push('issue_comment');
  if (/workflow_dispatch/m.test(content)) triggers.push('workflow_dispatch');
  if (/workflow_call/m.test(content)) triggers.push('workflow_call');

  const cronMatch = content.match(/cron:\s*['"]?([^'"#\n]+)/);
  const cron = cronMatch ? cronMatch[1].trim() : null;
  if (cron) triggers.push('schedule');

  // Detect scripts used
  const scriptRefs = [];
  const scriptMatches = content.matchAll(/node\s+scripts\/([^\s'"]+)/g);
  for (const m of scriptMatches) {
    scriptRefs.push('scripts/' + m[1]);
  }

  const result = {
    file,
    name,
    triggers: triggers.length ? triggers : ['unknown']
  };

  if (cron) result.cron = cron;
  if (scriptRefs.length) result.scripts = scriptRefs;

  return result;
}

// ── 扫描所有 workflow ──

function scanWorkflows() {
  const wfDir = path.join(ROOT, '.github/workflows');
  const files = listFiles(wfDir, '.yml');
  return files.map(f => {
    const content = safeRead(path.join(wfDir, f));
    return parseWorkflow(f, content);
  });
}

// ── 提取 cron jobs ──

function extractCronJobs(workflows) {
  return workflows
    .filter(w => w.cron)
    .map(w => ({
      cron: w.cron,
      workflow: w.file,
      name: w.name
    }))
    .sort((a, b) => a.cron.localeCompare(b.cron));
}

// ── 扫描部署脚本 ──

function scanDeployScripts(workflows) {
  return workflows
    .filter(w => /deploy/i.test(w.file) || /deploy/i.test(w.name))
    .map(w => ({
      workflow: w.file,
      name: w.name,
      triggers: w.triggers
    }));
}

// ── 扫描同步脚本 ──

function scanSyncScripts() {
  const scriptDir = path.join(ROOT, 'scripts');
  const files = listFiles(scriptDir, '.js');
  const syncScripts = [];

  for (const file of files) {
    const content = safeRead(path.join(scriptDir, file));
    if (/sync|bridge|push-broadcast|receive|process-broadcast/i.test(file) ||
        /notion.*api|@notionhq/i.test(content)) {
      syncScripts.push({
        script: 'scripts/' + file,
        type: /sync/i.test(file) ? 'sync' :
              /bridge/i.test(file) ? 'bridge' :
              /broadcast/i.test(file) ? 'broadcast' : 'other'
      });
    }
  }

  return syncScripts;
}

// ── 主生成 ──

function generate() {
  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

  const workflows = scanWorkflows();
  const cronJobs = extractCronJobs(workflows);
  const deployScripts = scanDeployScripts(workflows);
  const syncScripts = scanSyncScripts();

  const map = {
    version: '4.0',
    generated_at: nowISO,
    generated_by: 'scripts/generate-automation-map.js',
    description: '数字地球系统自动化地图 · 所有工作流与自动化脚本',
    workflows,
    cron_jobs: cronJobs,
    deploy_scripts: deployScripts,
    data_sync_scripts: syncScripts,
    status: 'stable'
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(map, null, 2));
  console.log(`✅ automation-map.json 已生成 · ${workflows.length} 个工作流 · ${cronJobs.length} 个定时任务`);
}

generate();
