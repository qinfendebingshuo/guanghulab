// scripts/neural/generate-daily-digest.js
// 🧬 双端神经系统 · 每日汇总引擎
// 收集全仓库当日所有数据 → 生成标准化日报 JSON
// 这个日报是 Notion 天眼大脑的「眼睛」

const fs = require('fs');
const path = require('path');
const DIGEST_DIR = '/tmp/neural-digest';
const CRITICAL_FAILURE_RATE_THRESHOLD = 20; // percentage - matches neural-analysis-rules.json P0 threshold

function loadJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function generateDigest() {
  const now = new Date();
  const cstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const workflowSummary = loadJSON(path.join(DIGEST_DIR, 'workflow-summary.json'));
  const workflowReports = loadJSON(path.join(DIGEST_DIR, 'workflow-reports.json'));
  const skyeyeLatest = loadJSON(path.join(DIGEST_DIR, 'skyeye-latest.json'));
  const guardStatus = loadJSON(path.join(DIGEST_DIR, 'guard-status.json'));
  const quotaStatus = loadJSON(path.join(DIGEST_DIR, 'quota-status.json'));
  const neuralMap = loadJSON('skyeye/neural-map.json');

  // ━━━ 按上级大脑分组统计 ━━━
  const brainSummary = {};
  if (neuralMap && neuralMap.github_workflows) {
    for (const [wfId, wf] of Object.entries(neuralMap.github_workflows)) {
      const brain = wf.brain;
      if (!brainSummary[brain]) {
        brainSummary[brain] = {
          name: (neuralMap.notion_brains[brain] || {}).name || brain,
          total_workflows: 0, healthy: 0, failed: 0, no_data: 0, workflows: []
        };
      }
      brainSummary[brain].total_workflows++;
      const wfRun = workflowSummary && workflowSummary.by_workflow ? workflowSummary.by_workflow[wf.name] : null;
      const status = wfRun ? (wfRun.failure > 0 ? '❌' : '✅') : '⚠️';
      if (status === '✅') brainSummary[brain].healthy++;
      else if (status === '❌') brainSummary[brain].failed++;
      else brainSummary[brain].no_data++;
      brainSummary[brain].workflows.push({
        id: wfId, name: wf.name, status,
        runs: wfRun ? wfRun.runs : 0,
        successes: wfRun ? wfRun.success : 0,
        failures: wfRun ? wfRun.failure : 0
      });
    }
  }

  // ━━━ 整体健康度 ━━━
  const totalWorkflows = workflowSummary ? (workflowSummary.total || 0) : 0;
  const totalFailures = workflowSummary ? (workflowSummary.failure || 0) : 0;
  const failureRate = totalWorkflows > 0 ? (totalFailures / totalWorkflows * 100).toFixed(1) : 0;
  let overallHealth = '🟢';
  if (totalFailures > 0) overallHealth = '🟡';
  if (parseFloat(failureRate) > CRITICAL_FAILURE_RATE_THRESHOLD) overallHealth = '🔴';

  // ━━━ Guard 汇总 ━━━
  let guardsActive = 0, guardsSuspended = 0, guardsTotal = 0;
  if (guardStatus) {
    for (const g of Object.values(guardStatus)) {
      guardsTotal++;
      if (g.status === 'active') guardsActive++;
      if (g.status === 'suspended' || g.mode === 'suspended') guardsSuspended++;
    }
  }

  // ━━━ 组装日报 ━━━
  const digest = {
    digest_id: 'NEURAL-DIGEST-' + cstTime.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    timestamp_cst: cstTime.toISOString().replace('Z', '+08:00'),
    version: '3.0.0',
    instruction_ref: 'ZY-NEURAL-UPGRADE-2026-0325-R2-002',
    overall_health: overallHealth,
    failure_rate_percent: parseFloat(failureRate),
    workflow_summary: {
      total_runs_24h: totalWorkflows,
      success: workflowSummary ? (workflowSummary.success || 0) : 0,
      failure: totalFailures,
      cancelled: workflowSummary ? (workflowSummary.cancelled || 0) : 0,
      in_progress: workflowSummary ? (workflowSummary.in_progress || 0) : 0
    },
    brain_summary: brainSummary,
    skyeye_status: skyeyeLatest ? {
      overall_health: skyeyeLatest.overall_health,
      last_scan: skyeyeLatest.timestamp,
      total_issues: (skyeyeLatest.diagnosis || {}).total_issues || 0
    } : { error: 'no_skyeye_report' },
    guard_status: { total: guardsTotal, active: guardsActive, suspended: guardsSuspended },
    quota_status: quotaStatus ? (quotaStatus.health_summary || { note: 'no health_summary field' }) : { error: 'no_quota_data' },
    issues_detected: [],
    recommendations: [],
    neural_map_version: neuralMap ? (neuralMap.version || 'unknown') : 'missing',
    unmapped_workflows: neuralMap ? (neuralMap.unmapped_workflows || []) : []
  };

  // ━━━ 自动检测问题 ━━━
  if (overallHealth === '🔴') {
    digest.issues_detected.push({
      severity: 'P0',
      description: 'Workflow 失败率 ' + failureRate + '% 超过 20% 阈值',
      recommendation: '立即排查失败的 Workflow'
    });
  }
  if (guardsSuspended > 0) {
    digest.issues_detected.push({
      severity: 'P1',
      description: guardsSuspended + ' 个 Guard 被暂停',
      recommendation: '检查被暂停的 Guard'
    });
  }
  if (digest.unmapped_workflows.length > 0) {
    digest.issues_detected.push({
      severity: 'P1',
      description: '发现 ' + digest.unmapped_workflows.length + ' 个孤儿 Workflow',
      recommendation: '在 neural-map.json 中分配上级大脑'
    });
  }

  fs.mkdirSync(DIGEST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIGEST_DIR, 'daily-digest.json'), JSON.stringify(digest, null, 2));

  console.log('\n━━━ 🧬 双端神经系统·日报摘要 ━━━');
  console.log('整体健康：' + overallHealth);
  console.log('24h运行：' + digest.workflow_summary.total_runs_24h + ' 次');
  console.log('Guard：' + guardsActive + '/' + guardsTotal + ' 活跃');
  console.log('问题：' + digest.issues_detected.length + ' 个');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

generateDigest();
