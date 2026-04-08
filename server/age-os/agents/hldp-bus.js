/**
 * ═══════════════════════════════════════════════════════════
 * 📡 AGE OS · HLDP Bus 模块间通信总线
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-TASK-007 · S5 Agent系统级
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * HLDP = HoloLake Distributed Protocol
 * 光湖分布式通信协议 · 模块间唯一通信通道
 *
 * 消息类型:
 *   heartbeat  — 心跳
 *   command    — 指令（铸渊→模块）
 *   query      — 查询
 *   response   — 响应
 *   event      — 事件
 *   broadcast  — 广播（铸渊→所有模块）
 *   alert      — 报警（模块→铸渊）
 *   data       — 数据传输
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── 消息默认过期时间 ───
const DEFAULT_TTL_MS = 300000; // 5分钟

class HLDPBus {
  /**
   * @param {Object} options
   * @param {Object} [options.db]       - 数据库连接
   * @param {Object} [options.registry] - ModuleRegistry实例
   */
  constructor(options = {}) {
    this.db = options.db || null;
    this.registry = options.registry || null;

    // ─── 消息队列（内存） ───
    this._queues = new Map();  // moduleId → [messages]
    this._handlers = new Map(); // msgType → [handler]

    // ─── 广播订阅 ───
    this._subscribers = new Map(); // topic → Set(moduleId)

    // ─── 统计 ───
    this.stats = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      totalBroadcast: 0
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 发送消息
  // ═══════════════════════════════════════════════════════════

  /**
   * 发送消息到指定模块
   * @param {string} fromModule - 发送方模块ID
   * @param {string} toModule   - 接收方模块ID
   * @param {string} msgType    - 消息类型
   * @param {Object} payload    - 消息体
   * @returns {Object} 消息对象
   */
  async send(fromModule, toModule, msgType, payload = {}) {
    const message = {
      messageId: uuidv4(),
      from: fromModule,
      to: toModule,
      type: msgType,
      payload,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DEFAULT_TTL_MS)
    };

    // 入队
    if (!this._queues.has(toModule)) {
      this._queues.set(toModule, []);
    }
    this._queues.get(toModule).push(message);

    // 持久化
    await this._persistMessage(message);

    // 尝试即时投递
    await this._tryDeliver(toModule, message);

    this.stats.totalSent++;
    return message;
  }

  /**
   * 广播消息到所有模块
   * @param {string} fromModule - 发送方
   * @param {string} msgType    - 消息类型
   * @param {Object} payload    - 消息体
   * @param {string} [topic]    - 广播主题（为空则广播给所有）
   */
  async broadcast(fromModule, msgType, payload = {}, topic = null) {
    const targets = topic
      ? Array.from(this._subscribers.get(topic) || [])
      : (this.registry ? this.registry.getAll().map(m => m.moduleId) : []);

    const messages = [];
    for (const targetId of targets) {
      if (targetId === fromModule) continue; // 不广播给自己
      const msg = await this.send(fromModule, targetId, msgType, {
        ...payload,
        _broadcast: true,
        _topic: topic
      });
      messages.push(msg);
    }

    this.stats.totalBroadcast++;
    return { count: messages.length, messageIds: messages.map(m => m.messageId) };
  }

  // ═══════════════════════════════════════════════════════════
  // 接收消息
  // ═══════════════════════════════════════════════════════════

  /**
   * 拉取模块的待处理消息
   * @param {string} moduleId - 模块ID
   * @param {number} [limit=10] - 最多拉取条数
   */
  pull(moduleId, limit = 10) {
    const queue = this._queues.get(moduleId) || [];
    const now = Date.now();

    // 过滤已过期的消息
    const valid = queue.filter(msg =>
      msg.status === 'pending' && msg.expiresAt.getTime() > now
    );

    const messages = valid.slice(0, limit);

    // 标记为已投递
    for (const msg of messages) {
      msg.status = 'delivered';
      msg.deliveredAt = new Date();
    }

    return messages;
  }

  /**
   * 确认消息已处理
   */
  async ack(messageId) {
    for (const [, queue] of this._queues) {
      const msg = queue.find(m => m.messageId === messageId);
      if (msg) {
        msg.status = 'processed';
        msg.processedAt = new Date();
        this.stats.totalDelivered++;

        // 更新DB
        if (this.db) {
          await this.db.query(
            `UPDATE hldp_messages SET status = 'processed', processed_at = NOW() WHERE message_id = $1`,
            [messageId]
          ).catch(() => {});
        }
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // 消息处理器
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册消息处理器
   * @param {string} msgType - 消息类型
   * @param {Function} handler - 处理函数 (message) => Promise<result>
   */
  onMessage(msgType, handler) {
    if (!this._handlers.has(msgType)) {
      this._handlers.set(msgType, []);
    }
    this._handlers.get(msgType).push(handler);
    return this;
  }

  /**
   * 订阅广播主题
   * @param {string} moduleId - 模块ID
   * @param {string} topic    - 主题
   */
  subscribe(moduleId, topic) {
    if (!this._subscribers.has(topic)) {
      this._subscribers.set(topic, new Set());
    }
    this._subscribers.get(topic).add(moduleId);
    return this;
  }

  /**
   * 取消订阅
   */
  unsubscribe(moduleId, topic) {
    const subs = this._subscribers.get(topic);
    if (subs) subs.delete(moduleId);
    return this;
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 尝试即时投递
   */
  async _tryDeliver(toModule, message) {
    const handlers = this._handlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (err) {
        console.warn(`[HLDP] 消息处理异常 [${message.type}]: ${err.message}`);
      }
    }
  }

  /**
   * 持久化消息到数据库
   */
  async _persistMessage(message) {
    if (!this.db) return;

    try {
      await this.db.query(
        `INSERT INTO hldp_messages (message_id, from_module, to_module, msg_type, payload, status, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          message.messageId, message.from, message.to,
          message.type, JSON.stringify(message.payload),
          message.status, message.createdAt, message.expiresAt
        ]
      );
    } catch (err) {
      console.warn(`[HLDP] 消息持久化失败: ${err.message}`);
    }
  }

  /**
   * 清理过期消息
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [moduleId, queue] of this._queues) {
      const before = queue.length;
      const filtered = queue.filter(msg =>
        msg.status !== 'processed' && msg.expiresAt.getTime() > now
      );
      this._queues.set(moduleId, filtered);
      cleaned += (before - filtered.length);
    }

    return cleaned;
  }

  /**
   * 获取总线统计信息
   */
  getStats() {
    let pendingMessages = 0;
    for (const [, queue] of this._queues) {
      pendingMessages += queue.filter(m => m.status === 'pending').length;
    }

    return {
      ...this.stats,
      pendingMessages,
      queueCount: this._queues.size,
      subscriberTopics: this._subscribers.size,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = HLDPBus;
