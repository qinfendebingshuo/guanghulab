// scripts/agents/auto-repair.js
// Auto-Repair Agent · 自修复代理
// ZY-P1-TWIN-004 · Phase 1 · Twin Balance Agent
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const REPAIR_LOG_PATH = path.join(ROOT, 'signal-log/auto-repair.json');

/**
 * 诊断失衡原因 · 望闻问切
 * @param {{ level: string, laggingSide: string, deficit: number }} alert
 * @returns {{ alert: object, cause: string, affectedDimensions: string[], severity: string }}
 */
function diagnose(alert) {
  if (!alert) {
    return { alert: null, cause: 'none', affectedDimensions: [], severity: 'none' };
  }

  // 根据偏差级别推断原因
  const causes = {
    low: '轻微测试波动或临时性回归',
    medium: '多个测试用例持续失败或缺失',
    high: '模块级架构问题或关键功能缺失'
  };

  return {
    alert,
    cause: causes[alert.level] || '未知原因',
    affectedDimensions: ['testPassRate', 'taskCompletion'],
    severity: alert.level
  };
}

/**
 * 分类修复级别 · 三级分诊
 * @param {{ severity: string }} diagnosis
 * @returns {{ level: string, name: string, autoFixable: boolean }}
 */
function classify(diagnosis) {
  if (diagnosis.severity === 'none') {
    return { level: 'L0', name: '无需修复', autoFixable: false };
  }

  if (diagnosis.severity === 'low') {
    return { level: 'L1', name: '自动修复', autoFixable: true };
  }

  if (diagnosis.severity === 'medium') {
    return { level: 'L2', name: '技术干预', autoFixable: false };
  }

  return { level: 'L3', name: '架构干预', autoFixable: false };
}

/**
 * 尝试自动修复 · 针灸疗法
 * @param {{ alert: object, cause: string, severity: string }} diagnosis
 * @returns {{ success: boolean, action: string, timestamp: string }}
 */
function repair(diagnosis) {
  const timestamp = new Date().toISOString();
  const classification = classify(diagnosis);

  if (!classification.autoFixable) {
    const result = {
      success: false,
      action: `需要${classification.name}，已生成工单`,
      level: classification.level,
      timestamp
    };
    logRepair(result);
    return result;
  }

  // L1 自动修复：记录问题，标记需要重跑测试
  const result = {
    success: true,
    action: '已记录轻微偏差，建议下次构建时重跑测试验证',
    level: 'L1',
    laggingSide: diagnosis.alert ? diagnosis.alert.laggingSide : 'unknown',
    timestamp
  };

  logRepair(result);
  return result;
}

/**
 * 验证修复结果 · 复查
 * @param {object} repairResult
 * @returns {{ verified: boolean, message: string }}
 */
function verify(repairResult) {
  if (!repairResult.success) {
    return {
      verified: false,
      message: `修复未执行（${repairResult.level}级需人工介入）`
    };
  }

  return {
    verified: true,
    message: '修复记录已归档，等待下次构建验证'
  };
}

/**
 * 写入修复日志
 * @param {object} record
 */
function logRepair(record) {
  let log = { repairs: [] };

  const logDir = path.dirname(REPAIR_LOG_PATH);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  if (fs.existsSync(REPAIR_LOG_PATH)) {
    try {
      log = JSON.parse(fs.readFileSync(REPAIR_LOG_PATH, 'utf8'));
    } catch (_) {
      log = { repairs: [] };
    }
  }

  if (!Array.isArray(log.repairs)) {
    log.repairs = [];
  }

  // 保留最近 50 条记录
  log.repairs.push(record);
  if (log.repairs.length > 50) {
    log.repairs = log.repairs.slice(-50);
  }

  fs.writeFileSync(REPAIR_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('🔧 Auto-Repair Agent · 自修复代理\n');

  const exampleAlert = {
    level: 'low',
    laggingSide: 'left (EXE-Engine)',
    deficit: 0.03
  };

  const diag = diagnose(exampleAlert);
  const cls = classify(diag);
  const result = repair(diag);
  const verification = verify(result);

  console.log(`  诊断: ${diag.cause}`);
  console.log(`  分类: ${cls.level} - ${cls.name}`);
  console.log(`  修复: ${result.action}`);
  console.log(`  验证: ${verification.message}`);
}

module.exports = { diagnose, classify, repair, verify };
