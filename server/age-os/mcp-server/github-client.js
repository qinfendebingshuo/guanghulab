/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · GitHub API 客户端
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-GITHUB-001
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * GitHub API 读写客户端 — 用于网站对接 GitHub 仓库
 * 使用原生 https 模块（与 cos.js 保持一致，无额外依赖）
 */

'use strict';

const https = require('https');

// ─── 配置 ───
const GITHUB_CONFIG = {
  token:  process.env.ZY_GITHUB_PAT || '',
  owner:  process.env.ZY_GITHUB_OWNER || 'qinfendebingshuo',
  repo:   process.env.ZY_GITHUB_REPO || 'guanghulab',
  apiBase: 'api.github.com'
};

// ─── 通用 GitHub API 请求 ───
function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'ZY-AGE-OS/1.0',
      'Accept': 'application/vnd.github.v3+json'
    };

    if (GITHUB_CONFIG.token) {
      headers['Authorization'] = `Bearer ${GITHUB_CONFIG.token}`;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request({
      hostname: GITHUB_CONFIG.apiBase,
      port: 443,
      path,
      method,
      headers,
      timeout: 30000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ statusCode: res.statusCode, data: raw });
          }
        } else {
          let errorMsg;
          try {
            const errObj = JSON.parse(raw);
            errorMsg = errObj.message || raw.substring(0, 200);
          } catch {
            errorMsg = raw.substring(0, 200);
          }
          reject(new Error(`GitHub API ${method} ${path}: ${res.statusCode} - ${errorMsg}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('GitHub API request timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════
// 仓库内容操作
// ═══════════════════════════════════════════════════════════

/**
 * 安全编码文件路径（保留斜杠，编码各段）
 */
function encodeFilePath(filePath) {
  return filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径（相对仓库根目录）
 * @param {string} [ref] - 分支/标签/SHA（默认 main）
 * @returns {Promise<{path: string, content: string, sha: string, size: number}>}
 */
async function readFile(filePath, ref) {
  const { owner, repo } = GITHUB_CONFIG;
  let apiPath = `/repos/${owner}/${repo}/contents/${encodeFilePath(filePath)}`;
  if (ref) apiPath += `?ref=${encodeURIComponent(ref)}`;

  const { data } = await githubRequest('GET', apiPath);

  if (data.type !== 'file') {
    throw new Error(`${filePath} 不是文件，类型为: ${data.type}`);
  }

  return {
    path: data.path,
    content: Buffer.from(data.content, 'base64').toString('utf8'),
    sha: data.sha,
    size: data.size,
    download_url: data.download_url
  };
}

/**
 * 列出目录内容
 * @param {string} dirPath - 目录路径（空字符串 = 根目录）
 * @param {string} [ref] - 分支/标签/SHA
 * @returns {Promise<{path: string, items: object[]}>}
 */
async function listDirectory(dirPath, ref) {
  const { owner, repo } = GITHUB_CONFIG;
  const encodedPath = dirPath ? encodeFilePath(dirPath) : '';
  let apiPath = `/repos/${owner}/${repo}/contents/${encodedPath}`;
  if (ref) apiPath += `?ref=${encodeURIComponent(ref)}`;

  const { data } = await githubRequest('GET', apiPath);

  if (!Array.isArray(data)) {
    throw new Error(`${dirPath} 不是目录`);
  }

  return {
    path: dirPath || '/',
    items: data.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha
    }))
  };
}

/**
 * 创建或更新文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @param {string} message - 提交信息
 * @param {string} [sha] - 更新时需要当前文件 SHA
 * @param {string} [branch] - 目标分支
 * @returns {Promise<{path: string, sha: string, commit_sha: string}>}
 */
async function writeFile(filePath, content, message, sha, branch) {
  const { owner, repo } = GITHUB_CONFIG;
  const apiPath = `/repos/${owner}/${repo}/contents/${encodeFilePath(filePath)}`;

  const body = {
    message: message || `[铸渊] 更新 ${filePath}`,
    content: Buffer.from(content).toString('base64')
  };

  if (sha) body.sha = sha;
  if (branch) body.branch = branch;

  const { data } = await githubRequest('PUT', apiPath, body);

  return {
    path: data.content.path,
    sha: data.content.sha,
    commit_sha: data.commit.sha
  };
}

// ═══════════════════════════════════════════════════════════
// 仓库信息
// ═══════════════════════════════════════════════════════════

/**
 * 获取仓库基本信息
 * @returns {Promise<object>}
 */
async function getRepoInfo() {
  const { owner, repo } = GITHUB_CONFIG;
  const { data } = await githubRequest('GET', `/repos/${owner}/${repo}`);
  return {
    full_name: data.full_name,
    description: data.description,
    default_branch: data.default_branch,
    private: data.private,
    stargazers_count: data.stargazers_count,
    forks_count: data.forks_count,
    open_issues_count: data.open_issues_count,
    pushed_at: data.pushed_at,
    updated_at: data.updated_at,
    size: data.size,
    language: data.language
  };
}

/**
 * 获取最近提交
 * @param {number} [count] - 获取数量（最大100）
 * @param {string} [branch] - 分支名
 * @returns {Promise<object[]>}
 */
async function getRecentCommits(count, branch) {
  const { owner, repo } = GITHUB_CONFIG;
  const limit = Math.min(count || 10, 100);
  let apiPath = `/repos/${owner}/${repo}/commits?per_page=${limit}`;
  if (branch) apiPath += `&sha=${encodeURIComponent(branch)}`;

  const { data } = await githubRequest('GET', apiPath);

  return data.map(c => ({
    sha: c.sha.substring(0, 7),
    full_sha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
    date: c.commit.author.date
  }));
}

/**
 * 获取 Issues 列表
 * @param {string} [state] - open / closed / all
 * @param {number} [count] - 获取数量
 * @param {string[]} [labels] - 标签过滤
 * @returns {Promise<object[]>}
 */
async function getIssues(state, count, labels) {
  const { owner, repo } = GITHUB_CONFIG;
  const limit = Math.min(count || 10, 100);
  let apiPath = `/repos/${owner}/${repo}/issues?per_page=${limit}&state=${state || 'open'}`;
  if (labels && labels.length > 0) {
    apiPath += `&labels=${encodeURIComponent(labels.join(','))}`;
  }

  const { data } = await githubRequest('GET', apiPath);

  return data.map(issue => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    author: issue.user.login,
    labels: issue.labels.map(l => l.name),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    is_pull_request: !!issue.pull_request
  }));
}

/**
 * 获取 Pull Requests 列表
 * @param {string} [state] - open / closed / all
 * @param {number} [count] - 获取数量
 * @returns {Promise<object[]>}
 */
async function getPullRequests(state, count) {
  const { owner, repo } = GITHUB_CONFIG;
  const limit = Math.min(count || 10, 100);
  const apiPath = `/repos/${owner}/${repo}/pulls?per_page=${limit}&state=${state || 'open'}`;

  const { data } = await githubRequest('GET', apiPath);

  return data.map(pr => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: pr.user.login,
    head: pr.head.ref,
    base: pr.base.ref,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    merged_at: pr.merged_at,
    draft: pr.draft
  }));
}

/**
 * 触发 GitHub Actions 工作流
 * @param {string} workflowFile - 工作流文件名（如 deploy-to-zhuyuan-server.yml）
 * @param {string} [ref] - 触发分支
 * @param {object} [inputs] - 工作流输入参数
 * @returns {Promise<{triggered: boolean}>}
 */
async function triggerWorkflow(workflowFile, ref, inputs) {
  const { owner, repo } = GITHUB_CONFIG;
  const apiPath = `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

  const body = {
    ref: ref || 'main'
  };
  if (inputs) body.inputs = inputs;

  await githubRequest('POST', apiPath, body);
  return { triggered: true, workflow: workflowFile };
}

// ═══════════════════════════════════════════════════════════
// 连接检查
// ═══════════════════════════════════════════════════════════

/**
 * 检查 GitHub API 连接状态
 * @returns {Promise<{connected: boolean, rate_limit?: object, error?: string}>}
 */
async function checkConnection() {
  if (!GITHUB_CONFIG.token) {
    return { connected: false, reason: 'ZY_GITHUB_PAT 未配置' };
  }
  try {
    const { data } = await githubRequest('GET', '/rate_limit');
    return {
      connected: true,
      rate_limit: {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000).toISOString()
      }
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
    token_configured: !!GITHUB_CONFIG.token,
    owner: GITHUB_CONFIG.owner,
    repo: GITHUB_CONFIG.repo
  };
}

module.exports = {
  readFile,
  listDirectory,
  writeFile,
  getRepoInfo,
  getRecentCommits,
  getIssues,
  getPullRequests,
  triggerWorkflow,
  checkConnection,
  getConfig,
  GITHUB_CONFIG
};
