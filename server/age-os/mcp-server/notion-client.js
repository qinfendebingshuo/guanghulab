/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · Notion API 客户端
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-NOTION-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * Notion 读写客户端 — 用于 brain_nodes ↔ Notion 双向同步
 * 通过 @notionhq/client SDK 连接 Notion API
 */

'use strict';

const { Client } = require('@notionhq/client');

// ─── 配置 ───
const NOTION_CONFIG = {
  token:         process.env.ZY_NOTION_TOKEN || '',
  databases: {
    changelog: process.env.ZY_NOTION_CHANGELOG_DB || '',
    receipt:   process.env.ZY_NOTION_RECEIPT_DB || '',
    syslog:    process.env.ZY_NOTION_SYSLOG_DB || ''
  },
  pages: {
    bulletin:  process.env.ZY_NOTION_BULLETIN_PAGE || ''
  }
};

// ─── 客户端实例（延迟初始化） ───
let client = null;

function getClient() {
  if (!client) {
    if (!NOTION_CONFIG.token) {
      throw new Error('ZY_NOTION_TOKEN 未配置');
    }
    client = new Client({ auth: NOTION_CONFIG.token });
  }
  return client;
}

// ═══════════════════════════════════════════════════════════
// 数据库操作
// ═══════════════════════════════════════════════════════════

/**
 * 查询 Notion 数据库
 * @param {string} databaseId - 数据库 ID
 * @param {object} [filter] - Notion filter 对象
 * @param {object[]} [sorts] - Notion sorts 数组
 * @param {number} [pageSize] - 每页数量 (最大100)
 * @param {string} [startCursor] - 分页游标
 * @returns {Promise<{results: object[], has_more: boolean, next_cursor: string|null}>}
 */
async function queryDatabase(databaseId, filter, sorts, pageSize, startCursor) {
  const notion = getClient();
  const params = { database_id: databaseId };

  if (filter) params.filter = filter;
  if (sorts)  params.sorts = sorts;
  if (pageSize) params.page_size = Math.min(pageSize, 100);
  if (startCursor) params.start_cursor = startCursor;

  const response = await notion.databases.query(params);
  return {
    results: response.results,
    has_more: response.has_more,
    next_cursor: response.next_cursor
  };
}

/**
 * 获取数据库结构（属性定义）
 * @param {string} databaseId
 * @returns {Promise<object>}
 */
async function getDatabaseSchema(databaseId) {
  const notion = getClient();
  const db = await notion.databases.retrieve({ database_id: databaseId });
  return {
    id: db.id,
    title: db.title.map(t => t.plain_text).join(''),
    properties: Object.fromEntries(
      Object.entries(db.properties).map(([name, prop]) => [
        name,
        { id: prop.id, type: prop.type }
      ])
    )
  };
}

// ═══════════════════════════════════════════════════════════
// 页面操作
// ═══════════════════════════════════════════════════════════

/**
 * 读取 Notion 页面内容
 * @param {string} pageId - 页面 ID
 * @returns {Promise<{id: string, properties: object, blocks: object[]}>}
 */
async function readPage(pageId) {
  const notion = getClient();

  // 获取页面属性
  const page = await notion.pages.retrieve({ page_id: pageId });

  // 获取页面内容块
  const blocks = [];
  let cursor;
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor
    });
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return {
    id: page.id,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    properties: page.properties,
    blocks
  };
}

/**
 * 在数据库中创建新页面
 * @param {string} databaseId - 目标数据库 ID
 * @param {object} properties - 属性对象（Notion API 格式）
 * @param {object[]} [children] - 内容块数组
 * @returns {Promise<{id: string, url: string}>}
 */
async function createPage(databaseId, properties, children) {
  const notion = getClient();
  const params = {
    parent: { database_id: databaseId },
    properties
  };

  if (children && children.length > 0) {
    params.children = children;
  }

  const page = await notion.pages.create(params);
  return {
    id: page.id,
    url: page.url,
    created_time: page.created_time
  };
}

/**
 * 更新页面属性
 * @param {string} pageId - 页面 ID
 * @param {object} properties - 要更新的属性
 * @returns {Promise<{id: string, last_edited_time: string}>}
 */
