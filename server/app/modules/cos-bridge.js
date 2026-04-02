/**
 * ═══════════════════════════════════════════════════════════
 * 🗄️ COS 双桶桥接模块 · COS Dual-Bucket Bridge
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-COS-BRIDGE-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 双桶架构:
 *   zy-core-bucket   — 核心人格体大脑 (铸渊 + Notion人格体各占一半)
 *   zy-corpus-bucket  — 语料库 (GPT-4o聊天记录 + Notion数据导出)
 *
 * 轻量级COS HTTP API封装 — 不依赖SDK，直接用签名请求
 */

'use strict';

const crypto = require('crypto');
const https = require('https');
const path = require('path');
const fs = require('fs');

// ─── 配置 ───
const COS_CONFIG = {
  secretId: process.env.ZY_OSS_KEY || '',
  secretKey: process.env.ZY_OSS_SECRET || '',
  region: process.env.ZY_COS_REGION || 'ap-guangzhou',
  buckets: {
    core: {
      name: 'zy-core-bucket',
      purpose: '核心人格体大脑',
      structure: {
        'zhuyuan/': '铸渊大脑 — GitHub侧人格体记忆',
        'notion-personas/': 'Notion侧人格体记忆',
        'shared/': '共享认知层 — 双侧共用',
        'users/': '用户记忆档案 — 按编号存储',
        'index/': '索引文件 — 快速检索'
      }
    },
    corpus: {
      name: 'zy-corpus-bucket',
      purpose: '语料库',
      structure: {
        'gpt4o-exports/': 'GPT-4o聊天记录导出',
        'notion-exports/': 'Notion数据库导出',
        'processed/': '已处理的结构化数据',
        'thinking-patterns/': '思维模式提取结果',
        'training/': '训练数据集'
      }
    }
  }
};

/**
 * 生成COS API签名
 */
function generateSignature(method, pathname, headers, secretId, secretKey) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 600; // 10分钟有效
  const keyTime = `${now};${expiry}`;

  // SignKey
  const signKey = crypto.createHmac('sha1', secretKey).update(keyTime).digest('hex');

  // HttpString
  const httpString = `${method.toLowerCase()}\n${pathname}\n\nhost=${headers.Host}\n`;

  // StringToSign
  const sha1HttpString = crypto.createHash('sha1').update(httpString).digest('hex');
  const stringToSign = `sha1\n${keyTime}\n${sha1HttpString}\n`;

  // Signature
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');

  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;
}

/**
 * 获取桶的完整域名
 * 注意: bucketName需包含appid后缀，如 zy-core-bucket-1234567890
 * 冰朔在腾讯云创建桶时的完整名称需配置在COS_CONFIG中
 */
function getBucketHost(bucketName, region) {
  return `${bucketName}.cos.${region}.myqcloud.com`;
}

/**
 * 发起COS请求
 */
