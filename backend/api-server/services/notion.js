/**
 * Notion API 服务封装
 *
 * 所有 Notion 数据库读写操作走这里，带内存缓存。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var Client;
try {
  Client = require('@notionhq/client').Client;
} catch (_) {
  // 如果 @notionhq/client 未安装，提供降级方案
  Client = null;
}

var notion = Client ? new Client({ auth: process.env.NOTION_TOKEN }) : null;

// ====== 内存缓存（5分钟有效）======
var cache = new Map();
var CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  var item = cache.get(key);
  if (item && Date.now() - item.time < CACHE_TTL) return item.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data: data, time: Date.now() });
}

function clearCache() {
  cache.clear();
}

// ====== 查询数据库 ======
async function queryDB(dbId, filter, sorts, pageSize) {
  if (!notion) {
    throw new Error('Notion client not initialized (NOTION_TOKEN missing or @notionhq/client not installed)');
  }
  if (!dbId) {
    throw new Error('Database ID not provided');
  }

  pageSize = pageSize || 50;
  var cacheKey = JSON.stringify({ dbId: dbId, filter: filter, sorts: sorts, pageSize: pageSize });
  var cached = getCached(cacheKey);
  if (cached) return cached;

  var body = { database_id: dbId, page_size: pageSize };
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;

  var result = await notion.databases.query(body);
  setCache(cacheKey, result);
  return result;
}

// ====== 写入数据库 ======
async function writeToDB(dbId, properties) {
  if (!notion) {
    throw new Error('Notion client not initialized');
  }
  return notion.pages.create({
    parent: { database_id: dbId },
    properties: properties
  });
}

// ====== Notion 属性提取器 ======
function extractRichText(prop) {
  if (!prop) return '';
  if (prop.type === 'rich_text' && prop.rich_text) {
    return prop.rich_text.map(function(t) { return t.plain_text; }).join('');
  }
  if (prop.type === 'title' && prop.title) {
    return prop.title.map(function(t) { return t.plain_text; }).join('');
  }
  return '';
}

function extractTitle(props) {
  for (var key in props) {
    var val = props[key];
    if (val && val.type === 'title' && val.title) {
      return val.title.map(function(t) { return t.plain_text; }).join('');
    }
  }
  return '';
}

function extractNumber(prop) {
  if (!prop || prop.type !== 'number') return null;
  return prop.number;
}

function extractSelect(prop) {
  if (!prop || prop.type !== 'select') return '';
  return prop.select ? prop.select.name : '';
}

function extractMultiSelect(prop) {
  if (!prop || prop.type !== 'multi_select') return [];
  return (prop.multi_select || []).map(function(s) { return s.name; });
}

function extractDate(prop) {
  if (!prop || prop.type !== 'date') return '';
  return prop.date ? prop.date.start : '';
}

module.exports = {
  notion: notion,
  queryDB: queryDB,
  writeToDB: writeToDB,
  clearCache: clearCache,
  extractRichText: extractRichText,
  extractTitle: extractTitle,
  extractNumber: extractNumber,
  extractSelect: extractSelect,
  extractMultiSelect: extractMultiSelect,
  extractDate: extractDate
};