async function updatePage(pageId, properties) {
  const notion = getClient();
  const page = await notion.pages.update({
    page_id: pageId,
    properties
  });
  return {
    id: page.id,
    last_edited_time: page.last_edited_time
  };
}

/**
 * 向页面追加内容块
 * @param {string} pageId - 页面 ID
 * @param {object[]} children - 内容块数组
 * @returns {Promise<{results: object[]}>}
 */
async function appendBlocks(pageId, children) {
  const notion = getClient();
  const response = await notion.blocks.children.append({
    block_id: pageId,
    children
  });
  return { results: response.results };
}

// ═══════════════════════════════════════════════════════════
// 便捷方法（光湖特有）
// ═══════════════════════════════════════════════════════════

/**
 * 写入 SYSLOG（系统日志 → Notion）
 * @param {string} level - 日志级别: info / warning / error / critical
 * @param {string} source - 来源: zhuyuan / agent / workflow
 * @param {string} message - 日志内容
 * @param {object} [details] - 附加详情
 * @returns {Promise<{id: string, url: string}>}
 */
async function writeSyslog(level, source, message, details) {
  if (!NOTION_CONFIG.databases.syslog) {
    throw new Error('ZY_NOTION_SYSLOG_DB 未配置');
  }

  const properties = {
    '标题': {
      title: [{ text: { content: message.substring(0, 100) } }]
    },
    '级别': {
      select: { name: level }
    },
    '来源': {
      select: { name: source }
    },
    '时间': {
      date: { start: new Date().toISOString() }
    }
  };

  const children = [];
  if (message.length > 100) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: message } }]
      }
    });
  }
  if (details) {
    children.push({
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{ text: { content: JSON.stringify(details, null, 2) } }],
        language: 'json'
      }
    });
  }

  return createPage(NOTION_CONFIG.databases.syslog, properties, children);
}

/**
 * 写入 Changelog（变更日志 → Notion）
 * @param {string} version - 版本号
 * @param {string} title - 变更标题
 * @param {string} description - 变更描述
 * @param {string} author - 变更作者
 * @returns {Promise<{id: string, url: string}>}
 */
async function writeChangelog(version, title, description, author) {
  if (!NOTION_CONFIG.databases.changelog) {
    throw new Error('ZY_NOTION_CHANGELOG_DB 未配置');
  }

  const properties = {
    '标题': {
      title: [{ text: { content: title } }]
    },
    '版本': {
      rich_text: [{ text: { content: version } }]
    },
    '作者': {
      select: { name: author || '铸渊' }
    },
    '日期': {
      date: { start: new Date().toISOString() }
    }
  };

  const children = description ? [{
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ text: { content: description } }]
    }
  }] : [];

  return createPage(NOTION_CONFIG.databases.changelog, properties, children);
}

// ═══════════════════════════════════════════════════════════
// 连接检查
// ═══════════════════════════════════════════════════════════

/**
 * 检查 Notion 连接状态
 * @returns {Promise<{connected: boolean, user?: string, error?: string}>}
 */
async function checkConnection() {
  if (!NOTION_CONFIG.token) {
    return { connected: false, reason: 'ZY_NOTION_TOKEN 未配置' };
  }
  try {
    const notion = getClient();
    const me = await notion.users.me({});
    return {
      connected: true,
      user: me.name || me.id,
      type: me.type
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * 获取配置信息（不含敏感信息）
 */
function getConfig() {
  return {
    token_configured: !!NOTION_CONFIG.token,
    databases: {
      changelog: NOTION_CONFIG.databases.changelog ? '已配置' : '未配置',
      receipt:   NOTION_CONFIG.databases.receipt   ? '已配置' : '未配置',
      syslog:    NOTION_CONFIG.databases.syslog    ? '已配置' : '未配置'
    },
    pages: {
      bulletin: NOTION_CONFIG.pages.bulletin ? '已配置' : '未配置'
    }
  };
}

module.exports = {
  queryDatabase,
  getDatabaseSchema,
  readPage,
  createPage,
  updatePage,
  appendBlocks,
  writeSyslog,
  writeChangelog,
  checkConnection,
  getConfig,
  NOTION_CONFIG
};
