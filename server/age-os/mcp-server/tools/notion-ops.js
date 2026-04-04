/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · MCP 工具: Notion 操作
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 提供 5 个 Notion MCP 工具:
 *   notionQuery       — 查询 Notion 数据库
 *   notionReadPage    — 读取 Notion 页面内容
 *   notionWritePage   — 创建 Notion 页面
 *   notionUpdatePage  — 更新 Notion 页面属性
 *   notionWriteSyslog — 写入系统日志到 Notion
 */

'use strict';

const notion = require('../notion-client');

/**
 * notionQuery — 查询 Notion 数据库
 *
 * input:
 *   database_id: string  — 数据库 ID（或别名: changelog / receipt / syslog）
 *   filter: object       — Notion 过滤器（可选）
 *   sorts: object[]      — 排序规则（可选）
 *   page_size: number    — 每页数量（可选，默认20）
 *   start_cursor: string — 分页游标（可选）
 */
async function notionQuery(input) {
  const { database_id, filter, sorts, page_size, start_cursor } = input;
  if (!database_id) throw new Error('缺少 database_id');

  // 支持别名
  const dbId = resolveDbAlias(database_id);
  const result = await notion.queryDatabase(dbId, filter, sorts, page_size || 20, start_cursor);

  return {
    count: result.results.length,
    has_more: result.has_more,
    next_cursor: result.next_cursor,
    items: result.results.map(simplifyPage)
  };
}

/**
 * notionReadPage — 读取 Notion 页面完整内容
 *
 * input:
 *   page_id: string — 页面 ID
 */
async function notionReadPage(input) {
  const { page_id } = input;
  if (!page_id) throw new Error('缺少 page_id');

  const page = await notion.readPage(page_id);
  return {
    id: page.id,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    properties: simplifyProperties(page.properties),
    blocks_count: page.blocks.length,
    blocks: page.blocks.map(simplifyBlock)
  };
}

/**
 * notionWritePage — 在数据库中创建新页面
 *
 * input:
 *   database_id: string  — 数据库 ID（或别名）
 *   title: string        — 页面标题
 *   properties: object   — 额外属性（Notion API 格式，可选）
 *   content: string      — 页面正文内容（可选，自动转为段落块）
 */
async function notionWritePage(input) {
  const { database_id, title, properties, content } = input;
  if (!database_id) throw new Error('缺少 database_id');
  if (!title) throw new Error('缺少 title');

  const dbId = resolveDbAlias(database_id);

  // 构建属性
  const pageProps = {
    ...(properties || {}),
    '标题': {
      title: [{ text: { content: title } }]
    }
  };

  // 构建内容块
  const children = [];
  if (content) {
    // 按段落分割
    const paragraphs = content.split('\n\n');
    for (const para of paragraphs) {
      if (para.trim()) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: para.trim() } }]
          }
        });
      }
    }
  }

  return notion.createPage(dbId, pageProps, children);
}

/**
 * notionUpdatePage — 更新 Notion 页面属性
 *
 * input:
 *   page_id: string    — 页面 ID
 *   properties: object — 要更新的属性（Notion API 格式）
 */
async function notionUpdatePage(input) {
  const { page_id, properties } = input;
  if (!page_id) throw new Error('缺少 page_id');
  if (!properties) throw new Error('缺少 properties');

  return notion.updatePage(page_id, properties);
}

/**
 * notionWriteSyslog — 写入系统日志到 Notion
 *
 * input:
 *   level: string   — 日志级别: info / warning / error / critical
 *   source: string  — 来源: zhuyuan / agent / workflow / mcp
 *   message: string — 日志内容
 *   details: object — 附加详情（可选）
 */
async function notionWriteSyslog(input) {
  const { level, source, message, details } = input;
  if (!level) throw new Error('缺少 level');
  if (!source) throw new Error('缺少 source');
  if (!message) throw new Error('缺少 message');

  return notion.writeSyslog(level, source, message, details);
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

/**
 * 解析数据库别名
 */
function resolveDbAlias(id) {
  const aliases = {
    changelog: notion.NOTION_CONFIG.databases.changelog,
    receipt:   notion.NOTION_CONFIG.databases.receipt,
    syslog:    notion.NOTION_CONFIG.databases.syslog
  };
  return aliases[id] || id;
}

/**
 * 简化页面对象（去除 Notion API 冗余结构）
 */
function simplifyPage(page) {
  return {
    id: page.id,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    properties: simplifyProperties(page.properties)
  };
}

/**
 * 简化属性（提取值）
 */
function simplifyProperties(props) {
  if (!props) return {};
  const result = {};
  for (const [name, prop] of Object.entries(props)) {
    result[name] = extractPropertyValue(prop);
  }
  return result;
}

/**
 * 提取 Notion 属性值
 */
function extractPropertyValue(prop) {
  switch (prop.type) {
    case 'title':
      return prop.title.map(t => t.plain_text).join('');
    case 'rich_text':
      return prop.rich_text.map(t => t.plain_text).join('');
    case 'number':
      return prop.number;
    case 'select':
      return prop.select?.name || null;
    case 'multi_select':
      return prop.multi_select.map(s => s.name);
    case 'date':
      return prop.date?.start || null;
    case 'checkbox':
      return prop.checkbox;
    case 'url':
      return prop.url;
    case 'email':
      return prop.email;
    case 'status':
      return prop.status?.name || null;
    case 'formula':
      return prop.formula?.string || prop.formula?.number || null;
    case 'relation':
      return prop.relation.map(r => r.id);
    default:
      return `[${prop.type}]`;
  }
}

/**
 * 简化内容块
 */
function simplifyBlock(block) {
  const simplified = {
    id: block.id,
    type: block.type,
    has_children: block.has_children
  };

  const content = block[block.type];
  if (content) {
    if (content.rich_text) {
      simplified.text = content.rich_text.map(t => t.plain_text).join('');
    }
    if (content.language) {
      simplified.language = content.language;
    }
  }

  return simplified;
}

module.exports = {
  notionQuery,
  notionReadPage,
  notionWritePage,
  notionUpdatePage,
  notionWriteSyslog
};
