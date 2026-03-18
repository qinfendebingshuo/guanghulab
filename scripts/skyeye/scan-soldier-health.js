// scripts/skyeye/scan-soldier-health.js
// 天眼·扫描模块D15 · 小兵健康全局视图
//
// 扫描内容：
//   ① 读取铸渊将军仪表盘 commander-dashboard.json
//   ② 小兵故障率 > 20% → P0 工单
//   ③ 小兵连续7天同一错误未修复 → P1 工单
//   ④ 全局小兵健康统计
//
// 输出：JSON → stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DASHBOARD_PATH = path.join(ROOT, 'data/bulletin-board/dashboard.json');
const SKYEYE_REPORTS_DIR = path.join(ROOT, 'data/skyeye-reports');

const FAILURE_RATE_THRESHOLD = 20;
const CONSECUTIVE_FAILURE_THRESHOLD_DAYS = 7;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 获取最近N天的天眼报告 ━━━
function getRecentReports(days) {
  const reports = [];
  try {
    if (!fs.existsSync(SKYEYE_REPORTS_DIR)) return reports;
    const files = fs.readdirSync(SKYEYE_REPORTS_DIR)
      .filter(f => f.startsWith('skyeye-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, days);

    for (const file of files) {
      const report = readJSON(path.join(SKYEYE_REPORTS_DIR, file));
      if (report) reports.push(report);
    }
  } catch (e) {
    // ignore
  }
  return reports;
}

// ━━━ D15 主扫描 ━━━
function scanSoldierHealth() {
  const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
  const now = new Date();
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
    .replace('T', ' ').slice(0, 19) + '+08:00';

  const result = {
    dimension: 'D15',
    name: '小兵健康全局视图',
    scan_time: bjTime,
    status: '✅',
    dashboard_exists: false,
    total_soldiers: 0,
    healthy: 0,
    failed: 0,
    needs_optimization: 0,
    failure_rate: 0,
    issues: [],
    recurring_errors: [],
    recommendations: []
  };

  // 读取将军仪表盘
  const dashboard = readJSON(DASHBOARD_PATH);
  if (!dashboard) {
    result.dashboard_exists = false;
    result.status = '⚠️';
    result.issues.push({
      type: 'dashboard_missing',
      message: '将军仪表盘不存在 · 需先运行 commander-dashboard.js',
      action: 'P1工单 · 生成仪表盘'
    });
  } else {
    result.dashboard_exists = true;
    const gv = dashboard.global_view || {};
    result.total_soldiers = gv.total_soldiers || 0;
    result.healthy = gv.healthy || 0;
    result.failed = gv.failed || 0;
    result.needs_optimization = gv.needs_optimization || 0;

    // 计算故障率
    if (result.total_soldiers > 0) {
      result.failure_rate = Math.round((result.failed / result.total_soldiers) * 100);
    }

    // 故障率 > 20% → P0
    if (result.failure_rate > FAILURE_RATE_THRESHOLD) {
      result.status = '❌';
      result.issues.push({
        type: 'high_failure_rate',
        message: `小兵故障率 ${result.failure_rate}% > ${FAILURE_RATE_THRESHOLD}%`,
        action: 'P0工单 · 全局小兵修复'
      });
    }
  }

  // 检查连续7天同一错误
  const recentReports = getRecentReports(CONSECUTIVE_FAILURE_THRESHOLD_DAYS);
  if (recentReports.length >= 2) {
    // 收集各报告中的失败 workflow
    const errorMap = {};
    for (const report of recentReports) {
      if (report.workflow_health && report.workflow_health.details) {
        for (const wf of report.workflow_health.details) {
          if (wf.status === 'failed') {
            const key = wf.name || wf.file;
            errorMap[key] = (errorMap[key] || 0) + 1;
          }
        }
      }
    }

    // 连续7天同一错误
    for (const [name, count] of Object.entries(errorMap)) {
      if (count >= CONSECUTIVE_FAILURE_THRESHOLD_DAYS) {
        result.recurring_errors.push({
          soldier: name,
          consecutive_failures: count,
          action: 'P1工单 · 建议铸渊介入'
        });
        if (result.status === '✅') result.status = '⚠️';
      }
    }
  }

  // 生成建议
  if (result.failed > 0) {
    result.recommendations.push(`修复 ${result.failed} 个故障小兵`);
  }
  if (result.recurring_errors.length > 0) {
    result.recommendations.push(`${result.recurring_errors.length} 个小兵存在持续性故障，需铸渊介入`);
  }
  if (result.total_soldiers === 0) {
    result.recommendations.push('仪表盘无小兵数据 · 需先生成仪表盘');
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

scanSoldierHealth();
