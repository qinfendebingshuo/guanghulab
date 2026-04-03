/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · COS 双桶客户端
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 复用 server/app/modules/cos-bridge.js 的签名逻辑
 * 新增: hot/cold 双桶路径规范 + archive 操作
 */

'use strict';

const crypto = require('crypto');
const https = require('https');

// ─── 配置 ───
const COS_CONFIG = {
  secretId:  process.env.ZY_OSS_KEY || '',
  secretKey: process.env.ZY_OSS_SECRET || '',
  region:    process.env.ZY_COS_REGION || 'ap-singapore',
  buckets: {
    hot: process.env.COS_BUCKET_HOT || 'zy-core-bucket-1317346199',
    cold: process.env.COS_BUCKET_COLD || 'zy-corpus-bucket-1317346199'
  }
};

// ─── 路径规范 ───
// 热桶: /brain/{owner}/{node_type}/{node_id}.md
// 冷桶: /archive/{owner}/{year}/{month}/{node_id}_{version}.md

/**
 * 生成 COS API 签名
 */
function generateSignature(method, pathname, host) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 600;
  const keyTime = `${now};${expiry}`;

  const signKey = crypto.createHmac('sha1', COS_CONFIG.secretKey).update(keyTime).digest('hex');
  const httpString = `${method.toLowerCase()}\n${pathname}\n\nhost=${host}\n`;
  const sha1Http = crypto.createHash('sha1').update(httpString).digest('hex');
  const stringToSign = `sha1\n${keyTime}\n${sha1Http}\n`;
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');

  return `q-sign-algorithm=sha1&q-ak=${COS_CONFIG.secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;
}

function getBucketHost(bucketName) {
  return `${bucketName}.cos.${COS_CONFIG.region}.myqcloud.com`;
}

/**
 * 发起 COS HTTP 请求
 */
function cosRequest(bucketName, objectKey, method, body, contentType) {
  return new Promise((resolve, reject) => {
    const host = getBucketHost(bucketName);
    const pathname = '/' + objectKey;
    const headers = {
      Host: host,
      'Content-Type': contentType || 'application/octet-stream'
    };
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    headers['Authorization'] = generateSignature(method, pathname, host);

    const req = https.request({
      hostname: host, port: 443, path: pathname, method, headers, timeout: 30000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: responseBody, headers: res.headers });
        } else {
          reject(new Error(`COS ${method} ${pathname}: ${res.statusCode} - ${responseBody.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('COS request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ─── 公开 API ───

async function write(bucket, key, content, contentType) {
  const bucketName = bucket === 'hot' ? COS_CONFIG.buckets.hot : COS_CONFIG.buckets.cold;
  const result = await cosRequest(bucketName, key, 'PUT', content, contentType || 'text/markdown');
  return {
    url: `https://${getBucketHost(bucketName)}/${key}`,
    size_bytes: Buffer.byteLength(content)
  };
}

async function read(bucket, key) {
  const bucketName = bucket === 'hot' ? COS_CONFIG.buckets.hot : COS_CONFIG.buckets.cold;
  const result = await cosRequest(bucketName, key, 'GET');
  return {
    content: result.body,
    size_bytes: Buffer.byteLength(result.body),
    last_modified: result.headers['last-modified'] || null
  };
}

async function del(bucket, key) {
  const bucketName = bucket === 'hot' ? COS_CONFIG.buckets.hot : COS_CONFIG.buckets.cold;
  await cosRequest(bucketName, key, 'DELETE');
  return { success: true };
}

async function list(bucket, prefix, limit) {
  const bucketName = bucket === 'hot' ? COS_CONFIG.buckets.hot : COS_CONFIG.buckets.cold;
  const host = getBucketHost(bucketName);
  const queryStr = `prefix=${encodeURIComponent(prefix)}&max-keys=${limit || 100}`;
  const result = await cosRequest(bucketName, `?${queryStr}`, 'GET');
  // 解析 XML 列表（简化版）
  const files = [];
  const keyRegex = /<Key>([^<]+)<\/Key>/g;
  const sizeRegex = /<Size>(\d+)<\/Size>/g;
  let match;
  while ((match = keyRegex.exec(result.body)) !== null) {
    const sizeMatch = sizeRegex.exec(result.body);
    files.push({
      key: match[1],
      size_bytes: sizeMatch ? parseInt(sizeMatch[1], 10) : 0
    });
  }
  return { files };
}

async function archive(sourceKey, versionTag) {
  const version = versionTag || new Date().toISOString().replace(/[:.]/g, '-');
  const now = new Date();
  const archiveKey = sourceKey.replace(/^brain\//, `archive/`).replace(/\.md$/, `_${version}.md`);

  // 1. 从热桶读取
  const content = await read('hot', sourceKey);
  // 2. 写入冷桶
  const archiveResult = await write('cold', archiveKey, content.content);
  // 3. 从热桶删除
  await del('hot', sourceKey);

  return {
    archive_url: archiveResult.url,
    version
  };
}

async function checkConnection() {
  if (!COS_CONFIG.secretId || !COS_CONFIG.secretKey) {
    return { connected: false, reason: 'COS密钥未配置' };
  }
  try {
    await list('hot', 'brain/', 1);
    return { connected: true };
  } catch (err) {
    return { connected: false, reason: err.message };
  }
}

module.exports = { write, read, del, list, archive, checkConnection, COS_CONFIG };
