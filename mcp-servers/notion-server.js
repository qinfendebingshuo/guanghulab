/**
 * MCP Server: Notion 工具集
 *
 * 提供 Notion 数据库操作工具，供 AGE OS 对话界面调用。
 * 权限由开发者编号决定：只能操作自己频道下的内容。
 *
 * 指令：ZY-AGEOS-TOWER-2026-0326-001
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

/**
 * Notion MCP Server tool definitions
 */
var tools = [
  {
    name: 'notion_query_database',
    description: '查询 Notion 数据库',
    inputSchema: {
      type: 'object',
      properties: {
        database_id: { type: 'string', description: 'Notion 数据库 ID' },
        filter: { type: 'object', description: 'Notion filter 对象' }
      },
      required: ['database_id']
    }
  },
  {
    name: 'notion_update_page',
    description: '更新 Notion 页面属性',
    inputSchema: {
      type: 'object',
      properties: {
        page_id: { type: 'string', description: 'Notion 页面 ID' },
        properties: { type: 'object', description: '要更新的属性' }
      },
      required: ['page_id', 'properties']
    }
  },
  {
    name: 'notion_create_page',
    description: '在 Notion 数据库中创建页面',
    inputSchema: {
      type: 'object',
      properties: {
        database_id: { type: 'string', description: 'Notion 数据库 ID' },
        properties: { type: 'object', description: '页面属性' },
        content: { type: 'string', description: '页面内容（Markdown）' }
      },
      required: ['database_id', 'properties']
    }
  },
  {
    name: 'notion_search',
    description: '搜索 Notion 工作区',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' }
      },
      required: ['query']
    }
  }
];

// Notion API base URL
var NOTION_API_BASE = 'https://api.notion.com/v1';
var NOTION_VERSION = '2022-06-28';

/**
 * Permission check for Notion tools
 * @param {string} devId - Developer ID
 * @param {string} toolName - Tool being called
 * @returns {{ allowed: boolean, readOnly?: boolean, reason?: string }}
 */
function checkPermission(devId, toolName) {
  // TCS-0002 (冰朔) has full access
  if (devId === 'TCS-0002' || devId === 'DEV-000') {
    return { allowed: true, readOnly: false };
  }

  // Guests have no access
  if (!devId || !devId.startsWith('DEV-')) {
    return { allowed: false, reason: '访客无 Notion 工具权限' };
  }

  // Other developers: read operations allowed, write operations limited to own channel
  var writeTools = ['notion_update_page', 'notion_create_page'];
  if (writeTools.indexOf(toolName) >= 0) {
    return { allowed: true, readOnly: false, channelRestricted: true };
  }

  return { allowed: true, readOnly: true };
}

/**
 * Execute a Notion MCP tool
 * @param {string} toolName
 * @param {object} params
 * @param {object} context - { devId, notionToken }
 * @returns {Promise<object>}
 */
async function executeTool(toolName, params, context) {
  var devId = context.devId;
  var notionToken = context.notionToken || process.env.NOTION_TOKEN;

  if (!notionToken) {
    return { error: true, code: 'NO_TOKEN', message: 'Notion token 未配置' };
  }

  // Permission check
  var permResult = checkPermission(devId, toolName);
  if (!permResult.allowed) {
    return { error: true, code: 'PERMISSION_DENIED', message: permResult.reason };
  }

  var headers = {
    'Authorization': 'Bearer ' + notionToken,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };

  switch (toolName) {
    case 'notion_query_database': {
      var url = NOTION_API_BASE + '/databases/' + params.database_id + '/query';
      var body = params.filter ? { filter: params.filter } : {};
      var res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      if (!res.ok) return { error: true, status: res.status, message: 'Failed to query database' };
      var data = await res.json();
      return { results: data.results, has_more: data.has_more };
    }

    case 'notion_search': {
      var searchUrl = NOTION_API_BASE + '/search';
      var searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: params.query })
      });
      if (!searchRes.ok) return { error: true, status: searchRes.status, message: 'Failed to search' };
      var searchData = await searchRes.json();
      return { results: searchData.results, has_more: searchData.has_more };
    }

    default:
      return { error: true, code: 'NOT_IMPLEMENTED', message: toolName + ' 尚未实现，待后续开发' };
  }
}

module.exports = {
  tools: tools,
  checkPermission: checkPermission,
  executeTool: executeTool
};
