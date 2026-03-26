// scripts/agents/twin-merge.js
// Twin Merge Engine · 双子融合引擎
// ZY-P1-TWIN-002 · Phase 1 · Twin Balance Agent
// 版权：国作登字-2026-A-00037559

'use strict';

const { WEIGHTS } = require('./twin-collector');

/**
 * 计算综合分数（加权求和）
 * @param {{ taskCompletion: number, testPassRate: number, codeCoverage: number, securityScore: number }} metrics
 * @returns {number}
 */
function computeComposite(metrics) {
  return Math.round((
    WEIGHTS.taskCompletion * metrics.taskCompletion +
    WEIGHTS.testPassRate * metrics.testPassRate +
    WEIGHTS.codeCoverage * metrics.codeCoverage +
    WEIGHTS.securityScore * metrics.securityScore
  ) * 10000) / 10000;
}

/**
 * 融合左右两翼指标 · 天平合一
 * @param {object} leftMetrics - EXE-Engine 指标
 * @param {object} rightMetrics - Grid-DB 指标
 * @returns {{ left: object, right: object, balance: number, timestamp: string }}
 */
function merge(leftMetrics, rightMetrics) {
  const leftComposite = computeComposite(leftMetrics);
  const rightComposite = computeComposite(rightMetrics);

  // 平衡度 = 1 - |左-右| — 完全一致时为 1.0
  const balance = Math.round((1 - Math.abs(leftComposite - rightComposite)) * 10000) / 10000;

  return {
    left: {
      composite: leftComposite,
      dimensions: {
        taskCompletion: leftMetrics.taskCompletion,
        testPassRate: leftMetrics.testPassRate,
        codeCoverage: leftMetrics.codeCoverage,
        securityScore: leftMetrics.securityScore
      }
    },
    right: {
      composite: rightComposite,
      dimensions: {
        taskCompletion: rightMetrics.taskCompletion,
        testPassRate: rightMetrics.testPassRate,
        codeCoverage: rightMetrics.codeCoverage,
        securityScore: rightMetrics.securityScore
      }
    },
    balance,
    timestamp: new Date().toISOString()
  };
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const { collectBoth } = require('./twin-collector');
  console.log('⚖️ Twin Merge Engine · 双子融合\n');
  const data = collectBoth();
  const result = merge(data.left, data.right);
  console.log(`  左翼 composite: ${result.left.composite}`);
  console.log(`  右翼 composite: ${result.right.composite}`);
  console.log(`  平衡度: ${result.balance}`);
}

module.exports = { merge, computeComposite };
