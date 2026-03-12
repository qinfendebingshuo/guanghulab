// 超时提醒系统·reminder.js
// HoloLake·M-DINGTALK Phase 3
// DEV-004 之之×秋秋
//
// 规则：广播签发后72小时未交SYSLOG → 自动提醒
//

const fs = require('fs');
const path = require('path');

// 数据文件路径（复用Phase 2的多维表格数据）
const DATA_DIR = path.join(__dirname, '..', 'data');
const DEVELOPER_TABLE = path.join(DATA_DIR, 'developer-status.json');
const REMINDER_LOG = path.join(DATA_DIR, 'reminder-log.json');

// 提醒配置
const TIMEOUT_HOURS = 72;
const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 每小时检查一次

let reminderTimer = null;

/**
 * 扫描所有开发者，找出超时未交SYSLOG的
 */
function scanOverdue() {
  console.log(`[Reminder] 扫描超时开发者... ${new Date().toLocaleString('zh-CN')}`);

  // 读取开发者状态表
  if (!fs.existsSync(DEVELOPER_TABLE)) {
    console.log('[Reminder] 开发者状态表不存在，跳过');
    return [];
  }

  let devTable;
  try {
    devTable = JSON.parse(fs.readFileSync(DEVELOPER_TABLE, 'utf-8'));
  } catch (err) {
    console.error('[Reminder] 读取开发者状态表失败:', err.message);
    return [];
  }

  const now = Date.now();
  const overdueList = [];

  for (const dev of (devTable.developers || [])) {
    // 跳过未启动或已完成的开发者
    if (!dev.last_broadcast_time || dev.status === '已完成' || dev.status === '未启动') {
      continue;
    }

    const broadcastTime = new Date(dev.last_broadcast_time).getTime();
    const hoursSince = (now - broadcastTime) / (1000 * 60 * 60);

    if (hoursSince >= TIMEOUT_HOURS && dev.status !== 'HOLD') {
      overdueList.push({
        dev_id: dev.dev_id,
        name: dev.name,
        current_module: dev.current_module,
        last_broadcast: dev.last_broadcast_time,
        hours_overdue: Math.round(hoursSince - TIMEOUT_HOURS),
        total_hours: Math.round(hoursSince)
      });
    }
  }

  if (overdueList.length > 0) {
    console.log(`[Reminder] ⚠️ 发现 ${overdueList.length} 个超时开发者：`);
    for (const dev of overdueList) {
      console.log(`  · ${dev.dev_id} ${dev.name} - 超时${dev.hours_overdue}小时 - ${dev.current_module}`);
    }
  } else {
    console.log('[Reminder] 无超时开发者');
  }

  return overdueList;
}

/**
 * 生成提醒消息（钉钉消息卡片格式）
 */
function generateReminderMessage(devInfo) {
  return {
    msgtype: 'markdown',
    markdown: {
      title: `SYSLOG提醒·${devInfo.dev_id}`,
      text: [
        '## ⏰ SYSLOG超时提醒',
        `**${devInfo.name}**（${devInfo.dev_id}）`,
        `你的广播已经签发 **${devInfo.total_hours}** 小时了`,
        `超过72小时启动窗口 **${devInfo.hours_overdue}** 小时`,
        `当前任务：${devInfo.current_module}`,
        '**请尽快提交SYSLOG！**',
        '---',
        '✅ 已完成 → 提交完整SYSLOG',
        '❓ 遇到困难 → 截图发群里，秋秋/知秋帮你',
        '⏸️ 暂时没空 → 回复「HOLD」，系统记录',
        '---',
        '🤖 系统自动提醒 · HoloLake'
      ].join('\n')
    }
  };
}

/**
 * 执行提醒发送
 */
async function executeReminders() {
  const overdueList = scanOverdue();
  if (overdueList.length === 0) return [];

  const reminderResults = [];

  for (const dev of overdueList) {
    const message = generateReminderMessage(dev);

    // 模拟发送（后续接入真实钉钉API）
    console.log(`[Reminder] 向 ${dev.name} 发送提醒消息（模拟）`);

    reminderResults.push({
      timestamp: new Date().toISOString(),
      dev_id: dev.dev_id,
      hours_overdue: dev.hours_overdue,
      status: 'sent-mock'
    });
  }

  // 保存提醒日志
  saveReminderLog(reminderResults);

  return reminderResults;
}

/**
 * 启动定时提醒
 */
function start() {
  if (reminderTimer) {
    console.log('[Reminder] 提醒系统已在运行');
    return;
  }

  console.log(`[Reminder] 启动超时提醒系统 · ${TIMEOUT_HOURS}小时超时 · 每小时扫描一次`);

  // 启动时立即扫描一次
  executeReminders();

  // 定时扫描
  reminderTimer = setInterval(executeReminders, REMINDER_INTERVAL_MS);

  console.log('[Reminder] 定时器已启动');
}

/**
 * 停止定时提醒
 */
function stop() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
    console.log('[Reminder] 提醒系统已停止');
  }
}

/**
 * 保存提醒日志
 */
function saveReminderLog(results) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let log = [];
  if (fs.existsSync(REMINDER_LOG)) {
    try {
      log = JSON.parse(fs.readFileSync(REMINDER_LOG, 'utf-8'));
    } catch {}
  }

  log.unshift(...results);
  if (log.length > 200) log = log.slice(0, 200);

  fs.writeFileSync(REMINDER_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

/**
 * 获取提醒系统状态
 */
function getStatus() {
  return {
    running: reminderTimer !== null,
    timeoutHours: TIMEOUT_HOURS,
    checkIntervalMinutes: REMINDER_INTERVAL_MS / 60000,
    overdueNow: scanOverdue()
  };
}

module.exports = {
  scanOverdue,
  generateReminderMessage,
  executeReminders,
  start,
  stop,
  getStatus
};
