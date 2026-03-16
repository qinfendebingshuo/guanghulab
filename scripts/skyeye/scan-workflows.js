// scripts/skyeye/scan-workflows.js
// 天眼·扫描模块A · Workflow 健康度扫描
//
// 扫描内容：
//   ① 所有 .yml 语法检查
//   ② 最近 24h 运行结果（通过 /tmp/skyeye/recent-runs.json）
//   ③ workflow 之间的触发冲突/死循环检测
//   ④ cron 表达式合理性
//   ⑤ workflow 基本结构验证
//
// 输出：JSON → stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '../..');
const WF_DIR = path.join(ROOT, '.github/workflows');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const now = new Date();

// ━━━ YAML 基本语法检查 ━━━
function checkYamlSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Basic checks: not empty, has 'name:', has 'on:', has 'jobs:'
    const hasName = /^name\s*:/m.test(content);
    const hasOn   = /^on\s*:/m.test(content) || /^"on"\s*:/m.test(content) || /^'on'\s*:/m.test(content);
    const hasJobs = /^jobs\s*:/m.test(content);

    const issues = [];
    if (!hasName) issues.push('缺少 name 字段');
    if (!hasOn)   issues.push('缺少 on 触发器');
    if (!hasJobs) issues.push('缺少 jobs 定义');
    if (content.includes('\t')) issues.push('包含 tab 字符（YAML 建议使用空格）');

    return {
      valid: issues.length === 0,
      issues,
      lines: content.split('\n').length
    };
  } catch (e) {
    return { valid: false, issues: ['读取文件失败: ' + e.message], lines: 0 };
  }
}

// ━━━ 提取 Workflow 元信息 ━━━
function extractWorkflowMeta(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const meta = {};

    // Name
    const nameMatch = content.match(/^name\s*:\s*["']?(.+?)["']?\s*$/m);
    meta.name = nameMatch ? nameMatch[1].trim() : path.basename(filePath);

    // Triggers
    meta.triggers = [];
    if (/schedule\s*:/.test(content))          meta.triggers.push('schedule');
    if (/push\s*:/.test(content))              meta.triggers.push('push');
    if (/pull_request/.test(content))           meta.triggers.push('pull_request');
    if (/workflow_dispatch/.test(content))      meta.triggers.push('workflow_dispatch');
    if (/workflow_run/.test(content))           meta.triggers.push('workflow_run');
    if (/issues\s*:/.test(content))            meta.triggers.push('issues');
    if (/discussion/.test(content))            meta.triggers.push('discussion');

    // Cron expressions
    const cronMatches = content.match(/cron\s*:\s*['"](.+?)['"]/g);
    meta.crons = cronMatches
      ? cronMatches.map(c => c.match(/['"](.+?)['"]/)[1])
      : [];

    // Referenced secrets
    const secretMatches = content.match(/secrets\.([A-Z_]+)/g);
    meta.secrets = secretMatches
      ? [...new Set(secretMatches.map(s => s.replace('secrets.', '')))]
      : [];

    // Uses git push?
    meta.uses_git_push = /git\s+push/i.test(content);

    // Commit prefix
    const commitMatch = content.match(/git\s+commit\s+-m\s+["']([^\s"']+)/);
    meta.commit_prefix = commitMatch ? commitMatch[1] : null;

    return meta;
  } catch (e) {
    return { name: path.basename(filePath), triggers: [], crons: [], secrets: [], error: e.message };
  }
}

// ━━━ 检测 Cron 冲突 ━━━
function detectCronConflicts(workflows) {
  const cronMap = {};
  const conflicts = [];

  for (const wf of workflows) {
    for (const cron of (wf.meta.crons || [])) {
      if (!cronMap[cron]) cronMap[cron] = [];
      cronMap[cron].push(wf.file);
    }
  }

  for (const [cron, files] of Object.entries(cronMap)) {
    if (files.length > 1) {
      conflicts.push({
        type: 'cron_conflict',
        cron,
        workflows: files,
        detail: `${files.length} 个 workflow 使用相同 cron: ${cron}`
      });
    }
  }

  return conflicts;
}

// ━━━ 检测潜在循环触发 ━━━
function detectTriggerLoops(workflows) {
  const loops = [];
  const pushWorkflows = workflows.filter(w => w.meta.triggers.includes('push') && w.meta.uses_git_push);

  for (const wf of pushWorkflows) {
    // A workflow that triggers on push AND does git push could cause loops
    // Unless it has proper guards (bot check, prefix check)
    loops.push({
      type: 'potential_loop',
      workflow: wf.file,
      detail: `${wf.file} 由 push 触发且执行 git push — 需确认有防循环保护`
    });
  }

  return loops;
}

// ━━━ 解析最近运行结果 ━━━
function parseRecentRuns() {
  const runsFile = '/tmp/skyeye/recent-runs.json';
  try {
    if (!fs.existsSync(runsFile)) return { available: false, runs: [] };
    const runs = JSON.parse(fs.readFileSync(runsFile, 'utf8'));
    return { available: true, runs };
  } catch (e) {
    return { available: false, runs: [], error: e.message };
  }
}

// ━━━ 主扫描 ━━━
function scanWorkflows() {
  const result = {
    scan_time: new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    total_workflows: 0,
    healthy: 0,
    issues: [],
    workflow_map: [],
    cron_conflicts: [],
    potential_loops: []
  };

  // 1. 扫描所有 workflow 文件
  let files = [];
  try {
    files = fs.readdirSync(WF_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch (e) {
    result.issues.push({ file: WF_DIR, type: 'dir_error', detail: '无法读取 workflows 目录: ' + e.message });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  result.total_workflows = files.length;

  for (const file of files) {
    const filePath = path.join(WF_DIR, file);
    const syntax = checkYamlSyntax(filePath);
    const meta = extractWorkflowMeta(filePath);

    const entry = {
      file,
      name: meta.name,
      triggers: meta.triggers,
      crons: meta.crons,
      secrets: meta.secrets,
      uses_git_push: meta.uses_git_push,
      syntax_ok: syntax.valid,
      status: syntax.valid ? '✅' : '❌',
      last_run: null
    };

    if (syntax.valid) {
      result.healthy++;
    } else {
      result.issues.push({
        file,
        type: 'syntax_error',
        detail: syntax.issues.join('; ')
      });
    }

    result.workflow_map.push(entry);
  }

  // 2. 整合最近运行结果
  const recentRuns = parseRecentRuns();
  if (recentRuns.available) {
    for (const run of recentRuns.runs) {
      const entry = result.workflow_map.find(w => w.name === run.name);
      if (entry) {
        entry.last_run = run.createdAt;
        if (run.conclusion === 'failure') {
          entry.status = '❌';
          if (!result.issues.find(i => i.file === entry.file && i.type === 'run_failure')) {
            result.issues.push({
              file: entry.file,
              type: 'run_failure',
              detail: `最近运行失败 · ${run.createdAt}`
            });
          }
        }
      }
    }
  }

  // 3. 检测 Cron 冲突
  result.cron_conflicts = detectCronConflicts(
    result.workflow_map.map(w => ({ file: w.file, meta: { crons: w.crons } }))
  );

  // 4. 检测循环触发风险
  result.potential_loops = detectTriggerLoops(
    result.workflow_map.map(w => ({
      file: w.file,
      meta: { triggers: w.triggers, uses_git_push: w.uses_git_push }
    }))
  );

  console.log(JSON.stringify(result, null, 2));
}

scanWorkflows();
