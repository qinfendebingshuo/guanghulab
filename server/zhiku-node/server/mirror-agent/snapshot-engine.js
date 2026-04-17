/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · Step 1 · 照镜子 — 快照引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 定时拉取第三方书库的公开 API 元数据（只读·不写·不改·不爬内容页）
 * 生成本地快照用于后续 diff 比较
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { MIRROR_CONFIG, getEnabledSources } = require('./config');

/**
 * 简易 HTTP GET（不引入额外依赖）
 */
function httpGet(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

/**
 * 生成快照文件名
 */
function snapshotFilename(sourceId) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sourceId}_${ts}.json`;
}

/**
 * 获取最新的快照文件路径
 */
function getLatestSnapshot(sourceId) {
  const dir = MIRROR_CONFIG.snapshot_dir;
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(sourceId + '_') && f.endsWith('.json'))
      .sort()
      .reverse();
    return files.length > 0 ? path.join(dir, files[0]) : null;
  } catch {
    return null;
  }
}

/**
 * 探测数据源的可用性和版本信息
 */
async function probeSource(source) {
  const result = {
    source_id: source.id,
    source_name: source.name,
    probed_at: new Date().toISOString(),
    reachable: false,
    version: null,
    error: null
  };

  try {
    // 尝试获取版本信息
    if (source.version_url) {
      const versionUrl = source.version_url.replace('{base_url}', source.base_url);
      const resp = await httpGet(versionUrl);
      result.reachable = true;
      try {
        result.version = JSON.parse(resp.body);
      } catch {
        result.version = resp.body.slice(0, 500);
      }
    } else {
      // 没有版本接口，尝试搜索一个空串做连通性测试
      const testUrl = source.search_url
        .replace('{base_url}', source.base_url)
        .replace('{query}', 'test')
        .replace('{page}', '1')
        .replace('{keyword}', 'test');
      await httpGet(testUrl);
      result.reachable = true;
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * 检查 GitHub 仓库的最新 release/commit 信息
 * 用于判断上游项目是否有更新
 */
async function checkGitHubUpdate(githubRepoUrl) {
  if (!githubRepoUrl) return null;

  // 从 URL 提取 owner/repo
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const [, owner, repo] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  try {
    const resp = await httpGet(apiUrl);
    const release = JSON.parse(resp.body);
    return {
      tag: release.tag_name,
      name: release.name,
      published_at: release.published_at,
      html_url: release.html_url
    };
  } catch {
    // 没有 release，尝试获取最新 commit
    try {
      const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;
      const resp = await httpGet(commitUrl);
      const commits = JSON.parse(resp.body);
      if (commits.length > 0) {
        return {
          type: 'commit',
          sha: commits[0].sha.slice(0, 7),
          message: commits[0].commit.message.slice(0, 100),
          date: commits[0].commit.committer.date,
          html_url: commits[0].html_url
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 对单个数据源执行完整快照
 *
 * 快照内容：
 *   - 数据源可用性探测
 *   - GitHub 上游版本检查
 *   - 热门/推荐书目元数据样本（如有 API）
 */
async function takeSnapshot(source) {
  const snapshot = {
    source_id: source.id,
    source_name: source.name,
    snapshot_at: new Date().toISOString(),
    probe: null,
    upstream: null,
    sample_books: [],
    errors: []
  };

  // 1. 探测可用性
  try {
    snapshot.probe = await probeSource(source);
  } catch (err) {
    snapshot.errors.push({ step: 'probe', error: err.message });
  }

  // 2. 检查 GitHub 上游更新
  try {
    snapshot.upstream = await checkGitHubUpdate(source.github_repo);
  } catch (err) {
    snapshot.errors.push({ step: 'github_check', error: err.message });
  }

  // 3. 尝试搜索几个常见关键词获取书目样本（仅元数据）
  if (snapshot.probe && snapshot.probe.reachable) {
    const sampleKeywords = ['玄幻', '都市', '言情'];
    for (const keyword of sampleKeywords) {
      try {
        const searchUrl = source.search_url
          .replace('{base_url}', source.base_url)
          .replace('{query}', encodeURIComponent(keyword))
          .replace('{keyword}', encodeURIComponent(keyword))
          .replace('{page}', '1');
        const resp = await httpGet(searchUrl);
        const data = JSON.parse(resp.body);

        // 只保留元数据（标题、作者、ID），不保存内容
        const books = Array.isArray(data) ? data : (data.books || data.data || data.list || []);
        const metaOnly = books.slice(0, 5).map(b => ({
          id: b.book_id || b.id || b.bookId,
          title: b.title || b.book_name || b.name,
          author: b.author || b.author_name,
          category: b.category || b.genre || b.tag
        }));

        snapshot.sample_books.push({
          keyword,
          count: books.length,
          sample: metaOnly
        });
      } catch (err) {
        snapshot.errors.push({ step: `search_${keyword}`, error: err.message });
      }
    }
  }

  // 4. 保存快照文件
  const filename = snapshotFilename(source.id);
  const filepath = path.join(MIRROR_CONFIG.snapshot_dir, filename);
  try {
    fs.mkdirSync(MIRROR_CONFIG.snapshot_dir, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (err) {
    snapshot.errors.push({ step: 'save', error: err.message });
  }

  return { filepath, snapshot };
}

/**
 * 对所有启用的数据源执行快照
 */
async function takeAllSnapshots() {
  const sources = getEnabledSources();
  const results = [];

  for (const source of sources) {
    try {
      const result = await takeSnapshot(source);
      results.push(result);
    } catch (err) {
      results.push({
        filepath: null,
        snapshot: {
          source_id: source.id,
          source_name: source.name,
          snapshot_at: new Date().toISOString(),
          errors: [{ step: 'fatal', error: err.message }]
        }
      });
    }
  }

  return results;
}

module.exports = {
  httpGet,
  probeSource,
  checkGitHubUpdate,
  takeSnapshot,
  takeAllSnapshots,
  getLatestSnapshot,
  snapshotFilename
};
