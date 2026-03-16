// scripts/skyeye/diagnose.js
// 天眼·诊断引擎
//
// 输入：/tmp/skyeye/ 下所有扫描结果
// 输出：诊断报告 JSON → stdout
//
// 关键逻辑：
//   汇总异常 → 根因分析 → 检测因果关系 → 生成修复计划
//   诊断要找根因，不要只看症状

'use strict';

const fs   = require('fs');
const path = require('path');

const SKYEYE_DIR = '/tmp/skyeye';

// ━━━ 安全读取 JSON ━━━
function readScanResult(filename) {
  const filePath = path.join(SKYEYE_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`⚠️ 无法读取 ${filename}: ${e.message}`);
    return null;
  }
}

// ━━━ 问题分类器 ━━━
function classifyIssue(symptom, source) {
  // 根据症状判断可修复性和优先级
  const autoFixablePatterns = [
    { pattern: /routing.?map.*不一致|未映射/i, fix: 'update_routing_map', priority: 'P1' },
    { pattern: /dev.?status.*过期|超过.*24h/i, fix: 'trigger_sync', priority: 'P1' },
    { pattern: /memory.*过期|超过.*24h/i, fix: 'update_memory', priority: 'P1' },
    { pattern: /workflow.*失败|run_failure/i, fix: 'retry_workflow', priority: 'P1' },
    { pattern: /目录.*缺失|不存在/i, fix: 'create_directory', priority: 'P1' },
    { pattern: /孤儿文件/i, fix: 'log_orphans', priority: 'P2' },
    { pattern: /README.*marker|标记.*缺失/i, fix: 'repair_readme', priority: 'P1' },
    { pattern: /knowledge.?base.*重复/i, fix: 'deduplicate_kb', priority: 'P2' },
    { pattern: /copilot.*instructions.*空|不存在/i, fix: 'note_copilot', priority: 'P2' },
    { pattern: /syntax.*error|语法.*错误/i, fix: 'log_syntax_error', priority: 'P0' },
    { pattern: /cron.*conflict|冲突/i, fix: 'log_conflict', priority: 'P2' }
  ];

  const needsHumanPatterns = [
    { pattern: /Secret.*缺失|未设置|NOTION_TOKEN|SMTP|DEPLOY_KEY/i, reason: 'Secret 需管理员配置' },
    { pattern: /Notion.*API.*失败|权限/i, reason: 'Notion 集成需人工检查' },
    { pattern: /SSH.*不通|服务器.*连接/i, reason: '服务器访问需人工排查' },
    { pattern: /数据库.*结构/i, reason: 'Notion 数据库结构需人工修改' }
  ];

  // Check if auto-fixable
  for (const p of autoFixablePatterns) {
    if (p.pattern.test(symptom)) {
      return { fixable: true, fix_plan: p.fix, priority: p.priority };
    }
  }

  // Check if needs human
  for (const p of needsHumanPatterns) {
    if (p.pattern.test(symptom)) {
      return { fixable: false, fix_plan: 'needs_human', priority: 'P0', reason: p.reason };
    }
  }

  // Default: watch list
  return { fixable: false, fix_plan: 'watch', priority: 'P2' };
}

// ━━━ 根因分析 ━━━
function analyzeRootCause(issues) {
  // Group related issues and find root causes
  const rootCauses = new Map();

  for (const issue of issues) {
    // Check if this issue could be caused by another
    let rootCause = issue.symptom;

    // Missing secret → downstream API failures
    if (/API.*失败|连通.*失败/.test(issue.symptom)) {
      const secretIssue = issues.find(i => /Secret.*缺失/.test(i.symptom) && i.symptom.includes('NOTION'));
      if (secretIssue) {
        rootCause = 'Secret 缺失导致 API 连接失败';
        issue.root_cause = rootCause;
        issue.related_to = secretIssue.id;
      }
    }

    // dev-status stale could be caused by Notion API failure
    if (/dev.?status.*过期/.test(issue.symptom)) {
      const notionIssue = issues.find(i => /Notion.*API/.test(i.symptom));
      if (notionIssue) {
        rootCause = 'Notion API 不可用导致 dev-status 无法同步';
        issue.root_cause = rootCause;
        issue.related_to = notionIssue.id;
      }
    }
  }

  return issues;
}

