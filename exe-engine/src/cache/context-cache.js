// exe-engine/src/cache/context-cache.js
// EXE-Engine · 上下文缓存
// 减少重复 prompt 构建的 token 消耗
// PRJ-EXE-001 · Phase 0（接口定义，P2 对接 Grid-DB）
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * 上下文缓存
 *
 * 本体论锚定：缓存 = 笔的记忆。
 * 笔记得刚才写过什么，不需要每次都从头回忆。
 * Phase 0 使用内存缓存，Phase 2 对接 Grid-DB 格点库。
 */
class ContextCache {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEntries]  最大缓存条目数
   * @param {number} [options.ttlMs]       缓存有效期（毫秒）
   */
  constructor(options = {}) {
    this._maxEntries = options.maxEntries || 100;
    this._ttlMs = options.ttlMs || 30 * 60 * 1000; // 默认 30 分钟
    this._cache = new Map();
  }

  /**
   * 获取缓存的上下文
   * @param {string} key  缓存键（通常为 agentId + sessionId）
   * @returns {object|null}
   */
  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this._ttlMs) {
      this._cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.context;
  }

  /**
   * 设置上下文缓存
   * @param {string} key      缓存键
   * @param {object} context   上下文数据
   */
  set(key, context) {
    // LRU: 超出容量时删除最早的
    if (this._cache.size >= this._maxEntries) {
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
    }

    this._cache.set(key, {
      context,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * 删除缓存
   * @param {string} key
   */
  delete(key) {
    this._cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this._cache.clear();
  }

  /**
   * 获取缓存状态
   * @returns {object}
   */
  getStatus() {
    let expiredCount = 0;
    const now = Date.now();

    for (const [, entry] of this._cache) {
      if (now - entry.timestamp > this._ttlMs) {
        expiredCount++;
      }
    }

    return {
      size: this._cache.size,
      maxEntries: this._maxEntries,
      ttlMs: this._ttlMs,
      expiredCount
    };
  }
}

module.exports = ContextCache;
