// scripts/skyeye/asop-submit.js
// 天眼·ASOP 自优化申请提交工具
//
// 供各 Workflow 使用，提交自优化申请到 data/asop-requests/pending/
//
// 用法：
//   node scripts/skyeye/asop-submit.js --workflow "xxx.yml" --level GL2 \
//     --problem "描述" --proposal "方案" --evidence "证据" \
//     --affected-workflows "a.yml,b.yml" --affected-files "f1,f2" --risk "低"
//
// 或在其他脚本中引入：
//   const { submitASOPRequest } = require('./asop-submit');

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PENDING_DIR = path.join(ROOT, 'data/asop-requests/pending');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ━━━ 生成申请 ID ━━━
function generateRequestId() {
  const now = new Date();
  const bjDate = new Date(now.getTime() + BEIJING_OFFSET_MS);
  const dateStr = bjDate.toISOString().split('T')[0].replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `ASOP-GH-${dateStr}-${seq}`;
}

// ━━━ 提交 ASOP 申请 ━━━
function submitASOPRequest(params) {
  const {
    workflow,
    workflowName = '',
    runId = '',
    level = 'GL2',
    problem = '',
    proposal = '',
    evidence = '',
    affectedWorkflows = [],
    affectedFiles = [],
    risk = '低',
    rollbackPlan = ''
  } = params;

  if (!workflow) {
    console.error('❌ ASOP: workflow 参数必填');
    return null;
  }
  if (!['GL1', 'GL2', 'GL3'].includes(level)) {
    console.error('❌ ASOP: level 必须是 GL1/GL2/GL3');
    return null;
  }
  if (!problem || !proposal) {
    console.error('❌ ASOP: problem 和 proposal 参数必填');
    return null;
  }

  const requestId = generateRequestId();
  const now = new Date();
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS);

  const request = {
    request_id: requestId,
    timestamp: bjTime.toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    requester: {
      workflow: workflow,
      name: workflowName || workflow.replace('.yml', ''),
      run_id: runId || process.env.GITHUB_RUN_ID || ''
    },
    level: level,
    current_problem: problem,
    proposed_optimization: proposal,
    impact_assessment: {
      affected_workflows: affectedWorkflows,
      affected_files: affectedFiles,
      risk: risk
    },
    data_evidence: evidence,
    rollback_plan: rollbackPlan
  };

  // GL1 直接执行，不写入 pending
  if (level === 'GL1') {
    console.log(`🔄 ASOP GL1 · ${requestId} · 自主执行，不需审批`);
    console.log(`   问题: ${problem}`);
    console.log(`   方案: ${proposal}`);
    return request;
  }

  // GL2/GL3 写入 pending/
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  const filePath = path.join(PENDING_DIR, `${requestId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(request, null, 2) + '\n');
  console.log(`🔄 ASOP ${level} · ${requestId} · 已提交到 pending/`);
  console.log(`   问题: ${problem}`);
  console.log(`   方案: ${proposal}`);
  if (level === 'GL3') {
    console.log(`   ⬆️ GL3 级别，需冰朔审批`);
  }

  return request;
}

// ━━━ 导出 ━━━
module.exports = { submitASOPRequest };

// ━━━ CLI 入口 ━━━
if (require.main === module) {
  const args = process.argv.slice(2);
  function getArg(name) {
    const idx = args.indexOf('--' + name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : '';
  }

  const result = submitASOPRequest({
    workflow: getArg('workflow'),
    workflowName: getArg('name'),
    runId: getArg('run-id'),
    level: getArg('level') || 'GL2',
    problem: getArg('problem'),
    proposal: getArg('proposal'),
    evidence: getArg('evidence'),
    affectedWorkflows: getArg('affected-workflows') ? getArg('affected-workflows').split(',') : [],
    affectedFiles: getArg('affected-files') ? getArg('affected-files').split(',') : [],
    risk: getArg('risk') || '低',
    rollbackPlan: getArg('rollback-plan')
  });

  if (result) {
    console.log(JSON.stringify(result, null, 2));
  }
}