// ━━━ 从扫描结果提取问题 ━━━
function extractIssues() {
  const issues = [];
  let issueCounter = 0;

  function addIssue(source, symptom, impact) {
    issueCounter++;
    const id = `SKYEYE-${String(issueCounter).padStart(3, '0')}`;
    const classification = classifyIssue(symptom, source);
    issues.push({
      id,
      source,
      symptom,
      root_cause: symptom, // Will be refined by analyzeRootCause
      impact: impact || '系统稳定性',
      ...classification
    });
  }

  // ── Workflow Health Issues ──
  const wfHealth = readScanResult('workflow-health.json');
  if (wfHealth) {
    for (const issue of (wfHealth.issues || [])) {
      addIssue('workflow', `${issue.file}: ${issue.detail}`, 'Workflow 功能异常');
    }
    for (const conflict of (wfHealth.cron_conflicts || [])) {
      addIssue('workflow', `Cron 冲突: ${conflict.detail}`, '定时任务时序冲突');
    }
  }

  // ── Structure Health Issues ──
  const structHealth = readScanResult('structure-health.json');
  if (structHealth) {
    for (const dir of (structHealth.missing_dirs || [])) {
      addIssue('structure', `目录缺失: ${dir}`, '仓库结构不完整');
    }
    if (structHealth.orphan_files > 0) {
      addIssue('structure', `发现 ${structHealth.orphan_files} 个孤儿文件`, '仓库整洁度');
    }
    if (structHealth.readme && !structHealth.readme_ok) {
      const missing = structHealth.readme.missing_markers || [];
      addIssue('structure', `README marker 缺失: ${missing.join(', ')}`, 'README 自动更新失败');
    }
  }

  // ── Brain Health Issues ──
  const brainHealth = readScanResult('brain-health.json');
  if (brainHealth) {
    if (brainHealth.memory && brainHealth.memory.status !== '✅') {
      for (const issue of (brainHealth.memory.issues || [])) {
        addIssue('brain', `memory.json: ${issue}`, '核心大脑数据过期');
      }
    }
    if (brainHealth.routing_map && brainHealth.routing_map.status !== '✅') {
      for (const issue of (brainHealth.routing_map.issues || [])) {
        addIssue('brain', `routing-map.json: ${issue}`, '路由映射不一致');
      }
    }
    if (brainHealth.dev_status && brainHealth.dev_status.status !== '✅') {
      for (const issue of (brainHealth.dev_status.issues || [])) {
        addIssue('brain', `dev-status.json: ${issue}`, '开发者状态数据过期');
      }
    }
    if (brainHealth.knowledge_base && brainHealth.knowledge_base.status !== '✅') {
      for (const issue of (brainHealth.knowledge_base.issues || [])) {
        addIssue('brain', `knowledge-base.json: ${issue}`, '知识库数据质量');
      }
    }
    if (brainHealth.copilot_instructions && brainHealth.copilot_instructions.status !== '✅') {
      addIssue('brain', 'copilot-instructions.md 不存在或为空', '代码助手指令缺失');
    }
  }

  // ── Bridge Health Issues ──
  const bridgeHealth = readScanResult('bridge-health.json');
  if (bridgeHealth) {
    if (bridgeHealth.notion_api && bridgeHealth.notion_api.status !== '🟢') {
      addIssue('bridge', `Notion API: ${bridgeHealth.notion_api.detail}`, '外部数据同步中断');
    }
    if (bridgeHealth.github_api && bridgeHealth.github_api.status !== '🟢') {
      addIssue('bridge', `GitHub API: ${bridgeHealth.github_api.detail}`, 'CI/CD 功能受限');
    }
    if (bridgeHealth.secrets && !bridgeHealth.secrets.complete) {
      const missing = bridgeHealth.secrets.missing || [];
      for (const secret of missing) {
        addIssue('bridge', `Secret 缺失: ${secret}`, '功能不可用');
      }
    }
  }

  return issues;
}

// ━━━ 主诊断 ━━━
function diagnose() {
  let issues = extractIssues();

  // 根因分析
  issues = analyzeRootCause(issues);

  // 统计
  const autoFixable = issues.filter(i => i.fixable).length;
  const needsHuman = issues.filter(i => !i.fixable && i.fix_plan === 'needs_human').length;
  const watchList = issues.filter(i => !i.fixable && i.fix_plan === 'watch').length;

  // 按优先级排序
  const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2 };
  issues.sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9));

  const result = {
    diagnosis_time: new Date(new Date().getTime() + 8 * 3600 * 1000)
      .toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    total_issues: issues.length,
    auto_fixable: autoFixable,
    needs_human: needsHuman,
    watch_list: watchList,
    issues
  };

  console.log(JSON.stringify(result, null, 2));
}

diagnose();
