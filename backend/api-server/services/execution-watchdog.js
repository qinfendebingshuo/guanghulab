/**
 * 执行看门狗 · 超时保护 + 死锁防护
 *
 * 定期检查执行锁是否超时。
 * 如果一个操作执行超过 MAX_EXECUTION_TIME，标记为超时并释放锁。
 * 这是防止死锁的兜底机制。
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var executionLock = require('../middleware/execution-lock');

// 最大执行时间：15 分钟
var MAX_EXECUTION_TIME = 15 * 60 * 1000;

// 警告时间：10 分钟
var WARN_TIME = 10 * 60 * 1000;

// 检查间隔：30 秒
var CHECK_INTERVAL = 30 * 1000;

var watchdogTimer = null;

/**
 * 启动看门狗
 * 定期扫描活跃锁表，检测超时操作
 */
function startWatchdog() {
  if (watchdogTimer) return;

  watchdogTimer = setInterval(function() {
    var activeLocks = executionLock.getActiveLocks();
    var now = Date.now();

    for (var entry of activeLocks) {
      var devId = entry[0];
      var lock = entry[1];

      if (lock.state !== 'running') continue;

      var elapsed = now - lock.startTime;

      // 超时：强制释放
      if (elapsed > MAX_EXECUTION_TIME) {
        console.error(
          '[WATCHDOG] 执行超时: ' + lock.executionId +
          ' (' + lock.operation + ') - ' + Math.round(elapsed / 1000) + 's'
        );

        lock.state = 'timeout';
        lock.error = {
          message: '执行超时（超过 ' + Math.round(MAX_EXECUTION_TIME / 60000) + ' 分钟）'
        };

        executionLock.logStep(devId, {
          message: '⏰ 执行超时，看门狗已强制释放锁',
          success: false
        });

        // 延迟释放（给前端时间获取超时状态）
        (function(id) {
          setTimeout(function() { executionLock.releaseLock(id); }, 30000);
        })(devId);
      }
      // 警告
      else if (elapsed > WARN_TIME && !lock.warned) {
        console.warn(
          '[WATCHDOG] 执行时间较长: ' + lock.executionId +
          ' (' + lock.operation + ') - ' + Math.round(elapsed / 1000) + 's'
        );
        lock.warned = true;
      }
    }
  }, CHECK_INTERVAL);

  // 不阻止 Node.js 进程退出
  if (watchdogTimer.unref) {
    watchdogTimer.unref();
  }

  console.log('[WATCHDOG] 执行看门狗已启动 · 检查间隔 ' + (CHECK_INTERVAL / 1000) + 's · 超时阈值 ' + (MAX_EXECUTION_TIME / 60000) + 'min');
}

/**
 * 停止看门狗
 */
function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

module.exports = {
  startWatchdog: startWatchdog,
  stopWatchdog: stopWatchdog,
  MAX_EXECUTION_TIME: MAX_EXECUTION_TIME
};
