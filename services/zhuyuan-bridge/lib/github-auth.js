/**
 * services/zhuyuan-bridge/lib/github-auth.js
 *
 * GitHub App 鉴权模块
 * - 用 App Private Key 生成 JWT
 * - 获取 Installation Access Token
 * - 查找仓库对应的 Installation ID
 *
 * 环境变量：
 *   GHAPP_APP_ID       — GitHub App ID
 *   GHAPP_PRIVATE_KEY  — GitHub App Private Key (PEM)
 */

'use strict';

const https = require('https');

// 模块级检查：jsonwebtoken 是否可用
let jwtLib = null;
try { jwtLib = require('jsonwebtoken'); } catch (_) { /* fallback to crypto */ }

/**
 * 用 App Private Key 生成 JWT
 * 优先使用 jsonwebtoken 库，不可用时降级到 Node.js crypto 实现
 */
function generateJWT() {
  const privateKey = process.env.GHAPP_PRIVATE_KEY;
  const appId = process.env.GHAPP_APP_ID;

  if (!privateKey || !appId) {
    throw new Error('GHAPP_APP_ID 和 GHAPP_PRIVATE_KEY 环境变量必须设置');
  }

  if (jwtLib) {
    const payload = {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + (10 * 60),
      iss: appId
    };
    return jwtLib.sign(payload, privateKey, { algorithm: 'RS256' });
  }

  // jsonwebtoken 不可用时，使用 Node.js crypto 实现
  const crypto = require('crypto');

  function base64url(buf) {
    return buf.toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(Buffer.from(JSON.stringify({
    iat: now - 60,
    exp: now + 600,
    iss: appId
  })));

  const sigInput = header + '.' + payload;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(sigInput);
  sign.end();
  const signature = base64url(sign.sign(privateKey));

  return sigInput + '.' + signature;
}

/**
 * GitHub API 请求封装
 */
function githubRequest(method, apiPath, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'User-Agent': 'zhuyuan-bridge/1.0',
        'Accept': 'application/vnd.github+json',
        'Authorization': token.startsWith('Bearer ')
          ? token
          : `token ${token}`
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
 * 获取某个 Installation 的操作令牌
 * @param {number|string} installationId
 * @returns {Promise<string>} Installation access token
 */
async function getInstallationToken(installationId) {
  const jwtToken = generateJWT();
  const result = await githubRequest(
    'POST',
    `/app/installations/${installationId}/access_tokens`,
    `Bearer ${jwtToken}`
  );

  if (result.status !== 201 || !result.data.token) {
    throw new Error(`获取 installation token 失败: ${result.status} ${JSON.stringify(result.data)}`);
  }

  return result.data.token;
}

/**
 * 查找某个仓库的 Installation ID
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<number|null>}
 */
async function findInstallation(owner, repo) {
  const jwtToken = generateJWT();
  const result = await githubRequest(
    'GET',
    '/app/installations',
    `Bearer ${jwtToken}`
  );

  if (result.status !== 200 || !Array.isArray(result.data)) {
    console.warn('⚠️ 获取 installations 列表失败:', result.status);
    return null;
  }

  for (const inst of result.data) {
    try {
      const token = await getInstallationToken(inst.id);
      const reposResult = await githubRequest(
        'GET',
        '/installation/repositories?per_page=100',
        token
      );

      if (reposResult.data.repositories) {
        const found = reposResult.data.repositories.some(
          r => r.full_name === `${owner}/${repo}`
        );
        if (found) return inst.id;
      }
    } catch (e) {
      console.warn(`⚠️ 检查 installation ${inst.id} 失败:`, e.message);
    }
  }

  return null;
}

module.exports = { generateJWT, getInstallationToken, findInstallation, githubRequest };
