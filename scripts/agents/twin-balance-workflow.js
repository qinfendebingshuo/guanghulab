// scripts/agents/twin-balance-workflow.js
// Twin Balance Workflow · 双子天平主流程
// ZY-P1-TWIN-005 · Phase 1 · Twin Balance Agent
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const TIANYEN_DIR = path.join(ROOT, '.github/tianyen');
const STATUS_PATH = path.join(TIANYEN_DIR, 'twin-status.json');

const { collectBoth } = require('./twin-collector');
const { merge } = require('./twin-merge');
const { check } = require('./balance-checker');
const { diagnose, classify, repair, verify } = require('./auto-repair');

/**
 * 运行完整的双子天平检查流程
 * 采集 → 融合 → 校验 → 修复（如需要）
 * @returns {object} 完整结果
 */
function runPipeline() {
  console.log('⚖️ Twin Balance Check · 双子天平校验流程\n');

  // Step 1: 采集双翼数据
  console.log('── Step 1: 数据采集 ──');
  const data = collectBoth();
  console.log(`  左翼 (EXE-Engine): tests=${data.left.details.totalPassed}/${data.left.details.totalTests}`);
  console.log(`  右翼 (Grid-DB):    tests=${data.right.details.totalPassed}/${data.right.details.totalTests}`);

  // Step 2: 融合分析
  console.log('\n── Step 2: 融合分析 ──');
  const merged = merge(data.left, data.right);
  console.log(`  左翼 composite: ${merged.left.composite}`);
  console.log(`  右翼 composite: ${merged.right.composite}`);
  console.log(`  平衡度: ${merged.balance}`);

  // Step 3: 平衡校验
  console.log('\n── Step 3: 平衡校验 ──');
  const checkResult = check(merged);
  if (checkResult.balanced) {
    console.log('  ✅ 天平完全平衡');
  } else {
    console.log(`  ⚠️ 偏差等级: ${checkResult.alert.level}`);
    console.log(`  📉 落后侧: ${checkResult.alert.laggingSide}`);
    console.log(`  📊 偏差值: ${checkResult.drift}`);
  }

  // Step 4: 修复（如需要）
  let repairResult = null;
  let verifyResult = null;
  if (!checkResult.balanced && checkResult.alert) {
    console.log('\n── Step 4: 自动修复 ──');
    const diag = diagnose(checkResult.alert);
    const cls = classify(diag);
    console.log(`  诊断: ${diag.cause}`);
    console.log(`  分类: ${cls.level} - ${cls.name}`);

    repairResult = repair(diag);
    console.log(`  修复: ${repairResult.action}`);

    verifyResult = verify(repairResult);
    console.log(`  验证: ${verifyResult.message}`);
  }

  // 汇总状态
  const status = {
    timestamp: new Date().toISOString(),
    metrics: {
      left: merged.left,
      right: merged.right
    },
    balance: merged.balance,
    balanced: checkResult.balanced,
    drift: checkResult.drift,
    alert: checkResult.alert,
    repair: repairResult,
    verification: verifyResult
  };

  // 保存状态文件
  if (!fs.existsSync(TIANYEN_DIR)) {
    fs.mkdirSync(TIANYEN_DIR, { recursive: true });
  }
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2), 'utf8');

  console.log(`\n✅ 状态已写入 ${STATUS_PATH}`);
  return status;
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  runPipeline();
}

module.exports = { runPipeline };
