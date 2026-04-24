/**
 * tool-registry.js — 工具注册表
 *
 * 设计哲学：用什么拿什么，用完还回去，不占地方。
 *
 * 本文件不内置任何工具实现，只维护一张「去哪儿拿工具」的地图。
 * 工具的真身住在仓库各处（mcp-servers/ · connectors/ · core/），
 * 需要时按需 require，用完可以从 require.cache 卸载。
 *
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '../../..');

/**
 * 工具地图：每个工具在仓库里的位置
 * 运行时按需加载，不提前 require
 */
const TOOL_MAP = {
  // ─── Notion 工具（来自 mcp-servers/notion-server.js）───
  notion_query_database: {
    source: 'mcp-servers/notion-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/notion-server.js'),
    executor: 'executeTool',
    description: '查询 Notion 数据库',
    category: 'notion'
  },
  notion_update_page: {
    source: 'mcp-servers/notion-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/notion-server.js'),
    executor: 'executeTool',
    description: '更新 Notion 页面属性',
    category: 'notion'
  },
  notion_create_page: {
    source: 'mcp-servers/notion-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/notion-server.js'),
    executor: 'executeTool',
    description: '在 Notion 数据库中创建页面',
    category: 'notion'
  },
  notion_search: {
    source: 'mcp-servers/notion-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/notion-server.js'),
    executor: 'executeTool',
    description: '搜索 Notion 工作区',
    category: 'notion'
  },

  // ─── GitHub 工具（来自 mcp-servers/github-server.js）───
  github_create_branch: {
    source: 'mcp-servers/github-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/github-server.js'),
    executor: 'executeTool',
    description: '在指定仓库创建新分支',
    category: 'github'
  },
  github_commit_file: {
    source: 'mcp-servers/github-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/github-server.js'),
    executor: 'executeTool',
    description: '在指定仓库提交文件',
    category: 'github'
  },
  github_create_pr: {
    source: 'mcp-servers/github-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/github-server.js'),
    executor: 'executeTool',
    description: '创建 Pull Request',
    category: 'github'
  },
  github_read_file: {
    source: 'mcp-servers/github-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/github-server.js'),
    executor: 'executeTool',
    description: '读取仓库文件内容',
    category: 'github'
  },
  github_trigger_workflow: {
    source: 'mcp-servers/github-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/github-server.js'),
    executor: 'executeTool',
    description: '触发 GitHub Actions workflow',
    category: 'github'
  },
  github_list_workflows: {
    source: 'mcp-servers/github-server.js',
    modulePath: path.join(REPO_ROOT, 'mcp-servers/github-server.js'),
    executor: 'executeTool',
    description: '列出仓库所有 workflow 及最近运行状态',
    category: 'github'
  },

  // ─── 服务器运维工具（来自 zhuyuan-mcp · 远程调用）───
  server_health: {
    source: 'mcp-servers/zhuyuan-mcp (remote)',
    type: 'remote-mcp',
    endpoint: process.env.ZY_MCP_ENDPOINT || 'http://43.134.16.246:3900/mcp',
    secret: process.env.ZY_MCP_SECRET,
    description: '检查服务器健康状态',
    category: 'ops'
  },
  pm2_list: {
    source: 'mcp-servers/zhuyuan-mcp (remote)',
    type: 'remote-mcp',
    endpoint: process.env.ZY_MCP_ENDPOINT || 'http://43.134.16.246:3900/mcp',
    secret: process.env.ZY_MCP_SECRET,
    description: '列出所有PM2进程及运行状态',
    category: 'ops'
  },
  deploy: {
    source: 'mcp-servers/zhuyuan-mcp (remote)',
    type: 'remote-mcp',
    endpoint: process.env.ZY_MCP_ENDPOINT || 'http://43.134.16.246:3900/mcp',
    secret: process.env.ZY_MCP_SECRET,
    description: '从GitHub拉取最新代码并重启服务',
    category: 'ops'
  },

  // ─── Notion 双向同步（来自 connectors/notion-sync）───
  notion_pull_broadcasts: {
    source: 'connectors/notion-sync/index.js',
    modulePath: path.join(REPO_ROOT, 'connectors/notion-sync/index.js'),
    method: 'pullBroadcasts',
    description: '从 Notion 拉取广播/工单',
    category: 'notion'
  },
  notion_push_log: {
    source: 'connectors/notion-sync/index.js',
    modulePath: path.join(REPO_ROOT, 'connectors/notion-sync/index.js'),
    method: 'pushExecutionLog',
    description: '写回执行日志到 Notion',
    category: 'notion'
  },
  notion_sync_status: {
    source: 'connectors/notion-sync/index.js',
    modulePath: path.join(REPO_ROOT, 'connectors/notion-sync/index.js'),
    method: 'syncExecutionStatus',
    description: '同步执行层状态到 Notion',
    category: 'notion'
  }
};

// ─── 已加载的模块缓存（按需加载 · 用完可卸载）───
const loadedModules = new Map();

/**
 * 按需加载工具模块
 * 需要时 require，不需要时不占内存
 */
