/**
 * 任务执行器 · TaskRunner
 * GH-GMP-005 · M3 · Agent Engine
 *
 * 核心职责：
 * 1. 协调Dispatcher + PersonaLoader + ReceiptGen + NotionSync
 * 2. 管理工单处理的完整生命周期
 * 3. 并发控制 · 重试 · 错误恢复
 *
 * 执行流程：
 *   Poller检测新工单 → TaskRunner.enqueue(ticket)
 *       → 并发控制（同时只处理1张工单）
 *       → Dispatcher.processTicket(ticket)
 *       → 结果写回Notion
 *       → 下一张工单
 */

'use strict';

const MODULE_NAME = 'task-runner';

/**
 * 默认配置
 */
const DEFAULTS = {
  maxConcurrency: 1,      // 同时处理的最大工单数
  maxRetries: 1,          // 单张工单最大重试次数
  retryDelayMs: 5000,     // 重试间隔
  processTimeoutMs: 300000, // 单张工单处理超时（5分钟）
};

class TaskRunner {
  /**
   * @param {object} opts
   * @param {import('./dispatcher')} opts.dispatcher
   * @param {object} [opts.config] - 覆盖默认配置
   * @param {object} [opts.logger]
   */
  constructor(opts) {
    this.dispatcher = opts.dispatcher;
    this.logger = opts.logger || console;
    this.config = { ...DEFAULTS, ...(opts.config || {}) };

    // 队列
    this._queue = [];
    this._processing = 0;
    this._isRunning = false;

    // 统计
    this._stats = {
      enqueued: 0,
      completed: 0,
      failed: 0,
      retried: 0,
    };

    // 结果历史（最近20条）
    this._history = [];
  }

  /**
   * 入队一张工单
   * @param {object} ticket
   */
  enqueue(ticket) {
    const ticketId = ticket['编号'] || ticket['任务标题'] || ticket.pageId;

    // 检查是否已在队列或正在处理中
    const isDuplicate = this._queue.some(
      (item) => item.ticket.pageId === ticket.pageId
    );
    if (isDuplicate) {
      this.logger.info('[' + MODULE_NAME + '] 跳过重复工单 · ' + ticketId);
      return;
    }

    this._queue.push({
      ticket,
      retryCount: 0,
      enqueuedAt: Date.now(),
    });
    this._stats.enqueued++;

    this.logger.info(
      '[' + MODULE_NAME + '] 入队 · ' + ticketId +
      ' · 队列长度: ' + this._queue.length
    );

    // 尝试处理
    this._tryProcess();
  }

  /**
   * 处理工单更新事件
   * @param {object} ticket - 更新后的工单
   */
  async handleUpdate(ticket) {
    const ticketId = ticket['编号'] || ticket['任务标题'] || ticket.pageId;
    this.logger.info('[' + MODULE_NAME + '] 工单更新 · ' + ticketId + ' · 状态=' + ticket['状态']);

    // 目前只记录日志，不做额外处理
    // 未来可以在这里处理：审核结果回填 → 触发下一轮开发
  }

  /**
   * 启动任务执行器
   */
  start() {
    this._isRunning = true;
    this.logger.info(
      '[' + MODULE_NAME + '] 启动 · 最大并发: ' + this.config.maxConcurrency
    );
  }

  /**
   * 停止任务执行器（等待当前任务完成）
   */
  async stop() {
    this._isRunning = false;
    this.logger.info(
      '[' + MODULE_NAME + '] 停止中 · 等待 ' + this._processing + ' 个任务完成'
    );
    // 等待当前处理中的任务完成
    while (this._processing > 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
    this.logger.info('[' + MODULE_NAME + '] 已停止');
  }

  // ─── 内部方法 ───

  /**
   * 尝试从队列中取出并处理工单
   */
  async _tryProcess() {
    if (!this._isRunning) return;
    if (this._processing >= this.config.maxConcurrency) return;
    if (this._queue.length === 0) return;

    const item = this._queue.shift();
    this._processing++;

    try {
      await this._processItem(item);
    } finally {
      this._processing--;
      // 处理完一个，继续尝试下一个
      if (this._queue.length > 0) {
        // 用setImmediate避免调用栈过深
        setImmediate(() => this._tryProcess());
      }
    }
  }

  /**
   * 处理单个队列项（含超时和重试）
   */
  async _processItem(item) {
    const { ticket, retryCount } = item;
    const ticketId = ticket['编号'] || ticket['任务标题'] || ticket.pageId;

    try {
      // 带超时执行
      const result = await this._withTimeout(
        this.dispatcher.processTicket(ticket),
        this.config.processTimeoutMs
      );

      // 记录结果
      this._recordResult(ticketId, result);

      if (result.status === 'processed') {
        this._stats.completed++;
        this.logger.info(
          '[' + MODULE_NAME + '] ✅ 处理完成 · ' + ticketId +
          ' · Agent: ' + result.agent
        );
      } else if (result.status === 'skipped') {
        this.logger.info(
          '[' + MODULE_NAME + '] ⏭️ 跳过 · ' + ticketId +
          ' · ' + result.reason
        );
      } else if (result.status === 'failed') {
        // 检查是否需要重试
        if (retryCount < this.config.maxRetries) {
          this._stats.retried++;
          this.logger.warn(
            '[' + MODULE_NAME + '] 🔄 重试 · ' + ticketId +
            ' · 第' + (retryCount + 1) + '次 · ' + result.reason
          );
          // 延迟后重新入队
          await new Promise((r) => setTimeout(r, this.config.retryDelayMs));
          this._queue.push({
            ticket,
            retryCount: retryCount + 1,
            enqueuedAt: Date.now(),
          });
        } else {
          this._stats.failed++;
          this.logger.error(
            '[' + MODULE_NAME + '] ❌ 最终失败 · ' + ticketId +
            ' · 重试' + retryCount + '次后放弃 · ' + result.reason
          );
        }
      }
    } catch (err) {
      this._stats.failed++;
      this._recordResult(ticketId, { status: 'error', reason: err.message });
      this.logger.error(
        '[' + MODULE_NAME + '] ❌ 异常 · ' + ticketId + ' · ' + err.message
      );
    }
  }

  /**
   * 带超时的Promise执行
   */
  _withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('处理超时 (' + timeoutMs + 'ms)'));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * 记录处理结果到历史
   */
  _recordResult(ticketId, result) {
    this._history.push({
      ticketId,
      ...result,
      timestamp: new Date().toISOString(),
    });
    // 保留最近20条
    if (this._history.length > 20) {
      this._history.shift();
    }
  }

  get stats() {
    return {
      ...this._stats,
      queueLength: this._queue.length,
      processing: this._processing,
      isRunning: this._isRunning,
    };
  }

  get history() {
    return [...this._history];
  }
}

module.exports = TaskRunner;
