/**
 * ═══════════════════════════════════════════════════════════
 * 内置数据源管理 · Built-in Source Manager
 * ═══════════════════════════════════════════════════════════
 *
 * 当外部数据源服务 (FQWeb/SwiftCat) 不可用时，
 * 使用内置直连适配器绕过依赖。
 *
 * 架构:
 *   searchAllSources() → 先尝试外部服务 → 失败 → 启用内置直连
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fanqieDirect = require('./fanqie-direct');

/**
 * 内置搜索（当外部数据源不可达时的fallback）
 * @param {string} query - 搜索关键词
 * @returns {Promise<{results: Array, status: Object}>}
 */
async function builtinSearch(query) {
  const results = [];
  const statuses = [];

  // 番茄小说直连搜索
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

  return { results, statuses };
}

/**
 * 内置下载（直接从番茄小说获取章节内容）
 * @param {string} source - 数据源ID
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

  throw new Error(`内置直连暂不支持数据源: ${source}。当前支持: fanqie`);
}

/**
 * 获取内置源的章节目录（用于在线阅读）
 */
async function builtinGetCatalog(source, bookId) {
  if (source === 'fanqie') {
    return fanqieDirect.getCatalog(bookId);
  }
  throw new Error(`不支持的数据源: ${source}`);
}

/**
 * 获取单章内容（用于在线阅读）
 */
async function builtinGetChapter(source, itemId) {
  if (source === 'fanqie') {
    return fanqieDirect.getChapterContent(itemId);
  }
  throw new Error(`不支持的数据源: ${source}`);
}

/**
 * 健康检查所有内置源
 */
async function healthCheckAll() {
  const checks = [];

  try {
    const fq = await fanqieDirect.healthCheck();
    checks.push(fq);
  } catch (err) {
    checks.push({
      source: 'fanqie-direct',
      name: '番茄小说(直连)',
      reachable: false,
      error: err.message
    });
  }

  return checks;
}

module.exports = {
  builtinSearch,
  builtinDownload,
  builtinGetCatalog,
  builtinGetChapter,
  healthCheckAll,
  fanqieDirect
};
