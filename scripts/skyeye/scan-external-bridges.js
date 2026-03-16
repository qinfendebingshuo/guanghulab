// scripts/skyeye/scan-external-bridges.js
// 天眼·扫描模块D · 外部桥接状态扫描
//
// 扫描内容：
//   ① Notion API 连通性（用 NOTION_TOKEN 测试）
//   ② 服务器 SSH 连通性（检测 DEPLOY_HOST 配置）
//   ③ GitHub API 有效性 + 配额
//   ④ Secrets 完整性（NOTION_TOKEN, DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY, SMTP_USER, SMTP_PASS）
//
// 输出：JSON → stdout
//
// 注意：此脚本在 GitHub Actions 中运行，通过环境变量获取 secrets 存在性

'use strict';

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const now = new Date();

// ━━━ 检查 Secrets 完整性（仅检查环境变量是否被设置） ━━━
function checkSecrets() {
  const requiredSecrets = [
    'NOTION_TOKEN',
    'DEPLOY_HOST',
    'DEPLOY_USER',
    'DEPLOY_KEY',
    'SMTP_USER',
    'SMTP_PASS'
  ];

  const results = [];
  let allPresent = true;

  for (const secret of requiredSecrets) {
    const present = !!process.env[secret] && process.env[secret].length > 0;
    if (!present) allPresent = false;
    results.push({ name: secret, present });
  }

  return {
    complete: allPresent,
    secrets: results,
    missing: results.filter(s => !s.present).map(s => s.name)
  };
}

// ━━━ 检查 Notion API 连通性 ━━━
async function checkNotionAPI() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return { status: '🔴', detail: 'NOTION_TOKEN 未设置', connected: false };
  }

  try {
    // Use native https to avoid dependency on axios
    const result = await new Promise((resolve, reject) => {
      const https = require('https');
      const options = {
        hostname: 'api.notion.com',
        path: '/v1/users/me',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Notion-Version': '2022-06-28'
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      });

      req.on('error', (e) => reject(e));
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });

    if (result.statusCode === 200) {
      return { status: '🟢', detail: 'Notion API 连通', connected: true };
    } else {
      return { status: '🟡', detail: `Notion API 返回 ${result.statusCode}`, connected: false };
    }
  } catch (e) {
    return { status: '🔴', detail: 'Notion API 请求失败: ' + e.message, connected: false };
  }
}

// ━━━ 检查 GitHub API ━━━
async function checkGitHubAPI() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

  try {
    const https = require('https');
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: '/rate_limit',
        method: 'GET',
        headers: {
          'User-Agent': 'skyeye-scanner',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      };

      if (token) {
        options.headers['Authorization'] = 'Bearer ' + token;
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      });

      req.on('error', (e) => reject(e));
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });

    if (result.statusCode === 200) {
      try {
        const rateData = JSON.parse(result.body);
        const core = rateData.resources && rateData.resources.core;
        return {
          status: '🟢',
          detail: 'GitHub API 连通',
          connected: true,
          rate_limit: core ? { remaining: core.remaining, limit: core.limit } : null
        };
      } catch (e) {
        return { status: '🟢', detail: 'GitHub API 连通（无法解析配额）', connected: true };
      }
    } else {
      return { status: '🟡', detail: `GitHub API 返回 ${result.statusCode}`, connected: false };
    }
  } catch (e) {
    return { status: '🔴', detail: 'GitHub API 请求失败: ' + e.message, connected: false };
  }
}

// ━━━ 检查服务器 SSH ━━━
function checkServerSSH() {
  const host = process.env.DEPLOY_HOST;
  const user = process.env.DEPLOY_USER;
  const key  = process.env.DEPLOY_KEY;

  if (!host) {
    return { status: '🟡', detail: 'DEPLOY_HOST 未设置', connected: false };
  }

  // SSH connectivity check would require actually connecting
  // In CI, we just verify the credentials are available
  const hasCredentials = !!(host && user && key);
  return {
    status: hasCredentials ? '🟡' : '🔴',
    detail: hasCredentials
      ? '服务器凭证已配置（SSH 连通性需运行时验证）'
      : '服务器凭证不完整',
    connected: null, // Cannot verify without actual SSH
    credentials_present: hasCredentials
  };
}

// ━━━ 主扫描 ━━━
async function scanExternalBridges() {
  const result = {
    scan_time: new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    notion_api: { status: '⏳', detail: '检查中...' },
    github_api: { status: '⏳', detail: '检查中...' },
    server_ssh: checkServerSSH(),
    secrets: checkSecrets(),
    // Summary
    all_bridges_ok: false
  };

  // Parallel API checks
  const [notionResult, githubResult] = await Promise.all([
    checkNotionAPI().catch(e => ({ status: '🔴', detail: '检查异常: ' + e.message, connected: false })),
    checkGitHubAPI().catch(e => ({ status: '🔴', detail: '检查异常: ' + e.message, connected: false }))
  ]);

  result.notion_api = notionResult;
  result.github_api = githubResult;

  // Summary
  result.all_bridges_ok =
    result.notion_api.status === '🟢' &&
    result.github_api.status === '🟢' &&
    result.secrets.complete;

  console.log(JSON.stringify(result, null, 2));
}

scanExternalBridges();
