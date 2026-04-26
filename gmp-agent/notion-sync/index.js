/**
 * Notion Sync Layer · 模块入口（完整实现）
 * GH-GMP-005 · M1 · Agent搬迁工程
 *
 * GMP标准模块接口 · init/start/stop/healthCheck
 * 对外暴露：client, dbReader, pageRW, poller, cache
 */

'use strict';

const NotionSyncClient = require('./client');
const DBReader = require('./db-reader');
const PageRW = require('./page-rw');
const TicketPoller = require('./poller');
const TTLCache = require('./cache');

const MODULE_NAME = 'notion-sync';
const MODULE_VERSION = '1.0.0';

let client = null;
let dbReader = null;
let pageRW = null;
let poller = null;
let cache = null;
let logger = console;

module.exports = {
  name: MODULE_NAME,
  version: MODULE_VERSION,
  type: 'service',

  /**
   * 初始化：创建Notion客户端，验证连接
   */
  async init(context) {
    logger = (context && context.logger) || console;
    logger.info(`[${MODULE_NAME}] 初始化中 v${MODULE_VERSION}...`);

    // 1. 创建客户端
    client = new NotionSyncClient({ logger });

    // 2. 验证Token有效性
    const health = await client.healthCheck();
    if (!health.ok) {
      throw new Error(`[${MODULE_NAME}] Notion API连接失败: ${health.error}`);
    }
    logger.info(`[${MODULE_NAME}] Notion API连接成功 ✅`);

    // 3. 读取工单数据库ID
    const dbId = process.env.GH_NOTION_TICKET_DB_ID;
    if (!dbId) {
      throw new Error('[${MODULE_NAME}] GH_NOTION_TICKET_DB_ID 未配置');
    }

    // 4. 初始化子模块
    cache = new TTLCache({ ttlMs: 10 * 60 * 1000, maxSize: 200 });
    dbReader = new DBReader({ client, databaseId: dbId, logger });
    pageRW = new PageRW({ client, logger });

    logger.info(`[${MODULE_NAME}] 初始化完成 ✅ · DB: ${dbId.slice(0, 8)}...`);
    return { status: 'ok', databaseId: dbId };
  },

  /**
   * 启动轮询服务
   * @param {object} context - 含 onNewTicket/onUpdatedTicket 回调
   */
  async start(context) {
    logger.info(`[${MODULE_NAME}] 启动同步服务...`);

    const intervalMs = parseInt(process.env.AGENT_POLL_INTERVAL, 10) || 30000;
    const stateDir = (context && context.dataDir) || process.cwd();

    poller = new TicketPoller({
      dbReader,
      onNewTicket: (context && context.onNewTicket) || defaultNewTicketHandler,
      onUpdatedTicket: (context && context.onUpdatedTicket) || null,
      intervalMs,
      stateDir,
      logger,
    });

    poller.start();
    logger.info(`[${MODULE_NAME}] 轮询已启动 · 间隔 ${intervalMs}ms`);
    return { status: 'running', intervalMs };
  },

  async stop() {
    logger.info(`[${MODULE_NAME}] 停止同步服务`);
    if (poller) {
      poller.stop();
      poller = null;
    }
    if (cache) {
      cache.clear();
    }
    return { status: 'stopped' };
  },

  async healthCheck() {
    const clientHealth = client ? await client.healthCheck() : { ok: false, error: '未初始化' };
    return {
      status: clientHealth.ok ? 'ok' : 'error',
      module: MODULE_NAME,
      version: MODULE_VERSION,
      notion: clientHealth,
      poller: poller ? poller.stats : null,
      cache: cache ? cache.stats : null,
    };
  },

  // ─── 对外暴露子模块（供agent-engine调用）───

  getClient: () => client,
  getDBReader: () => dbReader,
  getPageRW: () => pageRW,
  getPoller: () => poller,
  getCache: () => cache,
};

/**
 * 默认新工单处理器（仅日志，实际由agent-engine覆盖）
 */
async function defaultNewTicketHandler(ticket) {
  logger.info(
    `[${MODULE_NAME}] 检测到新工单 · ${ticket['编号'] || '无编号'} · ${ticket['任务标题']} · 等待agent-engine处理`
  );
}
