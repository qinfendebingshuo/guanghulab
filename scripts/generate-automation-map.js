// scripts/generate-automation-map.js
// 铸渊自动化地图生成器 · Automation Map Generator
//
// 功能：
//   1. 扫描所有 GitHub workflows
//   2. 扫描所有执行脚本
//   3. 生成 brain/automation-map.json
//
// 触发方式：
//   - GitHub Actions: daily-maintenance-agent.yml
//   - 本地：node scripts/generate-automation-map.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const WF_DIR      = path.join(ROOT, '.github/workflows');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const BRAIN_DIR   = path.join(ROOT, 'brain');
const OUTPUT_PATH = path.join(BRAIN_DIR, 'automation-map.json');

const now    = new Date();
const nowISO = now.toISOString();

// ── 工具函数 ────────────────────────────────────────────────────────────────

function listFiles(dir, ext) {
  try {
    return fs.readdirSync(dir)
      .filter(f => !ext || f.endsWith(ext))
      .filter(f => !f.startsWith('.'));
  } catch { return []; }
}

// ── 工作流解析 ──────────────────────────────────────────────────────────────

function parseWorkflow(file) {
  const filePath = path.join(WF_DIR, file);
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { file, name: file, triggers: ['unknown'], status: 'error' };
  }

  const nameMatch  = content.match(/^name:\s*(.+)/m);
  const schedMatch = content.match(/cron:\s*['"]?([^'"#\n]+)/);
  const triggers   = [];

  // Parse triggers
  const onInline = content.match(/^on:\s*\[([^\]]+)\]/m);
  if (onInline) {
    triggers.push(...onInline[1].split(',').map(s => s.trim()));
  } else {
    if (/^\s{2,4}push:/m.test(content))             triggers.push('push');
    if (/^\s{2,4}pull_request:/m.test(content))     triggers.push('pull_request');
    if (/^\s{2,4}issues:/m.test(content))           triggers.push('issues');
    if (/^\s{2,4}issue_comment:/m.test(content))    triggers.push('issue_comment');
    if (/^\s{2,4}repository_dispatch:/m.test(content)) triggers.push('repository_dispatch');
  }

  if (schedMatch) triggers.push(`schedule(${schedMatch[1].trim()})`);
  if (content.includes('workflow_dispatch')) triggers.push('manual');

  // Detect referenced scripts
  const scriptRefs = [];
  const scriptMatches = content.matchAll(/node\s+scripts\/([^\s"']+)/g);
  for (const m of scriptMatches) {
    scriptRefs.push(`scripts/${m[1]}`);
  }

  return {
    file,
    name:       nameMatch ? nameMatch[1].trim() : file,
    triggers:   triggers.length ? triggers : ['unknown'],
    scripts:    scriptRefs,
    status:     'active'
  };
}

// ── 脚本解析 ────────────────────────────────────────────────────────────────

function parseScript(file) {
  const filePath = path.join(SCRIPTS_DIR, file);
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return { file, description: '', type: 'unknown' };
  }

  // Extract description from first comment lines
  const descMatch = content.match(/\/\/\s*(.+)/);
  const description = descMatch ? descMatch[1].trim() : '';

  // Detect type
  let type = 'utility';
  if (file.includes('deploy'))    type = 'deployment';
  if (file.includes('inspect') || file.includes('check') || file.includes('diagnose'))
    type = 'inspection';
  if (file.includes('sync') || file.includes('bridge'))  type = 'sync';
  if (file.includes('syslog') || file.includes('receive')) type = 'data-processing';
  if (file.includes('notify') || file.includes('alert'))   type = 'notification';
  if (file.includes('brain') || file.includes('memory') || file.includes('persona'))
    type = 'brain-operation';
  if (file.includes('generate') || file.includes('repo-map')) type = 'generator';
  if (file.includes('broadcast')) type = 'broadcast';
  if (file.includes('notion'))   type = 'notion-integration';

  return {
    file: `scripts/${file}`,
    description,
    type
  };
}

// ── 主生成逻辑 ──────────────────────────────────────────────────────────────

function generate() {
  // Ensure output directory exists
  if (!fs.existsSync(BRAIN_DIR)) {
    fs.mkdirSync(BRAIN_DIR, { recursive: true });
  }

  const workflows = listFiles(WF_DIR, '.yml').map(parseWorkflow);
  const scripts   = listFiles(SCRIPTS_DIR, '.js').map(parseScript);

  // Categorize workflows
  const scheduled  = workflows.filter(w => w.triggers.some(t => t.startsWith('schedule')));
  const onPush     = workflows.filter(w => w.triggers.includes('push'));
  const manual     = workflows.filter(w => w.triggers.includes('manual'));
  const eventBased = workflows.filter(w =>
    w.triggers.some(t => ['issues', 'issue_comment', 'repository_dispatch'].includes(t))
  );

  const automationMap = {
    description:  '铸渊自动化地图 · Automation Map',
    version:      '4.0',
    generated_at: nowISO,
    generated_by: 'scripts/generate-automation-map.js',
    stats: {
      total_workflows:   workflows.length,
      total_scripts:     scripts.length,
      scheduled_tasks:   scheduled.length,
      push_triggers:     onPush.length,
      manual_triggers:   manual.length,
      event_triggers:    eventBased.length
    },
    workflows,
    scripts,
    categories: {
      scheduled:   scheduled.map(w => w.file),
      on_push:     onPush.map(w => w.file),
      manual:      manual.map(w => w.file),
      event_based: eventBased.map(w => w.file)
    }
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(automationMap, null, 2));
  console.log(`✅ automation-map.json 已生成 · ${workflows.length} 个工作流 · ${scripts.length} 个脚本`);
  return automationMap;
}

generate();
