/**
 * @capability secrets.fetch
 * @description 从国内域名机本地 vault 拉密钥 (走 127.0.0.1 loopback). 不走环境变量, 不走 GitHub Secrets.
 * @signature secrets.fetch({key, vault_url?}) → Promise<{value}>
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 *
 * 注: 这个能力**只在域名机本地 (ZY-SVR-CN01) 跑神笔马良时**可用. 它会走
 *     vault 的 /internal/fetch/:key 端点, 该端点只接受 127.0.0.1 来源, 因此:
 *
 *     - 域名机本地神笔马良 → 通
 *     - 海外机 / 开发者本地 → 拒绝 (vault 那边返 403)
 *
 *     这是 baton-005 C 节的设计: 神笔马良不持有任何长期密钥, 现取现用.
 */
'use strict';

module.exports = async function secretsFetch({ key, vault_url } = {}) {
  if (!key || typeof key !== 'string') {
    throw new Error('secrets.fetch: key 必填 (例: ZY_AUTODL_PASS)');
  }
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) {
    throw new Error('secrets.fetch: key 格式不对 (大写字母+数字+下划线, 字母开头, 2-64 位)');
  }

  const base = vault_url || process.env.VAULT_INTERNAL_URL || 'http://127.0.0.1:8080';
  // 严守"只本机"边界 — 即使调用方乱传, 这里也强制只允许 loopback host
  let urlObj;
  try {
    urlObj = new URL(base);
  } catch (e) {
    throw new Error('secrets.fetch: vault_url 不是合法 URL');
  }
  if (
    urlObj.hostname !== '127.0.0.1' &&
    urlObj.hostname !== 'localhost' &&
    urlObj.hostname !== '::1'
  ) {
    throw new Error(
      'secrets.fetch: vault 只允许走 loopback (127.0.0.1 / localhost / ::1), 当前=' +
        urlObj.hostname +
        '. 这是 cc-004 强制隔离, 不可绕过.'
    );
  }

  const http = require('http');
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'GET',
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: '/internal/fetch/' + encodeURIComponent(key),
        timeout: 5000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body;
          try {
            body = JSON.parse(text);
          } catch (e) {
            return reject(new Error('secrets.fetch: vault 响应不是 JSON: ' + text.slice(0, 120)));
          }
          if (res.statusCode === 200 && body && body.ok) {
            return resolve({ key, value: body.value });
          }
          return reject(
            new Error(
              'secrets.fetch: vault 拒绝 (status=' +
                res.statusCode +
                ', code=' +
                (body && body.code) +
                ', message=' +
                (body && body.message) +
                ')'
            )
          );
        });
      }
    );
    req.on('error', (e) => reject(new Error('secrets.fetch: 连不上 vault (' + e.message + ')')));
    req.on('timeout', () => req.destroy(new Error('secrets.fetch: vault 响应超时 (5s)')));
    req.end();
  });
};
