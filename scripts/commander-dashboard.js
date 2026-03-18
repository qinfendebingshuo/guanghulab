// scripts/commander-dashboard.js
// 铸渊·将军全局仪表盘生成器
//
// 功能：
//   ① 拉取所有 Workflow 运行状态
//   ② 读取天眼最新报告
//   ③ 读取公告板状态
//   ④ 生成将军全局仪表盘 JSON
//
// 输出：data/bulletin-board/dashboard.json + stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');
const SKYEYE_REPORTS_DIR = path.join(ROOT, 'data/skyeye-reports');
const BULLETIN_DIR = path.join(ROOT, 'data/bulletin-board');
const DASHBOARD_PATH = path.join(BULLETIN_DIR, 'dashboard.json');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 获取最新天眼报告 ━━━
function getLatestSkyeyeReport() {
  try {
    if (!fs.existsSync(SKYEYE_REPORTS_DIR)) return null;
    const files = fs.readdirSync(SKYEYE_REPORTS_DIR)
      .filter(f => f.startsWith('skyeye-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    return readJSON(path.join(SKYEYE_REPORTS_DIR, files[0]));
  } catch (e) {
    return null;
  }
}

// ━━━ 获取公告板工单状态 ━━━
function getBulletinBoardStatus() {
  const workOrdersDir = path.join(BULLETIN_DIR, 'work-orders');
  const receiptsDir = path.join(BULLETIN_DIR, 'receipts');

  let unreadWorkOrders = 0;
  const pendingReceipts = [];

  try {
    if (fs.existsSync(workOrdersDir)) {
      const orders = fs.readdirSync(workOrdersDir)
        .filter(f => f.endsWith('.json'));
      for (const orderFile of orders) {
        const order = readJSON(path.join(workOrdersDir, orderFile));
        if (order && order.status !== 'completed') {
          unreadWorkOrders++;
          pendingReceipts.push(order.order_id || orderFile.replace('.json', ''));
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return {
    unread_work_orders: unreadWorkOrders,
    pending_receipts: pendingReceipts
  };
}

// ━━━ 从天眼报告提取小兵状态 ━━━
function extractSoldiersFromReport(report) {
  const soldiers = [];

  if (!report) return { soldiers, total: 0, healthy: 0, failed: 0, needs_optimization: 0 };

  // 从 workflow_health 提取小兵
  if (report.workflow_health && report.workflow_health.details) {
    for (const wf of report.workflow_health.details) {
      const status = wf.status === 'healthy' ? '✅' :
                     wf.status === 'failed' ? '❌' : '⚠️';
      const soldier = {
        name: wf.name || wf.file,
        status,
        last_run: wf.last_run || 'unknown'
      };
      if (status === '❌') {
        soldier.error = wf.error || 'unknown error';
        soldier.fix_plan = 'retry + check logs';
      }
      soldiers.push(soldier);
    }
  }

  const total = soldiers.length;
  const healthy = soldiers.filter(s => s.status === '✅').length;
  const failed = soldiers.filter(s => s.status === '❌').length;
  const needsOpt = soldiers.filter(s => s.status === '⚠️').length;

  return { soldiers, total, healthy, failed, needs_optimization: needsOpt };
}

// ━━━ 生成决策摘要 ━━━
function generateDecision(soldierStats, bulletinStatus, skyeyeReport) {
  const actions = [];

  if (soldierStats.failed > 0) {
    actions.push(`修复 ${soldierStats.failed} 个故障小兵`);
  }
  if (soldierStats.needs_optimization > 0) {
    actions.push(`优化 ${soldierStats.needs_optimization} 个小兵`);
  }
  if (bulletinStatus.unread_work_orders > 0) {
    actions.push(`执行 ${bulletinStatus.unread_work_orders} 个未完成工单`);
  }
  if (skyeyeReport && skyeyeReport.diagnosis && skyeyeReport.diagnosis.needs_human > 0) {
    actions.push(`${skyeyeReport.diagnosis.needs_human} 个问题需人工处理`);
  }

  if (actions.length === 0) {
    return '全局健康 · 无需干预 · 继续巡航';
  }
  return actions.join(' → ');
}

// ━━━ 主函数 ━━━
function generateDashboard() {
  const now = new Date();
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
    .replace('T', ' ').slice(0, 19) + '+08:00';

  // 读取天眼最新报告
  const skyeyeReport = getLatestSkyeyeReport();

  // 提取小兵状态
  const soldierStats = extractSoldiersFromReport(skyeyeReport);

  // 读取公告板状态
  const bulletinStatus = getBulletinBoardStatus();

  // 生成决策
  const decision = generateDecision(soldierStats, bulletinStatus, skyeyeReport);

  const dashboard = {
    commander: '铸渊',
    timestamp: bjTime,
    global_view: {
      total_soldiers: soldierStats.total,
      healthy: soldierStats.healthy,
      failed: soldierStats.failed,
      needs_optimization: soldierStats.needs_optimization,
      soldiers: soldierStats.soldiers
    },
    bulletin_board_status: bulletinStatus,
    skyeye_latest: skyeyeReport ? {
      overall_health: skyeyeReport.overall_health || '❓',
      report_id: skyeyeReport.report_id || null,
      issues: skyeyeReport.diagnosis ? skyeyeReport.diagnosis.total_issues : 0,
      auto_fixed: skyeyeReport.diagnosis ? skyeyeReport.diagnosis.auto_fixed : 0
    } : {
      overall_health: '❓',
      report_id: null,
      issues: 0,
      auto_fixed: 0
    },
    decision
  };

  // 保存仪表盘
  fs.mkdirSync(BULLETIN_DIR, { recursive: true });
  fs.writeFileSync(DASHBOARD_PATH, JSON.stringify(dashboard, null, 2));

  console.log(JSON.stringify(dashboard, null, 2));
  console.log(`\n📊 将军全局仪表盘已生成 · ${bjTime}`);
}

// 允许作为模块导入或直接运行
if (require.main === module) {
  generateDashboard();
}

module.exports = { generateDashboard };
