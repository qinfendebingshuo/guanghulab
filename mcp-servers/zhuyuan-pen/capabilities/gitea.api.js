/**
 * @capability gitea.api
 * @description 调用国内 Gitea API (创建仓库 / push / 读 issue / 写 secret)
 * @signature call({method, path, body, gitea_url, token}) → Promise<{status, body}>
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 */
'use strict';
const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async function giteaCall({ method = 'GET', path: apiPath, body, gitea_url, token }) {
  const base = gitea_url || process.env.CN_GITEA_URL || 'http://127.0.0.1:3000';
  const tok = token || process.env.CN_GITEA_TOKEN;
  if (!tok) throw new Error('gitea.api: missing CN_GITEA_TOKEN');

  const u = new URL(`${base.replace(/\/$/, '')}${apiPath.startsWith('/') ? apiPath : `/api/v1/${apiPath}`}`);
  const lib = u.protocol === 'https:' ? https : http;
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `token ${tok}`,
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
        timeout: 30000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = text;
          try { parsed = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
};
