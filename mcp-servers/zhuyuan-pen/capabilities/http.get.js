/**
 * @capability http.get
 * @description HTTP GET (用 Node 原生 https/http, 无三方依赖)
 * @signature get(url, options={}) → Promise<{status, headers, body}>
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 */
'use strict';
const http = require('http');
const https = require('https');
const { URL } = require('url');

module.exports = function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'GET',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: options.headers || {},
        timeout: options.timeoutMs || 30000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(options.encoding || 'utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
};
