#!/usr/bin/env node
/**
 * skyeye/hibernation/overtime-monitor.js
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * ⏰ 延时监控
 * 如果实际休眠超出预估 15% 以上，自动追加延时通知。
 *
 * 用法:
 *   node overtime-monitor.js --planned=12 --elapsed=15 --mode=daily
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const OVERTIME_THRESHOLD = 0.15; // 15%

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result[key] = value || 'true';
    }
  }
  return result;
}

function checkOvertime(plannedDuration, elapsed) {
  const threshold = plannedDuration * (1 + OVERTIME_THRESHOLD);

  if (elapsed > threshold) {
    return {
      overtime: true,
      planned: plannedDuration,
      elapsed: elapsed,
      threshold: Math.round(threshold),
      overage_percent: Math.round(((elapsed - plannedDuration) / plannedDuration) * 100),
      message: `原预计 ${plannedDuration}min，实际已 ${elapsed}min`
    };
  }

  return {
    overtime: false,
    planned: plannedDuration,
    elapsed: elapsed,
    threshold: Math.round(threshold),
    remaining: Math.max(0, plannedDuration - elapsed)
  };
}

function run() {
  const args = parseArgs();
  const planned = parseInt(args.planned || '12', 10);
  const elapsed = parseInt(args.elapsed || '0', 10);
  const mode = args.mode || 'daily';

  console.log(`[Overtime Monitor] Mode: ${mode}`);
  console.log(`[Overtime Monitor] Planned: ${planned}min, Elapsed: ${elapsed}min`);

  const result = checkOvertime(planned, elapsed);

  if (result.overtime) {
    console.log(`⚠️ 休眠延时！${result.message}`);
    console.log(`   超出阈值 ${OVERTIME_THRESHOLD * 100}%（预计 ${result.threshold}min）`);

    // 输出供 readme-status-updater 使用
    console.log(`::set-output name=overtime::true`);
    console.log(`::set-output name=message::${result.message}`);
  } else {
    console.log(`✅ 休眠时间正常，剩余 ${result.remaining}min`);
    console.log(`::set-output name=overtime::false`);
  }

  return result;
}

module.exports = { checkOvertime, OVERTIME_THRESHOLD, run };

if (require.main === module) {
  run();
}
