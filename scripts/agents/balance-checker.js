// scripts/agents/balance-checker.js
// Balance Checker · 天平校验器
// ZY-P1-TWIN-003 · Phase 1 · Twin Balance Agent
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * 检查双子平衡状态 · 天平是否倾斜
 * @param {{ left: { composite: number }, right: { composite: number }, balance: number }} mergeResult
 * @returns {{ balanced: boolean, balance: number, drift: number, alert: null|object }}
 */
function check(mergeResult) {
  const { left, right, balance } = mergeResult;
  const drift = Math.round(Math.abs(left.composite - right.composite) * 10000) / 10000;

  // 天平完全平衡
  if (balance >= 1.0) {
    return { balanced: true, balance, drift: 0, alert: null };
  }

  // 天平倾斜 — 生成告警
  const laggingSide = left.composite < right.composite ? 'left (EXE-Engine)' : 'right (Grid-DB)';
  const leadingSide = left.composite >= right.composite ? 'left (EXE-Engine)' : 'right (Grid-DB)';
  const deficit = drift;

  let level;
  if (drift < 0.05) {
    level = 'low';
  } else if (drift < 0.15) {
    level = 'medium';
  } else {
    level = 'high';
  }

  const recommendations = {
    low: '轻微偏差，建议关注但无需立即处理',
    medium: '中等偏差，建议加强落后侧开发或修复测试',
    high: '严重偏差，需要立即介入，可能存在架构问题'
  };

  return {
    balanced: false,
    balance,
    drift,
    alert: {
      level,
      laggingSide,
      leadingSide,
      deficit,
      recommendation: recommendations[level]
    }
  };
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const { collectBoth } = require('./twin-collector');
  const { merge } = require('./twin-merge');

  console.log('🔍 Balance Checker · 天平校验\n');
  const data = collectBoth();
  const merged = merge(data.left, data.right);
  const result = check(merged);

  if (result.balanced) {
    console.log('  ✅ 双子天平完全平衡');
  } else {
    console.log(`  ⚠️ 偏差等级: ${result.alert.level}`);
    console.log(`  📉 落后侧: ${result.alert.laggingSide}`);
    console.log(`  📊 偏差值: ${result.drift}`);
    console.log(`  💡 建议: ${result.alert.recommendation}`);
  }
}

module.exports = { check };
