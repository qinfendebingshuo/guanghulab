/**
 * 执行锁中间件 · L2 API 执行拦截层
 *
 * 当一个操作开始执行时：
 * 1. 为该操作创建一个执行上下文（executionId）
 * 2. 锁定相关资源（防止并发冲突）
 * 3. 拒绝一切 cancel/abort/rollback 请求
 * 4. 执行完成后自动释放锁
 *
 * 同一个开发者不能同时执行多个写入操作。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var crypto = require('crypto');

// 内存中的执行锁表
var activeLocks = new Map();

function generateExecutionId() {
  return 'exec-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
}

/**
 * 获取执行锁表引用（供看门狗使用）
 */
function getActiveLocks() {
  return activeLocks;
}

/**
 * 创建执行锁
 * @param {string} devId - 开发者编号
 * @param {string} operation - 操作描述
 * @returns {Object} { success, executionId, lock } 或 { success: false, reply }
 */
function acquireLock(devId, operation) {
  if (activeLocks.has(devId)) {
    var existing = activeLocks.get(devId);
    if (existing.state === 'running') {
      return {
        success: false,
        reply: '⏳ 你有一个操作正在执行中（' + existing.operation +
               '），请等待完成。\n\n系统不允许同时执行多个操作——这是为了保护数据一致性。'
      };
    }
  }

  var executionId = generateExecutionId();
  var lock = {
    executionId: executionId,
    devId: devId,
    operation: operation,
    startTime: Date.now(),
    state: 'running',
    steps: [],
    checkpoints: [],
    warned: false,
    completedSteps: 0,
    totalSteps: 0,
    result: null,
    error: null
  };

  activeLocks.set(devId, lock);

  return {
    success: true,
    executionId: executionId,
    lock: lock
  };
}

/**
 * 释放执行锁
 */
function releaseLock(devId) {
  activeLocks.delete(devId);
}

/**
 * 获取执行状态（通过 executionId）
 */
function getExecutionStatus(executionId) {
  for (var entry of activeLocks) {
    if (entry[1].executionId === executionId) {
      return entry[1];
    }
  }
  return null;
}

/**
 * 记录执行步骤（用于事后回放）
 */
function logStep(devId, step) {
  var lock = activeLocks.get(devId);
  if (lock) {
    lock.steps.push({
      message: step.message,
      success: step.success,
      timestamp: new Date().toISOString()
    });
    if (step.success) {
      lock.completedSteps++;
    }
  }
}

/**
 * 保存检查点（用于失败时回滚）
 */
function saveCheckpoint(devId, checkpoint) {
  var lock = activeLocks.get(devId);
  if (lock) {
    lock.checkpoints.push({
      id: checkpoint.id,
      label: checkpoint.label,
      data: checkpoint.data,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 取消拦截中间件
 * 拦截所有试图取消执行中操作的请求
 */
function blockCancellation(req, res, next) {
  var devId = req.user ? req.user.devId : null;
  if (!devId) return next();

  var isCancelAttempt =
    req.path.includes('/cancel') ||
    req.path.includes('/abort') ||
    req.path.includes('/rollback');

  var isDeleteOnLocked = req.method === 'DELETE' && activeLocks.has(devId);

  if (isCancelAttempt || isDeleteOnLocked) {
    var lock = activeLocks.get(devId);
    if (lock && lock.state === 'running') {
      return res.status(423).json({
        error: true,
        code: 'EXECUTION_LOCKED',
        locked: true,
        executionId: lock.executionId,
        reply: '🔒 操作「' + lock.operation + '」正在执行中，不可取消。\n\n' +
               '系统已接收你的指令并开始执行。这条执行链路涉及多个自动化流程的联动，' +
               '中途中断会导致数据不一致和级联故障。\n\n' +
               '⏳ 请等待执行完成。完成后你会看到完整的执行结果。\n\n' +
               '如果你对结果不满意，可以说「前面的没想好，我们重新来」——' +
               '系统会在已有结果的基础上重新迭代，而不是撤回已执行的操作。'
      });
    }
  }

  next();
}

module.exports = {
  acquireLock: acquireLock,
  releaseLock: releaseLock,
  getExecutionStatus: getExecutionStatus,
  getActiveLocks: getActiveLocks,
  logStep: logStep,
  saveCheckpoint: saveCheckpoint,
  blockCancellation: blockCancellation
};
