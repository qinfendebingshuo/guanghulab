// scripts/neural/track-work-orders.js
// 🧬 工单追踪器
// 铸渊每次唤醒时运行，追踪所有活跃工单状态
// 检查超时、匹配回执、更新状态、生成追踪报告
//
// 指令回执追踪表配置（Notion 侧）
// 数据库位置：光湖语言壳 > 统一网关 > 指令回执追踪表
// 写入脚本：scripts/neural/write-receipt-to-notion.js

const fs = require('fs');
const path = require('path');

var WORK_ORDER_DIR = 'data/neural-reports/work-orders';
var COMPLETED_DIR = 'data/deploy-queue/completed';
var RECEIPT_DIR = 'data/neural-reports/receipts';
var TRACKER_DIR = 'data/neural-reports/work-orders';
var TERMINAL_STATUSES = ['CLOSED', 'ESCALATED', 'VERIFIED'];

// ━━━ 指令回执追踪配置 ━━━
var RECEIPT_TRACKER_CONFIG = {
  // 指令回执追踪表 · Notion Database ID
  // 位于：光湖语言壳 > 统一网关 > 指令回执追踪表
  // 实际 Database ID 通过此环境变量名读取（安全考虑不硬编码）
  databaseIdEnvVar: 'RECEIPT_DB_ID',

  // 字段映射（与 Notion 数据库字段名一一对应）
  fieldMap: {
    instructionId: '指令编号',      // title
    summary: '指令摘要',             // text
    status: '执行状态',              // status
    receipt: '铸渊回执',             // text
    receiptTime: '回执时间',         // date
    newFiles: '新增文件数',          // number
    modifiedFiles: '修改文件数',     // number
    relatedAgent: '关联Agent',       // text
    timeoutStatus: '回执超时',       // select
  },

  // 超时阈值（小时）
  timeoutThresholds: {
    warning: 24,   // 24h → 🟡 接近超时
    critical: 72,  // 72h → 🔴 已超时
  }
};

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

function getActiveWorkOrders() {
  if (!fs.existsSync(WORK_ORDER_DIR)) return [];

  var allOrders = [];
  var files = fs.readdirSync(WORK_ORDER_DIR)
    .filter(function(f) { return f.startsWith('work-orders-') && f.endsWith('.json'); });

  for (var i = 0; i < files.length; i++) {
    var data = loadJSON(path.join(WORK_ORDER_DIR, files[i]));
    if (data && data.work_orders) {
      for (var j = 0; j < data.work_orders.length; j++) {
        allOrders.push(data.work_orders[j]);
      }
    }
  }

  return allOrders.filter(function(wo) {
    return TERMINAL_STATUSES.indexOf(wo.status) === -1;
  });
}

function getCompletedReceipts() {
  var receipts = {};

  // 从 deploy-queue/completed 收集
  if (fs.existsSync(COMPLETED_DIR)) {
    var files = fs.readdirSync(COMPLETED_DIR)
      .filter(function(f) { return f.endsWith('.json'); });

    for (var i = 0; i < files.length; i++) {
      var receipt = loadJSON(path.join(COMPLETED_DIR, files[i]));
      if (receipt && receipt.command_id) {
        receipts[receipt.command_id] = receipt;
      }
    }
  }

  // 从 neural-reports/receipts 收集本地回执
  if (fs.existsSync(RECEIPT_DIR)) {
    var receiptFiles = fs.readdirSync(RECEIPT_DIR)
      .filter(function(f) { return f.endsWith('.json'); });

    for (var j = 0; j < receiptFiles.length; j++) {
      var localReceipt = loadJSON(path.join(RECEIPT_DIR, receiptFiles[j]));
      if (localReceipt && localReceipt.instruction_id) {
        receipts[localReceipt.instruction_id] = localReceipt;
      }
    }
  }

  return receipts;
}

function checkTimeout(workOrder) {
  var timeout = workOrder.timeout_hours || RECEIPT_TRACKER_CONFIG.timeoutThresholds.critical;
  var created = new Date(workOrder.created);
  var now = new Date();
  var elapsed = (now - created) / (1000 * 60 * 60);
  return elapsed > timeout;
}

