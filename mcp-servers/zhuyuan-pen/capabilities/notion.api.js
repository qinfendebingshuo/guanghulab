/**
 * @capability notion.api
 * @description 调用 Notion API (霜砚联动)
 * @signature call({method, endpoint, body, token}) → Promise<{status, body}>
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 */
'use strict';
const https = require('https');

module.exports = async function notionCall({ method = 'GET', endpoint, body, token }) {
  const tok = token || process.env.CN_NOTION_TOKEN || process.env.ZY_NOTION_TOKEN;
  if (!tok) throw new Error('notion.api: missing token');
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: 'api.notion.com',
        path: `/v1/${endpoint.replace(/^\//, '')}`,
        headers: {
          'Authorization': `Bearer ${tok}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
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
