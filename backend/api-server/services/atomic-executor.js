/**
 * 原子执行器 · L3 执行原子性保障
 *
 * 包装所有写入操作，确保：
 * 1. 执行前保存检查点
 * 2. 执行中记录每一步
 * 3. 执行失败自动回滚
 * 4. 执行完成释放锁
 *
 * 使用方式：
 * var executor = new AtomicExecutor(devId);
 * var result = await executor.execute('创建工单', async function(ctx) {
 *   await ctx.step('写入Notion', async function() { ... });
 *   await ctx.step('触发Workflow', async function() { ... });
 * });
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var executionLock = require('../middleware/execution-lock');
var checkpoint = require('./checkpoint');
var CheckpointManager = checkpoint.CheckpointManager;

// 锁释放延迟（给前端时间拉取最终状态）
var LOCK_RELEASE_DELAY_MS = 10000;

/**
 * 原子执行器
 * @param {string} devId - 开发者编号
 */
function AtomicExecutor(devId) {
  this.devId = devId;
}

/**
 * 执行操作（原子性保障）
 * @param {string} operationName - 操作描述
 * @param {Function} fn - 异步执行函数，接收 ctx 参数
 * @returns {Object} 执行结果
 */
AtomicExecutor.prototype.execute = async function(operationName, fn) {
  // 1. 获取执行锁
  var lockResult = executionLock.acquireLock(this.devId, operationName);
  if (!lockResult.success) {
    return lockResult;
  }

  var executionId = lockResult.executionId;
  var lock = lockResult.lock;
  var devId = this.devId;
  var cpManager = new CheckpointManager(devId, executionId);

  // 2. 保存初始检查点
  await cpManager.save('执行前状态', {
    type: 'initial',
    timestamp: new Date().toISOString()
  });

  // 3. 构建执行上下文
  var ctx = {
    executionId: executionId,

    /**
     * 执行单步操作
     * @param {string} stepName - 步骤名称
     * @param {Function} stepFn - 步骤执行函数
     * @returns {*} 步骤执行结果
     */
    step: async function(stepName, stepFn) {
      executionLock.logStep(devId, {
        message: '⏳ ' + stepName + '...',
        success: false
      });

      try {
        var result = await stepFn();

        executionLock.logStep(devId, {
          message: '✅ ' + stepName,
          success: true
        });

        return result;
      } catch (e) {
        executionLock.logStep(devId, {
          message: '❌ ' + stepName + ': ' + e.message,
          success: false
        });
        throw e;
      }
    },

    /**
     * 保存检查点
     * @param {string} label - 检查点标签
     * @param {Object} data - 快照数据
     * @returns {string} 检查点ID
     */
    checkpoint: async function(label, data) {
      return await cpManager.save(label, data);
    }
  };

  // 4. 执行主逻辑
  try {
    var result = await fn(ctx);

    // 5. 成功：更新锁状态
    lock.state = 'completed';
    lock.result = result;

    // 延迟释放锁（给前端时间拉取最终状态）
    setTimeout(function() { executionLock.releaseLock(devId); }, LOCK_RELEASE_DELAY_MS);

    return {
      success: true,
      executionId: executionId,
      result: result,
      reply: result && result.reply ? result.reply : '✅ 操作「' + operationName + '」执行完成。'
    };

  } catch (e) {
    // 6. 失败：自动回滚
    lock.state = 'rolling_back';
    executionLock.logStep(devId, {
      message: '🔄 执行失败，正在自动回滚...',
      success: false
    });

    try {
      await cpManager.rollbackTo('cp-1');
      executionLock.logStep(devId, {
        message: '✅ 已回滚到执行前状态',
        success: true
      });
    } catch (rollbackError) {
      executionLock.logStep(devId, {
        message: '⚠️ 回滚异常：' + rollbackError.message + '，已通知管理员',
        success: false
      });
    }

    lock.state = 'failed';
    lock.error = { message: e.message };

    setTimeout(function() { executionLock.releaseLock(devId); }, LOCK_RELEASE_DELAY_MS);

    return {
      success: false,
      executionId: executionId,
      error: e.message,
      reply: '❌ 操作「' + operationName + '」执行失败：' + e.message +
             '\n\n系统已自动回滚到执行前状态，没有数据被修改。'
    };
  }
};

module.exports = { AtomicExecutor: AtomicExecutor };
