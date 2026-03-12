// 定时任务调度器·cron-jobs.js
// HoloLake·M-DINGTALK Phase 3
// DEV-004 之之×秋秋
//
// 统一管理所有定时任务
//

const reminder = require('./reminder');
const syncEngine = require('../sync/sync-engine');

// 所有定时任务
const jobs = [];
let isRunning = false;

/**
 * 注册并启动所有定时任务
 */
function startAll() {
  if (isRunning) {
    console.log('[CronJobs] 已在运行，跳过');
    return;
  }

  console.log('[CronJobs] ==========================');
  console.log('[CronJobs] 启动所有定时任务...');

  // 任务1：超时提醒（每小时）
  reminder.start();
  jobs.push({ name: '超时提醒', interval: '每小时', module: 'reminder' });

  // 任务2：三节点全量同步（每30分钟）
  const syncTimer = setInterval(async () => {
    console.log('[CronJobs] 触发定时同步...');
    await syncEngine.syncAll();
  }, 30 * 60 * 1000);

  jobs.push({
    name: '三节点同步',
    interval: '每30分钟',
    module: 'sync-engine',
    timer: syncTimer
  });

  isRunning = true;
  console.log(`[CronJobs] 已启动 ${jobs.length} 个定时任务`);
  console.log('[CronJobs] ==========================');
}

/**
 * 停止所有定时任务
 */
function stopAll() {
  if (!isRunning) {
    console.log('[CronJobs] 没有运行中的任务');
    return;
  }

  console.log('[CronJobs] 停止所有定时任务...');

  // 停止超时提醒
  reminder.stop();

  // 停止同步定时器
  jobs.forEach(job => {
    if (job.timer) {
      clearInterval(job.timer);
    }
  });

  // 清空任务列表
  jobs.length = 0;
  isRunning = false;

  console.log('[CronJobs] 所有定时任务已停止');
}

/**
 * 获取任务状态
 */
function getStatus() {
  return {
    isRunning,
    jobCount: jobs.length,
    jobs: jobs.map(j => ({
      name: j.name,
      interval: j.interval,
      module: j.module
    })),
    reminder: reminder.getStatus()
  };
}

module.exports = {
  startAll,
  stopAll,
  getStatus
};
