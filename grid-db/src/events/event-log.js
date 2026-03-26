// grid-db/src/events/event-log.js
// Grid-DB · 事件溯源日志
// 不可变事件流 + 审计日志
// PRJ-GDB-001 · Phase 0（基础结构，P1 完善回放与订阅）
// 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

/**
 * EventLog — 事件溯源日志
 *
 * 每次写操作生成不可变 Event，可被天眼订阅实现实时审计。
 *
 * 本体论锚定：事件日志 = 笔的笔迹记录。
 * 每写一笔，笔迹就留在了历史中，不可篡改。
 * 天眼通过观察笔迹，发现异常行为。
 *
 * Phase 0：内存事件流（保留最近 1000 条）
 * Phase 1：持久化事件流 + 回放 + 订阅
 */
class EventLog {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEvents]  最大保留事件数
   */
  constructor(options = {}) {
    this._maxEvents = options.maxEvents || 1000;
    this._events = [];
    this._subscribers = [];
    this._seqNo = 0;
  }

  /**
   * 记录事件
   * @param {string} namespace   命名空间
   * @param {string} operation   操作类型 (put | delete | scan)
   * @param {string} gridCellKey 格点键
   * @param {object} [payload]   额外数据
   * @returns {object} 事件对象
   */
  append(namespace, operation, gridCellKey, payload = null) {
    this._seqNo++;
    const event = {
      eventId: `evt-${randomUUID().slice(0, 12)}`,
      seqNo: this._seqNo,
      timestamp: new Date().toISOString(),
      namespace,
      operation,
      gridCellKey,
      payload
    };

    this._events.push(event);

    // 容量控制
    if (this._events.length > this._maxEvents) {
      this._events = this._events.slice(-this._maxEvents);
    }

    // 通知订阅者
    for (const sub of this._subscribers) {
      try {
        sub.handler(event);
      } catch {
        // 订阅者错误不阻断主流程
      }
    }

    return event;
  }

  /**
   * 获取最近 N 条事件
   * @param {number} [n]
   * @returns {object[]}
   */
  getRecent(n = 20) {
    return this._events.slice(-n);
  }

  /**
   * 按命名空间过滤事件
   * @param {string} namespace
   * @param {number} [limit]
   * @returns {object[]}
   */
  getByNamespace(namespace, limit = 50) {
    return this._events
      .filter(e => e.namespace === namespace)
      .slice(-limit);
  }

  /**
   * 订阅事件流（Phase 0 简版，P1 支持持久订阅）
   * @param {string} subscriberId
   * @param {Function} handler
   * @returns {Function} 取消订阅函数
   */
  subscribe(subscriberId, handler) {
    const sub = { id: subscriberId, handler };
    this._subscribers.push(sub);
    return () => {
      this._subscribers = this._subscribers.filter(s => s.id !== subscriberId);
    };
  }

  /**
   * 获取事件日志状态
   * @returns {object}
   */
  getStatus() {
    return {
      totalEvents: this._events.length,
      maxEvents: this._maxEvents,
      seqNo: this._seqNo,
      subscriberCount: this._subscribers.length
    };
  }
}

module.exports = EventLog;
