// scripts/skyeye/asop-reviewer.js
// 天眼·ASOP 自优化审批引擎
//
// 天眼每日 06:00 运行时扫描 data/asop-requests/pending/
// 按 ASOP 三级边界审批：GL1 自主 / GL2 天眼审批 / GL3 升级冰朔
//
// 审批标准：
//   1. 申请是否在该 Workflow 职责范围内？
//   2. 优化后是否不影响其他 Workflow 和系统整体架构？
//   3. 优化理由是否有数据支撑？
//   4. 是否违反核心不可变区？
//   5. GL3 级别 → 自动升级到冰朔
//
// 输出：审批结果 JSON → stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ASOP_DIR = path.join(ROOT, 'data/asop-requests');
const PENDING_DIR = path.join(ASOP_DIR, 'pending');
const APPROVED_DIR = path.join(ASOP_DIR, 'approved');
const REJECTED_DIR = path.join(ASOP_DIR, 'rejected');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ━━━ 核心不可变区（仓库侧） ━━━
const IMMUTABLE_FILES = [
  '.github/workflows/zhuyuan-skyeye.yml',
  'scripts/skyeye/diagnose.js',
  '.github/persona-brain/routing-map.json'
];

const IMMUTABLE_CONCEPTS = [
  'whitelist',
  'persona_id_format',
  'skyeye_report_schema',
  'secrets_key_names'
];

// ━━━ 30天变更累计上限 ━━━
const MAX_GL2_PER_WORKFLOW_30D = 3;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 移动申请文件到目标目录 ━━━
function moveRequest(requestId, fromDir, toDir, decision) {
  const srcFile = path.join(fromDir, `${requestId}.json`);
  if (!fs.existsSync(srcFile)) return;

  const request = readJSON(srcFile);
  if (!request) return;

  request.decision = {
    result: decision.result,
    reason: decision.reason,
    reviewed_at: new Date(Date.now() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    reviewer: '🦅 天眼·ASOP审批引擎'
  };

  if (decision.execution_steps) {
    request.decision.execution_steps = decision.execution_steps;
  }

  fs.mkdirSync(toDir, { recursive: true });
  fs.writeFileSync(path.join(toDir, `${requestId}.json`), JSON.stringify(request, null, 2) + '\n');
  fs.unlinkSync(srcFile);
}

// ━━━ 统计 30 天内某 Workflow 已批准的 GL2 数量 ━━━
function countRecentApprovals(workflow) {
  const dirs = [APPROVED_DIR, path.join(ASOP_DIR, 'executed'), path.join(ASOP_DIR, 'verified')];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
  let count = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== '.gitkeep');
    for (const file of files) {
      const req = readJSON(path.join(dir, file));
      if (!req) continue;
      if (req.requester && req.requester.workflow === workflow && req.level === 'GL2') {
        const ts = req.timestamp ? new Date(req.timestamp.replace('+08:00', '+0800')).getTime() : 0;
        if (ts > thirtyDaysAgo) count++;
      }
    }
  }

  return count;
}

// ━━━ 审批单个申请 ━━━
function evaluateRequest(req) {
  // GL3 → 自动升级到冰朔
  if (req.level === 'GL3') {
    return { result: 'escalate', reason: 'GL3 级别需冰朔审批' };
  }

  // 核心不可变区检查
  const affectedFiles = (req.impact_assessment && req.impact_assessment.affected_files) || [];
  const touchesImmutable = affectedFiles.some(f => IMMUTABLE_FILES.includes(f));
  if (touchesImmutable) {
    return { result: 'escalate', reason: '涉及核心不可变区文件，自动升级到冰朔审批' };
  }

  // 数据支撑检查
  if (!req.data_evidence || req.data_evidence.length < 10) {
    return { result: 'rejected', reason: '缺少数据支撑（evidence 不足 10 字符），请提供具体证据' };
  }

  // 影响范围检查：超过 2 个 Workflow → 升级
  const affectedWorkflows = (req.impact_assessment && req.impact_assessment.affected_workflows) || [];
  if (affectedWorkflows.length > 2) {
    return { result: 'escalate', reason: `影响超过 2 个 Workflow（${affectedWorkflows.length} 个），需冰朔评估` };
  }

  // 30 天变更累计检查
  const workflow = req.requester && req.requester.workflow;
  if (workflow) {
    const recentCount = countRecentApprovals(workflow);
    if (recentCount >= MAX_GL2_PER_WORKFLOW_30D) {
      return {
        result: 'escalate',
        reason: `${workflow} 在 30 天内已有 ${recentCount} 次 GL2 变更（上限 ${MAX_GL2_PER_WORKFLOW_30D}），自动冻结，升级冰朔审查`
      };
    }
  }

  // 回滚计划检查
  if (!req.rollback_plan || req.rollback_plan.length < 5) {
    return { result: 'rejected', reason: '缺少回滚计划（rollback_plan），请补充回退方案' };
  }

  // 通过所有检查 → 批准
  return {
    result: 'approved',
    reason: '申请合理 · 影响可控 · 数据充分 · 回滚计划完整'
  };
}

// ━━━ 主审批流程 ━━━
function reviewAll() {
  console.log('🔄 天眼·ASOP 审批引擎启动');
  console.log('═══════════════════════════════════════════\n');

  if (!fs.existsSync(PENDING_DIR)) {
    console.log('ℹ️ pending/ 目录不存在，无待审批申请');
    const result = { total: 0, approved: 0, rejected: 0, escalated: 0 };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const files = fs.readdirSync(PENDING_DIR)
    .filter(f => f.endsWith('.json') && f !== '.gitkeep');

  if (files.length === 0) {
    console.log('🔄 ASOP：无待审批申请');
    const result = { total: 0, approved: 0, rejected: 0, escalated: 0 };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log(`🔄 ASOP：发现 ${files.length} 条待审批申请\n`);

  const summary = { total: files.length, approved: 0, rejected: 0, escalated: 0, decisions: [] };

  for (const file of files) {
    const filePath = path.join(PENDING_DIR, file);
    const req = readJSON(filePath);
    if (!req) {
      console.log(`⚠️ 无法解析 ${file}，跳过`);
      continue;
    }

    const decision = evaluateRequest(req);
    const requestId = req.request_id || file.replace('.json', '');

    switch (decision.result) {
      case 'approved':
        moveRequest(requestId, PENDING_DIR, APPROVED_DIR, decision);
        summary.approved++;
        console.log(`✅ ASOP 批准：${requestId} — ${decision.reason}`);
        break;
      case 'rejected':
        moveRequest(requestId, PENDING_DIR, REJECTED_DIR, decision);
        summary.rejected++;
        console.log(`❌ ASOP 拒绝：${requestId} — ${decision.reason}`);
        break;
      case 'escalate':
        // 升级的申请保留在 pending/ 等冰朔处理，标记已升级
        req.escalated = true;
        req.escalate_reason = decision.reason;
        fs.writeFileSync(filePath, JSON.stringify(req, null, 2) + '\n');
        summary.escalated++;
        console.log(`⬆️ ASOP 升级：${requestId} — ${decision.reason}`);
        break;
    }

    summary.decisions.push({
      request_id: requestId,
      level: req.level,
      workflow: req.requester ? req.requester.workflow : '',
      result: decision.result,
      reason: decision.reason
    });
  }

  console.log(`\n📊 审批结果：批准 ${summary.approved} / 拒绝 ${summary.rejected} / 升级 ${summary.escalated}`);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

// ━━━ 导出 ━━━
module.exports = { reviewAll, evaluateRequest };

// ━━━ 直接运行 ━━━
if (require.main === module) {
  reviewAll();
}
