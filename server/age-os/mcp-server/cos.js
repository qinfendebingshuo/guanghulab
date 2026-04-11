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
  region:    process.env.ZY_COS_REGION || 'ap-guangzhou',
  buckets: {
    hot: process.env.COS_BUCKET_HOT || 'zy-core-bucket-1317346199',
    cold: process.env.COS_BUCKET_COLD || 'zy-corpus-bucket-1317346199',
    team: process.env.ZY_ZHUYUAN_COS_BUCKET || 'zy-team-hub-1317346199'
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
 * 解析桶名称
 * @param {string} bucket - 'hot' | 'cold' | 'team' 或完整桶名
 */
function resolveBucketName(bucket) {
  if (COS_CONFIG.buckets[bucket]) return COS_CONFIG.buckets[bucket];
  return bucket;
}

// ─── 人格体 COS 路径规范 ───
// 团队桶: /{persona_id}/reports/{YYYY-MM-DD}/ — 每日汇报
// 团队桶: /{persona_id}/receipts/{YYYY-MM-DD}/ — 铸渊回执
// 团队桶: /{persona_id}/sync/ — 架构同步区
// 全局:   /zhuyuan/directives/ — 铸渊指令（只读）
// 全局:   /zhuyuan/architecture/ — 架构快照

/**
 * 验证人格体COS路径是否合法（限定在 /{persona_id}/ 目录下）
 */
function validatePersonaCosPath(personaId, key) {
  if (!personaId || typeof personaId !== 'string') {
    throw new Error('persona_id 不能为空');
  }
  // 验证 persona_id 仅包含安全字符（字母、数字、下划线、连字符）
  if (!/^[a-zA-Z0-9_-]+$/.test(personaId)) {
    throw new Error('persona_id 包含非法字符，仅允许字母、数字、下划线、连字符');
  }
  // 规范化：确保路径以 persona_id/ 开头
  const normalizedKey = key.startsWith('/') ? key.slice(1) : key;
  if (!normalizedKey.startsWith(`${personaId}/`)) {
    throw new Error(`COS路径越权: ${key} 不在 /${personaId}/ 目录下`);
  }
  // 防止路径穿越
  if (normalizedKey.includes('..')) {
    throw new Error('COS路径包含非法字符 ".."');
  }
  return normalizedKey;
}

/**
 * 人格体 COS 写入（限定目录）
 */
async function personaWrite(personaId, key, content, contentType) {
  const safeKey = validatePersonaCosPath(personaId, key);
  return write('team', safeKey, content, contentType);
}

/**
 * 人格体 COS 读取（限定目录）
 */
async function personaRead(personaId, key) {
  const safeKey = validatePersonaCosPath(personaId, key);
  return read('team', safeKey);
}

/**
 * 人格体 COS 列表（限定目录）
 */
async function personaList(personaId, subPrefix, limit) {
  const prefix = `${personaId}/${subPrefix || ''}`;
  return list('team', prefix, limit);
}

// ─── 大文件安全阈值 ───
// Node.js字符串最大长度约 512MB (0x1fffffe8 字符)
// 为安全起见，超过此阈值的文件使用 Buffer 模式读取
const MAX_STRING_SAFE_BYTES = 400 * 1024 * 1024; // 400MB

/**
 * 发起 COS HTTP 请求
 *
 * 修复: 签名时必须将URI路径和查询参数分开处理。
 * 腾讯云COS签名规范要求 HttpURI 不包含查询字符串(query string),
 * 否则签名哈希不匹配导致 SignatureDoesNotMatch 错误。
 *
 * @param {object} options - 可选配置
 * @param {number} options.timeout - 超时时间(毫秒)，默认30000
 * @param {boolean} options.rawBuffer - 是否返回原始 Buffer 而非字符串
 */
function cosRequest(bucketName, objectKey, method, body, contentType, options) {
  const { timeout = 30000, rawBuffer = false } = options || {};
  return new Promise((resolve, reject) => {
    const host = getBucketHost(bucketName);
    const fullPath = '/' + objectKey;

    // 签名时只用纯路径(不含查询参数), HTTP请求用完整路径
    const qIdx = fullPath.indexOf('?');
    const signPathname = qIdx >= 0 ? fullPath.substring(0, qIdx) : fullPath;

    const headers = {
      Host: host,
      'Content-Type': contentType || 'application/octet-stream'
    };
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    headers['Authorization'] = generateSignature(method, signPathname, host);

    const req = https.request({
      hostname: host, port: 443, path: fullPath, method, headers, timeout
    }, (res) => {
      // HEAD 请求无响应体
      if (method === 'HEAD') {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: '', headers: res.headers });
        } else {
          reject(new Error(`COS ${method} ${fullPath}: ${res.statusCode}`));
        }
        return;
      }

      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            if (rawBuffer) {
              resolve({ statusCode: res.statusCode, body: buffer, headers: res.headers });
            } else if (buffer.length > MAX_STRING_SAFE_BYTES) {
              reject(new Error(
                `文件过大 (${(buffer.length / 1024 / 1024).toFixed(1)}MB)，` +
                `超过安全字符串转换阈值 (${MAX_STRING_SAFE_BYTES / 1024 / 1024}MB)。` +
                `请使用 readBuffer() 方法读取大文件。`
              ));
            } else {
              const responseBody = buffer.toString('utf8');
              resolve({ statusCode: res.statusCode, body: responseBody, headers: res.headers });
            }
          } else {
            const errorBody = buffer.length > MAX_STRING_SAFE_BYTES
              ? buffer.slice(0, 500).toString('utf8')
              : buffer.toString('utf8');
            reject(new Error(`COS ${method} ${fullPath}: ${res.statusCode} - ${errorBody.substring(0, 200)}`));
          }
        } catch (err) {
          reject(new Error(`COS响应处理失败: ${err.message}`));
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
  const bucketName = resolveBucketName(bucket);
  const result = await cosRequest(bucketName, key, 'PUT', content, contentType || 'text/markdown');
  return {
    url: `https://${getBucketHost(bucketName)}/${key}`,
    size_bytes: Buffer.byteLength(content)
  };
}

async function read(bucket, key) {
  const bucketName = resolveBucketName(bucket);
  const result = await cosRequest(bucketName, key, 'GET');
  return {
    content: result.body,
    size_bytes: Buffer.byteLength(result.body),
    last_modified: result.headers['last-modified'] || null
  };
}

/**
 * 读取文件为 Buffer（不做字符串转换，支持任意大小）
 */
async function readBuffer(bucket, key) {
  const bucketName = resolveBucketName(bucket);
  const result = await cosRequest(bucketName, key, 'GET', null, null, {
    rawBuffer: true,
    timeout: 120000  // 大文件给2分钟超时
  });
  return {
    buffer: result.body,
    size_bytes: result.body.length,
    last_modified: result.headers['last-modified'] || null
  };
}

/**
 * HEAD请求 — 获取文件元数据（大小/类型等），不下载内容
 */
async function head(bucket, key) {
  const bucketName = resolveBucketName(bucket);
  const result = await cosRequest(bucketName, key, 'HEAD');
  return {
    size_bytes: parseInt(result.headers['content-length'] || '0', 10),
    content_type: result.headers['content-type'] || null,
    last_modified: result.headers['last-modified'] || null,
    etag: result.headers['etag'] || null
  };
}

/**
 * 从响应头解析文件总大小（content-range 或 content-length）
 */
function parseTotalSize(headers) {
  // content-range 格式: bytes 0-1023/665000000
  const range = headers['content-range'];
  if (range) {
    const parts = range.split('/');
    if (parts.length === 2) {
      const size = parseInt(parts[1], 10);
      if (!isNaN(size)) return size;
    }
  }
  const cl = parseInt(headers['content-length'] || '0', 10);
  return isNaN(cl) ? 0 : cl;
}

/**
 * 分块读取大文件 — 仅读取前 N 字节用于预览/采样
 * 适用于超大语料文件的类型检测和内容预览
 */
async function readPartial(bucket, key, maxBytes) {
  const limit = maxBytes || 1024 * 1024;  // 默认1MB
  const bucketName = resolveBucketName(bucket);
  const host = getBucketHost(bucketName);
  const fullPath = '/' + key;

  const qIdx = fullPath.indexOf('?');
  const signPathname = qIdx >= 0 ? fullPath.substring(0, qIdx) : fullPath;

  return new Promise((resolve, reject) => {
    const headers = {
      Host: host,
      Range: `bytes=0-${limit - 1}`,
      Authorization: generateSignature('GET', signPathname, host)
    };

    const req = https.request({
      hostname: host, port: 443, path: fullPath, method: 'GET', headers, timeout: 30000
    }, (res) => {
      const chunks = [];
      let received = 0;
      res.on('data', c => {
        chunks.push(c);
        received += c.length;
        if (received >= limit) {
          res.destroy(); // 已收到足够数据，停止接收
        }
      });
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const totalSize = parseTotalSize(res.headers);
          resolve({
            content: buffer.toString('utf8'),
            size_bytes: buffer.length,
            total_size_bytes: totalSize,
            is_partial: totalSize > buffer.length
          });
        } catch (err) {
          reject(new Error(`COS partial read failed: ${err.message}`));
        }
      });
      res.on('close', () => {
        // 如果因 destroy() 而关闭，也处理已收到的数据
        if (chunks.length > 0) {
          try {
            const buffer = Buffer.concat(chunks);
            const totalSize = parseTotalSize(res.headers);
            resolve({
              content: buffer.toString('utf8'),
              size_bytes: buffer.length,
              total_size_bytes: totalSize,
              is_partial: true
            });
          } catch (err) {
            reject(new Error(`COS partial read failed: ${err.message}`));
          }
        }
      });
    });
    req.on('error', (err) => {
      if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
        // 预期行为：主动关闭连接
        return;
      }
      reject(err);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('COS request timeout')); });
    req.end();
  });
}

async function del(bucket, key) {
  const bucketName = resolveBucketName(bucket);
  await cosRequest(bucketName, key, 'DELETE');
  return { success: true };
}

async function list(bucket, prefix, limit) {
  const bucketName = resolveBucketName(bucket);
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

module.exports = {
  write, read, readBuffer, head, readPartial, del, list, archive, checkConnection,
  personaWrite, personaRead, personaList,
  validatePersonaCosPath, resolveBucketName,
  COS_CONFIG, MAX_STRING_SAFE_BYTES
};
