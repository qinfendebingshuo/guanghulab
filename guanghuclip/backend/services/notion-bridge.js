/**
 * notion-bridge.js — [已废弃 · 重定向到仓库已有工具]
 *
 * 这个文件不再需要了。
 * Notion 操作已经由以下仓库模块统一处理：
 *   - mcp-servers/notion-server.js   → 查询/创建/更新/搜索
 *   - connectors/notion-sync/index.js → 双向同步
 *
 * persona-engine.js 通过 tool-registry.js 按需调用这些工具。
 * 保留此文件只是为了兼容性。
 *
 * @deprecated 请使用 tool-registry.js 统一调用
 */

'use strict';

const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '../../..');

// 直接转发到仓库已有的模块
const notionServer = require(path.join(REPO_ROOT, 'mcp-servers/notion-server.js'));
const notionSync = require(path.join(REPO_ROOT, 'connectors/notion-sync/index.js'));

module.exports = {
  // 转发 notion-server 的工具
  tools: notionServer.tools,
  executeTool: notionServer.executeTool,

  // 转发 notion-sync 的功能
  pullBroadcasts: notionSync.pullBroadcasts,
  pushExecutionLog: notionSync.pushExecutionLog,
  syncExecutionStatus: notionSync.syncExecutionStatus
};
