/**
 * ═══════════════════════════════════════════════════════════
 * 内置数据源管理 · Built-in Source Manager
 * ═══════════════════════════════════════════════════════════
 *
 * 当外部数据源服务 (FQWeb/SwiftCat) 不可用时，
 * 使用内置直连适配器绕过依赖。
 *
 * 内置源:
 *   1. fanqie-direct — 番茄小说 Web API 直连
 *   2. biquge-direct — 笔趣阁/69书吧聚合直连（海外IP友好）
 *
 * 架构:
 *   searchAllSources() → 先尝试外部服务 → 失败 → 启用内置直连
 *   biquge-direct 始终参与搜索（不依赖外部服务状态）
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fanqieDirect = require('./fanqie-direct');
let biqugeDirect = null;
try {
  biqugeDirect = require('./biquge-direct');
} catch (err) {
  console.warn(`[builtin-source] ⚠️ biquge-direct 加载失败: ${err.message}`);
}

/**
 * 内置搜索（当外部数据源不可达时的fallback）
 * biquge-direct 始终参与搜索（海外可达的免费源）
 * @param {string} query - 搜索关键词
 * @returns {Promise<{results: Array, statuses: Array}>}
 */
async function builtinSearch(query) {
  const results = [];
  const statuses = [];

  // 并发搜索所有内置源
  const searches = [];

  // 番茄小说直连搜索
  searches.push(
    (async () => {
      try {
        const books = await fanqieDirect.search(query, 0);
        results.push(...books);
        statuses.push({
          id: 'fanqie-direct',
          name: '番茄小说(直连)',
          status: 'ok',
          count: books.length
        });
      } catch (err) {
        statuses.push({
          id: 'fanqie-direct',
          name: '番茄小说(直连)',
          status: 'error',
          count: 0,
          error: err.message
        });
      }
    })()
  );

  // 笔趣阁/69书吧聚合搜索（海外IP友好）
  if (biqugeDirect) {
    searches.push(
      (async () => {
        try {
          const { results: bqResults, errors } = await biqugeDirect.search(query);
          results.push(...bqResults);
          statuses.push({
            id: 'biquge-direct',
            name: '笔趣阁聚合(直连)',
            status: bqResults.length > 0 ? 'ok' : (errors.length > 0 ? 'error' : 'empty'),
            count: bqResults.length,
            error: errors.length > 0 ? errors.map(e => e.error).join('; ') : undefined
          });
        } catch (err) {
          statuses.push({
            id: 'biquge-direct',
            name: '笔趣阁聚合(直连)',
            status: 'error',
            count: 0,
            error: err.message
          });
        }
      })()
    );
  }

  await Promise.allSettled(searches);

  return { results, statuses };
}

/**
 * 内置下载
 * @param {string} source - 数据源ID (fanqie / shu69)
 * @param {string} bookId - 书籍ID
 * @param {string} title - 书名
 * @param {string} author - 作者
 * @param {function} onProgress - 进度回调
 * @returns {Promise<string>} 完整内容
 */
async function builtinDownload(source, bookId, title, author, onProgress) {
  if (source === 'fanqie') {
    return fanqieDirect.downloadBook(bookId, title, author, onProgress);
  }

  if (source === 'shu69' && biqugeDirect) {
    return biqugeDirect.downloadBook(bookId, title, author, onProgress);
  }

  throw new Error(`内置直连暂不支持数据源: ${source}。当前支持: fanqie, shu69`);
}

/**
 * 获取内置源的章节目录（用于在线阅读）
 */
async function builtinGetCatalog(source, bookId) {
  if (source === 'fanqie') {
    return fanqieDirect.getCatalog(bookId);
  }
  if (source === 'shu69' && biqugeDirect) {
    return biqugeDirect.getCatalog(bookId);
  }
  throw new Error(`不支持的数据源: ${source}`);
}

/**
 * 获取单章内容（用于在线阅读）
 */
async function builtinGetChapter(source, itemId, bookId) {
  if (source === 'fanqie') {
    return fanqieDirect.getChapterContent(itemId);
  }
  if (source === 'shu69' && biqugeDirect) {
    return biqugeDirect.getChapterContent(bookId, itemId);
  }
  throw new Error(`不支持的数据源: ${source}`);
}

/**
 * 健康检查所有内置源
 */
async function healthCheckAll() {
  const checks = [];
  const promises = [];

  promises.push(
    (async () => {
      try {
        checks.push(await fanqieDirect.healthCheck());
      } catch (err) {
        checks.push({
          source: 'fanqie-direct',
          name: '番茄小说(直连)',
          reachable: false,
          error: err.message
        });
      }
    })()
  );

  if (biqugeDirect) {
    promises.push(
      (async () => {
        try {
          checks.push(await biqugeDirect.healthCheck());
        } catch (err) {
          checks.push({
            source: 'biquge-direct',
            name: '笔趣阁聚合(直连)',
            reachable: false,
            error: err.message
          });
        }
      })()
    );
  }

  await Promise.allSettled(promises);
  return checks;
}

module.exports = {
  builtinSearch,
  builtinDownload,
  builtinGetCatalog,
  builtinGetChapter,
  healthCheckAll,
  fanqieDirect,
  biqugeDirect
};
