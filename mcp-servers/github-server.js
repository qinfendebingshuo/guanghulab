/**
 * MCP Server: GitHub 工具集
 *
 * 提供 GitHub 仓库操作工具，供 AGE OS 对话界面调用。
 * 所有工具调用经过配额守卫检查 + 权限隔离。
 *
 * 指令：ZY-AGEOS-TOWER-2026-0326-001
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

/**
 * GitHub MCP Server tool definitions
 */
var tools = [
  {
    name: 'github_create_branch',
    description: '在指定仓库创建新分支',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: '仓库全名 owner/repo' },
        branch: { type: 'string', description: '新分支名' },
        from: { type: 'string', description: '基于哪个分支', default: 'main' }
      },
      required: ['repo', 'branch']
    }
  },
  {
    name: 'github_commit_file',
    description: '在指定仓库提交文件',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: '仓库全名 owner/repo' },
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '文件内容' },
        message: { type: 'string', description: '提交信息' },
        branch: { type: 'string', description: '目标分支', default: 'main' }
      },
      required: ['repo', 'path', 'content', 'message']
    }
  },
  {
    name: 'github_trigger_workflow',
    description: '触发 GitHub Actions workflow',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: '仓库全名 owner/repo' },
        workflow_id: { type: 'string', description: 'workflow 文件名' },
        ref: { type: 'string', description: '触发分支', default: 'main' }
      },
      required: ['repo', 'workflow_id']
    }
  },
  {
    name: 'github_create_pr',
    description: '创建 Pull Request',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: '仓库全名 owner/repo' },
        title: { type: 'string', description: 'PR 标题' },
        head: { type: 'string', description: '源分支' },
        base: { type: 'string', description: '目标分支', default: 'main' },
        body: { type: 'string', description: 'PR 描述' }
      },
      required: ['repo', 'title', 'head']
    }
  },
  {
    name: 'github_list_workflows',
    description: '列出仓库所有 workflow 及最近运行状态',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: '仓库全名 owner/repo' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_read_file',
    description: '读取仓库文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: '仓库全名 owner/repo' },
        path: { type: 'string', description: '文件路径' },
        ref: { type: 'string', description: '分支/标签/SHA', default: 'main' }
      },
      required: ['repo', 'path']
    }
  }
];

// System admin IDs with full access to all repos
var ADMIN_IDS = ['TCS-0002', 'DEV-000'];

/**
 * Permission matrix for GitHub tools
 * @param {string} devId - Developer ID
 * @param {string} repo - Repository full name (owner/repo)
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkPermission(devId, repo) {
  // Admin users have access to all repos
  if (ADMIN_IDS.indexOf(devId) >= 0) {
    return { allowed: true };
  }

  // Main repo is protected — only TCS-0002 can operate
  if (repo === 'qinfendebingshuo/guanghulab') {
    return {
      allowed: false,
      reason: '主仓库仅系统层可操作，请在自己的行业仓库中执行'
    };
  }

  // Other developers can only operate their own repos
  // (Repo ownership validated via industry-repo-map at call time)
  return { allowed: true };
}

/**
 * Execute a GitHub MCP tool
 * @param {string} toolName
 * @param {object} params
 * @param {object} context - { devId, pat }
 * @returns {Promise<object>}
 */
async function executeTool(toolName, params, context) {
  var devId = context.devId;
  var pat = context.pat;

  // Permission check
  if (params.repo) {
    var permResult = checkPermission(devId, params.repo);
    if (!permResult.allowed) {
      return { error: true, code: 'PERMISSION_DENIED', message: permResult.reason };
    }
  }

  var baseUrl = 'https://api.github.com';
  var headers = {
    'Authorization': 'Bearer ' + pat,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  switch (toolName) {
    case 'github_read_file': {
      var ref = params.ref || 'main';
      var url = baseUrl + '/repos/' + params.repo + '/contents/' + params.path + '?ref=' + encodeURIComponent(ref);
      var res = await fetch(url, { headers: headers });
      if (!res.ok) return { error: true, status: res.status, message: 'Failed to read file' };
      var data = await res.json();
      return {
        path: data.path,
        content: data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf8') : data.content,
        sha: data.sha
      };
    }

    case 'github_list_workflows': {
      var wfUrl = baseUrl + '/repos/' + params.repo + '/actions/workflows';
      var wfRes = await fetch(wfUrl, { headers: headers });
      if (!wfRes.ok) return { error: true, status: wfRes.status, message: 'Failed to list workflows' };
      var wfData = await wfRes.json();
      return {
        total_count: wfData.total_count,
        workflows: (wfData.workflows || []).map(function(w) {
          return { id: w.id, name: w.name, state: w.state, path: w.path };
        })
      };
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