function cosRequest(bucketName, objectKey, method, body, contentType) {
  return new Promise((resolve, reject) => {
    const host = getBucketHost(bucketName, COS_CONFIG.region);
    const pathname = '/' + objectKey;

    const headers = {
      Host: host,
      'Content-Type': contentType || 'application/octet-stream'
    };

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const authorization = generateSignature(
      method, pathname, headers,
      COS_CONFIG.secretId, COS_CONFIG.secretKey
    );

    headers['Authorization'] = authorization;

    const options = {
      hostname: host,
      port: 443,
      path: pathname,
      method: method,
      headers: headers,
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: responseBody, headers: res.headers });
        } else {
          reject(new Error(`COS ${method} ${pathname} failed: ${res.statusCode} - ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('COS request timeout')); });

    if (body) req.write(body);
    req.end();
  });
}

// ─── 公开API ───

/**
 * 写入对象到核心桶
 */
async function writeCore(key, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return cosRequest(COS_CONFIG.buckets.core.name, key, 'PUT', body, 'application/json');
}

/**
 * 读取核心桶对象
 */
async function readCore(key) {
  const result = await cosRequest(COS_CONFIG.buckets.core.name, key, 'GET');
  try {
    return JSON.parse(result.body);
  } catch {
    return result.body;
  }
}

/**
 * 写入对象到语料桶
 */
async function writeCorpus(key, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return cosRequest(COS_CONFIG.buckets.corpus.name, key, 'PUT', body, 'application/json');
}

/**
 * 读取语料桶对象
 */
async function readCorpus(key) {
  const result = await cosRequest(COS_CONFIG.buckets.corpus.name, key, 'GET');
  try {
    return JSON.parse(result.body);
  } catch {
    return result.body;
  }
}

/**
 * 检查COS连接状态
 */
async function checkConnection() {
  if (!COS_CONFIG.secretId || !COS_CONFIG.secretKey) {
    return {
      connected: false,
      reason: 'COS密钥未配置 — 需要在GitHub Secrets配置ZY_OSS_KEY和ZY_OSS_SECRET',
      buckets: {
        core: { name: COS_CONFIG.buckets.core.name, status: 'unconfigured' },
        corpus: { name: COS_CONFIG.buckets.corpus.name, status: 'unconfigured' }
      }
    };
  }

  const results = { connected: true, buckets: {} };

  for (const [key, bucket] of Object.entries(COS_CONFIG.buckets)) {
    try {
      await cosRequest(bucket.name, '', 'HEAD');
      results.buckets[key] = { name: bucket.name, status: 'connected', purpose: bucket.purpose };
    } catch (err) {
      results.buckets[key] = { name: bucket.name, status: 'error', error: err.message };
      results.connected = false;
    }
  }

  return results;
}

/**
 * 保存用户记忆到核心桶（团队内测用户 → COS）
 */
async function saveUserMemory(userId, memoryData) {
  const key = `users/${userId}/memory.json`;
  const wrapped = {
    user_id: userId,
    user_tier: 'team', // team = 内测团队 / public = 普通用户（后期单独存储）
    updated_at: new Date().toISOString(),
    version: 1,
    memories: memoryData
  };
  return writeCore(key, wrapped);
}

/**
 * 读取用户记忆
 */
async function loadUserMemory(userId) {
  try {
    const key = `users/${userId}/memory.json`;
    return await readCore(key);
  } catch {
    return { user_id: userId, user_tier: 'team', memories: [], version: 0 };
  }
}

/**
 * 保存用户作品到核心桶（团队用户）
 */
async function saveUserWorks(userId, worksData) {
  const key = `users/${userId}/works.json`;
  return writeCore(key, {
    user_id: userId,
    user_tier: 'team',
    updated_at: new Date().toISOString(),
    works: worksData
  });
}

/**
 * 读取用户作品
 */
async function loadUserWorks(userId) {
  try {
    const key = `users/${userId}/works.json`;
    return await readCore(key);
  } catch {
    return { user_id: userId, works: [] };
  }
}

/**
 * 获取COS配置信息（不含密钥）
 */
function getConfig() {
  return {
    region: COS_CONFIG.region,
    configured: !!(COS_CONFIG.secretId && COS_CONFIG.secretKey),
    buckets: {
      core: {
        name: COS_CONFIG.buckets.core.name,
        purpose: COS_CONFIG.buckets.core.purpose,
        structure: COS_CONFIG.buckets.core.structure
      },
      corpus: {
        name: COS_CONFIG.buckets.corpus.name,
        purpose: COS_CONFIG.buckets.corpus.purpose,
        structure: COS_CONFIG.buckets.corpus.structure
      }
    }
  };
}

module.exports = {
  writeCore,
  readCore,
  writeCorpus,
  readCorpus,
  checkConnection,
  saveUserMemory,
  loadUserMemory,
  saveUserWorks,
  loadUserWorks,
  getConfig,
  COS_CONFIG
};