function getTimeoutStatus(workOrder) {
  var created = new Date(workOrder.created);
  var now = new Date();
  var elapsed = (now - created) / (1000 * 60 * 60);

  if (elapsed > RECEIPT_TRACKER_CONFIG.timeoutThresholds.critical) return '🔴 已超时';
  if (elapsed > RECEIPT_TRACKER_CONFIG.timeoutThresholds.warning) return '🟡 接近超时';
  return '🟢 正常';
}

function trackWorkOrders() {
  console.log('\n━━━ 🧬 工单追踪器启动 ━━━\n');

  var activeOrders = getActiveWorkOrders();
  var receipts = getCompletedReceipts();

  console.log('活跃工单: ' + activeOrders.length + ' 个');

  var stats = {
    total_active: activeOrders.length,
    by_status: {},
    timed_out: 0,
    matched_receipts: 0,
    escalated: 0
  };

  for (var i = 0; i < activeOrders.length; i++) {
    var wo = activeOrders[i];
    var status = wo.status || 'pending';

    // 统计状态分布
    if (!stats.by_status[status]) stats.by_status[status] = 0;
    stats.by_status[status]++;

    // 检查超时
    if (checkTimeout(wo)) {
      stats.timed_out++;
      console.log('  ⏰ 超时: ' + wo.id + ' (' + wo.title + ')');

      // 检查是否需要升级
      var maxRetries = (wo.constraints && wo.constraints.max_retries) || 2;
      if (wo.retry_count >= maxRetries) {
        wo.status = 'ESCALATED';
        stats.escalated++;
        console.log('  🔺 升级到人类: ' + wo.id);
      }
    }

    // 检查回执匹配
    if (wo.command_id && receipts[wo.command_id]) {
      var receipt = receipts[wo.command_id];
      stats.matched_receipts++;

      if (receipt.result && receipt.result.status === 'success') {
        wo.status = 'VERIFIED';
        console.log('  ✅ 已验证: ' + wo.id + ' (回执成功)');
      } else if (receipt.result && receipt.result.status === 'failure') {
        wo.status = 'pending';
        wo.retry_count = (wo.retry_count || 0) + 1;
        console.log('  ❌ 失败: ' + wo.id + ' (重试 ' + wo.retry_count + ')');
      }
    }
  }

  // 生成追踪报告
  var now = new Date();
  var cstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  var dateStr = cstTime.toISOString().split('T')[0];

  var trackerReport = {
    tracker_id: 'TRACKER-' + dateStr,
    timestamp: now.toISOString(),
    receipt_config: {
      database_env_var: RECEIPT_TRACKER_CONFIG.databaseIdEnvVar,
      timeout_warning_hours: RECEIPT_TRACKER_CONFIG.timeoutThresholds.warning,
      timeout_critical_hours: RECEIPT_TRACKER_CONFIG.timeoutThresholds.critical
    },
    stats: stats,
    active_orders: activeOrders.map(function(wo) {
      return {
        id: wo.id,
        severity: wo.severity,
        title: wo.title,
        status: wo.status,
        created: wo.created,
        timed_out: checkTimeout(wo),
        timeout_status: getTimeoutStatus(wo)
      };
    })
  };

  fs.mkdirSync(TRACKER_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(TRACKER_DIR, 'tracker-' + dateStr + '.json'),
    JSON.stringify(trackerReport, null, 2)
  );

  console.log('\n📊 追踪报告:');
  console.log('  活跃: ' + stats.total_active);
  console.log('  超时: ' + stats.timed_out);
  console.log('  回执匹配: ' + stats.matched_receipts);
  console.log('  升级: ' + stats.escalated);
  console.log('  状态分布: ' + JSON.stringify(stats.by_status));
  console.log('\n━━━ 追踪完成 ━━━\n');

  return trackerReport;
}

if (require.main === module) {
  trackWorkOrders();
}

module.exports = { trackWorkOrders, RECEIPT_TRACKER_CONFIG };