function loadToolModule(toolName) {
  const toolDef = TOOL_MAP[toolName];
  if (!toolDef) {
    throw new Error(`未知工具: ${toolName}`);
  }

  // 远程 MCP 工具不需要本地加载
  if (toolDef.type === 'remote-mcp') {
    return null;
  }

  // 已加载就直接返回
  if (loadedModules.has(toolDef.modulePath)) {
    return loadedModules.get(toolDef.modulePath);
  }

  // 按需 require
  try {
    const mod = require(toolDef.modulePath);
    loadedModules.set(toolDef.modulePath, mod);
    console.log(`[工具注册表] 📦 已加载: ${toolDef.source}`);
    return mod;
  } catch (err) {
    console.error(`[工具注册表] ❌ 加载失败 ${toolDef.source}: ${err.message}`);
    throw err;
  }
}

/**
 * 卸载工具模块（释放内存）
 */
function unloadToolModule(modulePath) {
  if (loadedModules.has(modulePath)) {
    // 从 require.cache 中清除
    delete require.cache[require.resolve(modulePath)];
    loadedModules.delete(modulePath);
    console.log(`[工具注册表] 🔄 已卸载: ${modulePath}`);
  }
}

/**
 * 卸载所有已加载的工具模块
 */
function unloadAll() {
  for (const [modulePath] of loadedModules) {
    delete require.cache[require.resolve(modulePath)];
  }
  loadedModules.clear();
  console.log('[工具注册表] 🔄 已卸载全部工具');
}

/**
 * 执行工具
 * @param {string} toolName - 工具名
 * @param {object} params - 参数
 * @param {object} context - 上下文 { devId, notionToken, pat, ... }
 */
async function executeTool(toolName, params, context = {}) {
  const toolDef = TOOL_MAP[toolName];
  if (!toolDef) {
    return { error: true, code: 'UNKNOWN_TOOL', message: `未知工具: ${toolName}` };
  }

  // 远程 MCP 工具 → 发 HTTP 请求
  if (toolDef.type === 'remote-mcp') {
    return await executeRemoteMcpTool(toolName, params, toolDef);
  }

  // 本地工具 → 按需加载模块 → 执行 → （可选）卸载
  const mod = loadToolModule(toolName);

  // 如果工具定义了 executor 函数名（如 executeTool）
  if (toolDef.executor && typeof mod[toolDef.executor] === 'function') {
    const ctx = {
      devId: context.devId || 'TCS-0002',
      notionToken: context.notionToken || process.env.ZY_NOTION_TOKEN || process.env.NOTION_TOKEN,
      pat: context.pat || process.env.GITHUB_TOKEN
    };
    return await mod[toolDef.executor](toolName, params, ctx);
  }

  // 如果工具定义了 method 名（如 pullBroadcasts）
  if (toolDef.method && typeof mod[toolDef.method] === 'function') {
    return await mod[toolDef.method](params);
  }

  return { error: true, code: 'NO_EXECUTOR', message: `工具 ${toolName} 无可执行函数` };
}

/**
 * 执行远程 MCP 工具（铸渊 MCP Server）
 */
async function executeRemoteMcpTool(toolName, params, toolDef) {
  const endpoint = toolDef.endpoint;
  if (!endpoint) {
    return { error: true, code: 'NO_ENDPOINT', message: '远程 MCP 端点未配置' };
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (toolDef.secret) {
      headers['Authorization'] = `Bearer ${toolDef.secret}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: params },
        id: Date.now()
      })
    });

    if (!res.ok) {
      return { error: true, status: res.status, message: `远程调用失败` };
    }

    const data = await res.json();
    return data.result || data;
  } catch (err) {
    return { error: true, code: 'REMOTE_ERROR', message: err.message };
  }
}

/**
 * 获取工具清单（给 LLM 看的人话版）
 */
function getToolManifest() {
  return Object.entries(TOOL_MAP).map(([name, def]) => ({
    name,
    description: def.description,
    source: def.source,
    category: def.category
  }));
}

/**
 * 获取工具定义（OpenAI function calling 格式）
 * 给 LLM 用的，让它知道可以调哪些工具
 */
function getToolDefinitions() {
  // 从已注册的 MCP tool definitions 中获取 inputSchema
  const definitions = [];

  // 加载 notion-server 的工具定义
  try {
    const notionServer = require(path.join(REPO_ROOT, 'mcp-servers/notion-server.js'));
    for (const tool of notionServer.tools || []) {
      definitions.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      });
    }
  } catch { /* 模块不存在则跳过 */ }

  // 加载 github-server 的工具定义
  try {
    const githubServer = require(path.join(REPO_ROOT, 'mcp-servers/github-server.js'));
    for (const tool of githubServer.tools || []) {
      definitions.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      });
    }
  } catch { /* 模块不存在则跳过 */ }

  return definitions;
}

/**
 * 获取已加载模块数
 */
function getLoadedCount() {
  return loadedModules.size;
}

module.exports = {
  TOOL_MAP,
  executeTool,
  loadToolModule,
  unloadToolModule,
  unloadAll,
  getToolManifest,
  getToolDefinitions,
  getLoadedCount
};
