/**
 * 工单轮询器
 * GH-GMP-005 · M1 · Notion Sync Layer
 *
 * 定时轮询工单数据库，检测新工单和状态变更
 * 维护 lastCheckedTime + processedSet 避免重复处理
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_INTERVAL_MS = 30000; // 30秒
const STATE_FILE = 'poller-state.json';

class TicketPoller {
  /**
   * @param {object} opts
   * @param {import('./db-reader')} opts.dbReader
   * @param {function} opts.onNewTicket - async (ticket) => void
   * @param {function} [opts.onUpdatedTicket] - async (ticket) => void
   * @param {number} [opts.intervalMs]
   * @param {string} [opts.stateDir] - 持久化状态文件目录
   * @param {object} [opts.logger]
   */
  constructor(opts) {
    this.dbReader = opts.dbReader;
    this.onNewTicket = opts.onNewTicket;
    this.onUpdatedTicket = opts.onUpdatedTicket || null;
    this.intervalMs = opts.intervalMs || DEFAULT_INTERVAL_MS;
    this.stateDir = opts.stateDir || process.cwd();
    this.logger = opts.logger || console;

    this._timer = null;
    this._running = false;
    this._pollCount = 0;

    // 持久化状态
    this._lastCheckedTime = null;
    this._processedSet = new Set(); // pageId集合

    this._loadState();
  }

  start() {
    if (this._running) {
      this.logger.warn('[poller] 已在运行中，忽略重复启动');
      return;
    }
    this._running = true;
    this.logger.info(
      `[poller] 启动轮询 · 间隔 ${this.intervalMs}ms · 上次检查 ${this._lastCheckedTime || '无'}`
    );
    // 立即执行一次
    this._poll();
    this._timer = setInterval(() => this._poll(), this.intervalMs);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    this._saveState();
    this.logger.info(`[poller] 已停止 · 共轮询 ${this._pollCount} 次`);
  }

  get isRunning() {
    return this._running;
  }

  get stats() {
    return {
      running: this._running,
      pollCount: this._pollCount,
      processedCount: this._processedSet.size,
      lastCheckedTime: this._lastCheckedTime,
    };
  }

  // ─── 内部 ───

  async _poll() {
    try {
      this._pollCount++;

      // 策略1：查询待开发且有负责Agent的工单
      const pending = await this.dbReader.queryPendingTickets();
      for (const ticket of pending) {
        if (!this._processedSet.has(ticket.pageId)) {
          this.logger.info(
            `[poller] 🆕 新工单 · ${ticket['编号'] || ticket['任务标题']} · ${ticket['负责Agent']}`
          );
          this._processedSet.add(ticket.pageId);
          try {
            await this.onNewTicket(ticket);
          } catch (err) {
            this.logger.error(
              `[poller] 处理新工单失败 · ${ticket['编号']} · ${err.message}`
            );
            // 从processed中移除，下轮重试
            this._processedSet.delete(ticket.pageId);
          }
        }
      }

      // 策略2：检测最近变更的工单（如果有回调）
      if (this.onUpdatedTicket && this._lastCheckedTime) {
        const updated = await this.dbReader.queryUpdatedSince(this._lastCheckedTime);
        for (const ticket of updated) {
          // 跳过已在本轮处理过的新工单
          if (pending.some((p) => p.pageId === ticket.pageId)) continue;
          try {
            await this.onUpdatedTicket(ticket);
          } catch (err) {
            this.logger.error(
              `[poller] 处理更新工单失败 · ${ticket['编号']} · ${err.message}`
            );
          }
        }
      }

      this._lastCheckedTime = new Date().toISOString();

      // 定期持久化（每10次）
      if (this._pollCount % 10 === 0) {
        this._saveState();
      }
    } catch (err) {
      this.logger.error(`[poller] 轮询异常 · ${err.message}`);
    }
  }

  _loadState() {
    try {
      const fp = path.join(this.stateDir, STATE_FILE);
      if (fs.existsSync(fp)) {
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        this._lastCheckedTime = data.lastCheckedTime || null;
        this._processedSet = new Set(data.processedIds || []);
        this.logger.info(
          `[poller] 加载持久化状态 · ${this._processedSet.size} 条已处理记录`
        );
      }
    } catch (err) {
      this.logger.warn(`[poller] 加载状态失败 · ${err.message}`);
    }
  }

  _saveState() {
    try {
      const fp = path.join(this.stateDir, STATE_FILE);
      const data = {
        lastCheckedTime: this._lastCheckedTime,
        processedIds: Array.from(this._processedSet),
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`[poller] 保存状态失败 · ${err.message}`);
    }
  }
}

module.exports = TicketPoller;
