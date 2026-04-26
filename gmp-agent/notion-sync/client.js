/**
 * Notion API 客户端封装
 * GH-GMP-005 · M1 · Notion Sync Layer
 *
 * 封装 @notionhq/client，增加重试、退避、日志
 * Token 从环境变量 GH_NOTION_TOKEN 读取
 */

'use strict';

const { Client } = require('@notionhq/client');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const REQUEST_TIMEOUT_MS = 30000;

class NotionSyncClient {
  /**
   * @param {object} opts
   * @param {string} [opts.token] - Notion API token, defaults to env GH_NOTION_TOKEN
   * @param {object} [opts.logger] - Logger with info/warn/error methods
   */
  constructor(opts = {}) {
    const token = opts.token || process.env.GH_NOTION_TOKEN;
    if (!token) {
      throw new Error('[notion-sync/client] GH_NOTION_TOKEN 未配置');
    }
    this.client = new Client({
      auth: token,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    this.logger = opts.logger || console;
    this._requestCount = 0;
    this._errorCount = 0;
  }

  // ─── 数据库操作 ───

  /**
   * 查询数据库
   * @param {string} databaseId
   * @param {object} [filter]
   * @param {Array}  [sorts]
   * @param {string} [startCursor]
   * @returns {Promise<{results: Array, hasMore: boolean, nextCursor: string|null}>}
   */
  async queryDatabase(databaseId, filter, sorts, startCursor) {
    const params = { database_id: databaseId };
    if (filter) params.filter = filter;
    if (sorts) params.sorts = sorts;
    if (startCursor) params.start_cursor = startCursor;
    const resp = await this._retry(() => this.client.databases.query(params));
    return {
      results: resp.results,
      hasMore: resp.has_more,
      nextCursor: resp.next_cursor,
    };
  }

  /**
   * 查询数据库全部结果（自动分页）
   */
  async queryDatabaseAll(databaseId, filter, sorts) {
    const all = [];
    let cursor = undefined;
    do {
      const { results, hasMore, nextCursor } = await this.queryDatabase(
        databaseId, filter, sorts, cursor
      );
      all.push(...results);
      cursor = hasMore ? nextCursor : undefined;
    } while (cursor);
    return all;
  }

  // ─── 页面操作 ───

  async getPage(pageId) {
    return this._retry(() => this.client.pages.retrieve({ page_id: pageId }));
  }

  async updatePage(pageId, properties) {
    return this._retry(() =>
      this.client.pages.update({ page_id: pageId, properties })
    );
  }

  // ─── 块操作（页面内容读写）───

  /**
   * 读取页面所有子块（自动分页）
   */
  async getBlockChildren(blockId) {
    const all = [];
    let cursor = undefined;
    do {
      const resp = await this._retry(() =>
        this.client.blocks.children.list({
          block_id: blockId,
          start_cursor: cursor,
          page_size: 100,
        })
      );
      all.push(...resp.results);
      cursor = resp.has_more ? resp.next_cursor : undefined;
    } while (cursor);
    return all;
  }

  /**
   * 追加子块到页面末尾
   * @param {string} blockId
   * @param {Array} children - Notion block objects
   */
  async appendBlockChildren(blockId, children) {
    // Notion API 每次最多100个块
    const BATCH = 100;
    for (let i = 0; i < children.length; i += BATCH) {
      const batch = children.slice(i, i + BATCH);
      await this._retry(() =>
        this.client.blocks.children.append({
          block_id: blockId,
          children: batch,
        })
      );
    }
  }

  // ─── 搜索 ───

  async search(query, filter) {
    const params = {};
    if (query) params.query = query;
    if (filter) params.filter = filter;
    return this._retry(() => this.client.search(params));
  }

  // ─── 健康检查 ───

  async healthCheck() {
    try {
      // 用 search 空查询验证 token 有效性
      await this.client.search({ query: '', page_size: 1 });
      return { ok: true, requestCount: this._requestCount, errorCount: this._errorCount };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ─── 内部：重试逻辑 ───

  async _retry(fn) {
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        this._requestCount++;
        return await fn();
      } catch (err) {
        lastErr = err;
        this._errorCount++;
        const status = err.status || err.code;

        // 429 Rate Limit → 指数退避重试
        if (status === 429 || status === 'ECONNRESET' || status === 'ETIMEDOUT') {
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
          const retryAfter = err.headers && err.headers['retry-after']
            ? parseInt(err.headers['retry-after'], 10) * 1000
            : delay;
          this.logger.warn(
            `[notion-sync/client] ${status} · 重试 ${attempt + 1}/${MAX_RETRIES} · 等待 ${retryAfter}ms`
          );
          await this._sleep(retryAfter);
          continue;
        }

        // 5xx → 重试
        if (status >= 500 && status < 600) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          this.logger.warn(
            `[notion-sync/client] ${status} · 重试 ${attempt + 1}/${MAX_RETRIES} · 等待 ${delay}ms`
          );
          await this._sleep(delay);
          continue;
        }

        // 4xx 非429 → 不重试
        throw err;
      }
    }
    throw lastErr;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get stats() {
    return { requestCount: this._requestCount, errorCount: this._errorCount };
  }
}

module.exports = NotionSyncClient;
