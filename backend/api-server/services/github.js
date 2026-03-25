/**
 * GitHub API 服务封装
 *
 * 通过 GitHub API 获取仓库状态、提交记录等信息。
 * 使用 GITHUB_TOKEN 环境变量认证。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var https = require('https');

var GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
var ORG = 'qinfendebingshuo';

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

function githubRequest(apiPath) {
  return new Promise(function(resolve, reject) {
    var headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'guanghu-api-server/1.0'
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = 'Bearer ' + GITHUB_TOKEN;
    }

    var options = {
      hostname: 'api.github.com',
      port: 443,
      path: apiPath,
      method: 'GET',
      headers: headers
    };

    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ error: 'JSON parse failed' }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ====== 获取仓库信息 ======
async function getRepoStatus(repoName) {
  repoName = repoName || 'guanghulab';
  var cacheKey = 'repo:' + repoName;
  var cached = getCached(cacheKey);
  if (cached) return cached;

  var repo = await githubRequest('/repos/' + ORG + '/' + repoName);
  var result = {
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    default_branch: repo.default_branch,
    open_issues_count: repo.open_issues_count,
    stargazers_count: repo.stargazers_count,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at
  };
  setCache(cacheKey, result);
  return result;
}

// ====== 获取最近提交 ======
async function getRecentCommits(repoName, count) {
  repoName = repoName || 'guanghulab';
  count = count || 10;
  var cacheKey = 'commits:' + repoName + ':' + count;
  var cached = getCached(cacheKey);
  if (cached) return cached;

  var commits = await githubRequest('/repos/' + ORG + '/' + repoName + '/commits?per_page=' + count);
  var result = Array.isArray(commits) ? commits.map(function(c) {
    return {
      sha: c.sha ? c.sha.substring(0, 7) : '',
      message: c.commit ? c.commit.message.split('\n')[0] : '',
      date: c.commit && c.commit.author ? c.commit.author.date : '',
      author: c.commit && c.commit.author ? c.commit.author.name : ''
    };
  }) : [];
  setCache(cacheKey, result);
  return result;
}

// ====== 获取 Workflow 状态 ======
async function getWorkflowRuns(repoName, count) {
  repoName = repoName || 'guanghulab';
  count = count || 10;
  var cacheKey = 'workflows:' + repoName + ':' + count;
  var cached = getCached(cacheKey);
  if (cached) return cached;

  var runs = await githubRequest('/repos/' + ORG + '/' + repoName + '/actions/runs?per_page=' + count);
  var result = (runs.workflow_runs || []).map(function(r) {
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      created_at: r.created_at,
      updated_at: r.updated_at,
      html_url: r.html_url
    };
  });
  setCache(cacheKey, result);
  return result;
}

// ====== 触发 GitHub Actions Workflow ======
function triggerWorkflow(workflowFile, inputs) {
  return new Promise(function(resolve, reject) {
    var data = JSON.stringify({
      ref: 'main',
      inputs: inputs || {}
    });

    var headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'guanghu-api-server/1.0',
      'Content-Length': Buffer.byteLength(data)
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = 'Bearer ' + GITHUB_TOKEN;
    }

    var options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/' + ORG + '/guanghulab/actions/workflows/' + workflowFile + '/dispatches',
      method: 'POST',
      headers: headers
    };

    var req = https.request(options, function(res) {
      if (res.statusCode === 204) {
        resolve({ success: true });
      } else {
        var body = '';
        res.on('data', function(chunk) { body += chunk; });
        res.on('end', function() {
          reject(new Error('GitHub API ' + res.statusCode + ': ' + body));
        });
      }
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ====== 创建 GitHub 文件 ======
function createFile(filePath, content, message) {
  return new Promise(function(resolve, reject) {
    var data = JSON.stringify({
      message: message,
      content: Buffer.from(content).toString('base64'),
      committer: {
        name: '铸渊 (ZhùYuān)',
        email: 'zhuyuan@guanghulab.com'
      }
    });

    var headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'guanghu-api-server/1.0',
      'Content-Length': Buffer.byteLength(data)
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = 'Bearer ' + GITHUB_TOKEN;
    }

    var options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/' + ORG + '/guanghulab/contents/' + filePath,
      method: 'PUT',
      headers: headers
    };

    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  getRepoStatus: getRepoStatus,
  getRecentCommits: getRecentCommits,
  getWorkflowRuns: getWorkflowRuns,
  triggerWorkflow: triggerWorkflow,
  createFile: createFile
};
