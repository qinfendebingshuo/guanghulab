/**
 * services/zhuyuan-bridge/lib/repo-operator.js
 *
 * 仓库操作封装 — 通过 GitHub API 读写代码、创建分支和 PR
 *
 * 纯 Node.js，无外部依赖。
 */

'use strict';

const https = require('https');

class RepoOperator {
  /**
   * @param {string} token  — GitHub access token
   * @param {string} owner  — Repository owner
   * @param {string} repo   — Repository name
   */
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = `/repos/${owner}/${repo}`;
  }

  /**
   * GitHub API 请求
   */
  _request(method, apiPath, body) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: apiPath,
        method: method,
        headers: {
          'User-Agent': 'zhuyuan-bridge/1.0',
          'Accept': 'application/vnd.github+json',
          'Authorization': `token ${this.token}`,
        }
      };
      if (body) {
        options.headers['Content-Type'] = 'application/json';
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (_) {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  /**
   * 读取文件内容
   * @param {string} filePath
   * @param {string} ref  — branch or commit SHA
   * @returns {Promise<{content: string, sha: string}|null>}
   */
  async readFile(filePath, ref = 'main') {
    const res = await this._request(
      'GET',
      `${this.baseUrl}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`
    );
    if (res.status !== 200) return null;
    return {
      content: Buffer.from(res.data.content, 'base64').toString('utf8'),
      sha: res.data.sha
    };
  }

  /**
   * 创建或更新文件
   * @param {string} filePath
   * @param {string} content
   * @param {string} message  — commit message
   * @param {string} branch
   * @returns {Promise<object>}
   */
  async writeFile(filePath, content, message, branch = 'main') {
    let sha;
    try {
      const existing = await this.readFile(filePath, branch);
      if (existing) sha = existing.sha;
    } catch (_) { /* new file */ }

    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      committer: {
        name: '铸渊 (ZhùYuān)',
        email: 'zhuyuan@guanghulab.com'
      }
    };
    if (sha) body.sha = sha;

    const res = await this._request(
      'PUT',
      `${this.baseUrl}/contents/${encodeURIComponent(filePath)}`,
      body
    );
    return res.data;
  }

  /**
   * 创建分支
   * @param {string} branchName
   * @param {string} fromBranch
   * @returns {Promise<object>}
   */
  async createBranch(branchName, fromBranch = 'main') {
    const refRes = await this._request(
      'GET',
      `${this.baseUrl}/git/ref/heads/${encodeURIComponent(fromBranch)}`
    );

    if (refRes.status !== 200) {
      throw new Error(`获取分支 ${fromBranch} 失败: ${refRes.status}`);
    }

    const res = await this._request(
      'POST',
      `${this.baseUrl}/git/refs`,
      {
        ref: `refs/heads/${branchName}`,
        sha: refRes.data.object.sha
      }
    );
    return res.data;
  }

  /**
   * 创建 Pull Request
   * @param {string} title
   * @param {string} body
   * @param {string} head  — source branch
   * @param {string} base  — target branch
   * @returns {Promise<object>}
   */
  async createPR(title, body, head, base = 'main') {
    const res = await this._request(
      'POST',
      `${this.baseUrl}/pulls`,
      { title, body, head, base }
    );
    return res.data;
  }

  /**
   * 评论 Issue
   * @param {number} issueNumber
   * @param {string} body
   * @returns {Promise<object>}
   */
  async commentOnIssue(issueNumber, body) {
    const res = await this._request(
      'POST',
      `${this.baseUrl}/issues/${issueNumber}/comments`,
      { body }
    );
    return res.data;
  }

  /**
   * 创建 Issue
   * @param {string} title
   * @param {string} body
   * @param {string[]} labels
   * @returns {Promise<object>}
   */
  async createIssue(title, body, labels = []) {
    const res = await this._request(
      'POST',
      `${this.baseUrl}/issues`,
      { title, body, labels }
    );
    return res.data;
  }

  /**
   * 列出目录文件
   * @param {string} dirPath
   * @param {string} ref
   * @returns {Promise<Array>}
   */
  async listDir(dirPath, ref = 'main') {
    const encodedPath = dirPath ? encodeURIComponent(dirPath) : '';
    const res = await this._request(
      'GET',
      `${this.baseUrl}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`
    );
    if (res.status !== 200) return [];
    return Array.isArray(res.data) ? res.data : [];
  }
}

module.exports = { RepoOperator };
