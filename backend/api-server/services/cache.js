/**
 * 简单内存缓存服务
 *
 * 用于减少重复 API 调用，可配置 TTL。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var DEFAULT_TTL = 5 * 60 * 1000; // 5分钟

var store = new Map();

function get(key) {
  var item = store.get(key);
  if (!item) return null;
  if (Date.now() - item.time >= (item.ttl || DEFAULT_TTL)) {
    store.delete(key);
    return null;
  }
  return item.data;
}

function set(key, data, ttl) {
  store.set(key, {
    data: data,
    time: Date.now(),
    ttl: ttl || DEFAULT_TTL
  });
}

function del(key) {
  store.delete(key);
}

function clear() {
  store.clear();
}

function stats() {
  return {
    size: store.size,
    keys: Array.from(store.keys())
  };
}

module.exports = {
  get: get,
  set: set,
  del: del,
  clear: clear,
  stats: stats
};
