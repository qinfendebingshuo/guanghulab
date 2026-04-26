/**
 * 简单 TTL 缓存
 * GH-GMP-005 · M1 · Notion Sync Layer
 *
 * 用于缓存人格页面、工单内容等，减少Notion API调用
 */

'use strict';

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10分钟
const DEFAULT_MAX_SIZE = 200;

class TTLCache {
  /**
   * @param {object} [opts]
   * @param {number} [opts.ttlMs] - 缓存过期时间
   * @param {number} [opts.maxSize] - 最大缓存条目数
   */
  constructor(opts = {}) {
    this.ttlMs = opts.ttlMs || DEFAULT_TTL_MS;
    this.maxSize = opts.maxSize || DEFAULT_MAX_SIZE;
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > this.ttlMs) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    // LRU-ish: 超过容量时删除最旧的
    if (this._store.size >= this.maxSize) {
      const oldest = this._store.keys().next().value;
      this._store.delete(oldest);
    }
    this._store.set(key, { value, ts: Date.now() });
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }

  get size() {
    // 清理过期
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now - v.ts > this.ttlMs) this._store.delete(k);
    }
    return this._store.size;
  }

  get stats() {
    return {
      size: this.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}

module.exports = TTLCache;
