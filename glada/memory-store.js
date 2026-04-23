/**
 * GLADA · 双层记忆存储 · memory-store.js
 *
 * 映川的云端Agent记忆：
 *   第一层：COS存储桶（热存储，快速读写，实时状态）
 *   第二层：代码仓库（冷备份，永久不丢，Git历史可追溯）
 *
 * 每次任务完成后：
 *   1. 先写COS热桶 → 快（毫秒级）
 *   2. 再写Git仓库 → 慢但永久（下次唤醒时同步）
 *
 * 每次唤醒时：
 *   1. 先读COS热桶 → 最新状态
 *   2. COS不可用时回退读Git仓库 → 保底
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：霜砚 · AG-SY-WEB-001 · 受冰朔指令
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// ==================== COS 配置 ====================

const COS_CONFIG = {
  // 热桶：核心人格体大脑
  bucket: process.env.COS_BUCKET_HOT || 'zy-core-bucket-1317346199',
  region: process.env.ZY_COS_REGION || 'ap-guangzhou',
  secretId: process.env.ZY_OSS_KEY || '',
  secretKey: process.env.ZY_OSS_SECRET || '',
  // 映川记忆在COS中的路径
  basePath: 'glada/yingchuan-memory/',
};

// Git仓库中的记忆路径
const GIT_MEMORY_DIR = path.join(ROOT, 'glada', 'memory');

// ==================== COS 签名工具 ====================

/**
 * 生成腾讯云COS请求签名
 * 参考: https://cloud.tencent.com/document/product/436/7778
 */
function cosSign(method, cosPath, headers = {}, params = {}, expireSeconds = 600) {
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now};${now + expireSeconds}`;

  // SignKey
  const signKey = crypto.createHmac('sha1', COS_CONFIG.secretKey)
    .update(keyTime).digest('hex');

  // HttpString
  const httpString = [
    method.toLowerCase(),
    '/' + cosPath,
    Object.keys(params).sort().map(k => `${encodeURIComponent(k).toLowerCase()}=${encodeURIComponent(params[k])}`).join('&'),
    Object.keys(headers).sort().map(k => `${encodeURIComponent(k).toLowerCase()}=${encodeURIComponent(headers[k])}`).join('&'),
    ''
  ].join('\n');

  // StringToSign
  const sha1HttpString = crypto.createHash('sha1').update(httpString).digest('hex');
  const stringToSign = `sha1\n${keyTime}\n${sha1HttpString}\n`;

  // Signature
  const signature = crypto.createHmac('sha1', signKey)
    .update(stringToSign).digest('hex');

  const headerList = Object.keys(headers).sort().map(k => encodeURIComponent(k).toLowerCase()).join(';');
  const paramList = Object.keys(params).sort().map(k => encodeURIComponent(k).toLowerCase()).join(';');

  return `q-sign-algorithm=sha1&q-ak=${COS_CONFIG.secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerList}&q-url-param-list=${paramList}&q-signature=${signature}`;
}

/**
 * 检查COS是否可用（密钥已配置）
 */
function isCosAvailable() {
  return !!(COS_CONFIG.secretId && COS_CONFIG.secretKey);
}

// ==================== COS 操作 ====================

/**
 * 写入COS热桶
 * @param {string} key - 对象键（相对于basePath）
 * @param {Object|string} data - 要写入的数据
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function writeCos(key, data) {
  if (!isCosAvailable()) {
    return { success: false, error: 'COS密钥未配置' };
  }

  const cosPath = COS_CONFIG.basePath + key;
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const host = `${COS_CONFIG.bucket}.cos.${COS_CONFIG.region}.myqcloud.com`;

  const headers = {
    'Host': host,
    'Content-Type': 'application/json',
    'Content-Length': String(Buffer.byteLength(body, 'utf-8')),
  };

  const authorization = cosSign('PUT', cosPath, { host: host }, {});

  try {
    // 使用Node.js原生 fetch（Node 18+）或 https
    const https = require('https');
    return new Promise((resolve) => {
      const req = https.request({
        hostname: host,
        port: 443,
        path: '/' + cosPath,
        method: 'PUT',
        headers: {
          ...headers,
          'Authorization': authorization,
        },
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `COS PUT ${res.statusCode}: ${responseBody.substring(0, 200)}` });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: `COS网络错误: ${err.message}` });
      });

      req.write(body);
      req.end();
    });
  } catch (err) {
    return { success: false, error: `COS写入异常: ${err.message}` };
  }
}

/**
 * 从COS热桶读取
 * @param {string} key - 对象键（相对于basePath）
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
async function readCos(key) {
  if (!isCosAvailable()) {
    return { success: false, error: 'COS密钥未配置' };
  }

  const cosPath = COS_CONFIG.basePath + key;
  const host = `${COS_CONFIG.bucket}.cos.${COS_CONFIG.region}.myqcloud.com`;

  const headers = { 'Host': host };
  const authorization = cosSign('GET', cosPath, { host: host }, {});

  try {
    const https = require('https');
    return new Promise((resolve) => {
      const req = https.request({
        hostname: host,
        port: 443,
        path: '/' + cosPath,
        method: 'GET',
        headers: {
          ...headers,
          'Authorization': authorization,
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve({ success: true, data: JSON.parse(body) });
            } catch {
              resolve({ success: true, data: body });
            }
          } else if (res.statusCode === 404) {
            resolve({ success: false, error: 'NOT_FOUND' });
          } else {
            resolve({ success: false, error: `COS GET ${res.statusCode}` });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: `COS网络错误: ${err.message}` });
      });

      req.end();
    });
  } catch (err) {
    return { success: false, error: `COS读取异常: ${err.message}` };
  }
}

// ==================== Git仓库操作 ====================

/**
 * 写入Git仓库本地文件
 * @param {string} key - 文件名
 * @param {Object|string} data - 要写入的数据
 * @returns success: boolean, path?: string, error?: string
 */
function writeGit(key, data) {
  try {
    if (!fs.existsSync(GIT_MEMORY_DIR)) {
      fs.mkdirSync(GIT_MEMORY_DIR, { recursive: true });
    }

    const filePath = path.join(GIT_MEMORY_DIR, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');

    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: `Git写入失败: ${err.message}` };
  }
}

/**
 * 从Git仓库本地文件读取
 * @param {string} key - 文件名
 * @returns success: boolean, data?: Object, error?: string
 */
function readGit(key) {
  try {
    const filePath = path.join(GIT_MEMORY_DIR, key);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'NOT_FOUND' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      return { success: true, data: JSON.parse(content) };
    } catch {
      return { success: true, data: content };
    }
  } catch (err) {
    return { success: false, error: `Git读取失败: ${err.message}` };
  }
}

// ==================== 双层记忆接口 ====================

/**
 * 双层写入：COS热桶 + Git仓库
 * 先写COS（快），再写Git（保底）
 *
 * @param {string} key - 记忆键名（如 'session-latest.json'）
 * @param {Object} data - 记忆数据
 * @returns {Promise<{cos: Object, git: Object}>}
 */
async function save(key, data) {
  // 添加元数据
  const enrichedData = {
    ...data,
    _meta: {
      saved_at: new Date().toISOString(),
      persona: 'PER-YC-CHAT-001',
      persona_name: '映川',
      dual_layer: true,
    }
  };

  // 第一层：COS热桶
  const cosResult = await writeCos(key, enrichedData);

  // 第二层：Git仓库
  const gitResult = writeGit(key, enrichedData);

  return { cos: cosResult, git: gitResult };
}

/**
 * 双层读取：先读COS（最新），COS不可用时回退Git
 *
 * @param {string} key - 记忆键名
 * @returns {Promise<{data: Object|null, source: 'cos'|'git'|null, error?: string}>}
 */
async function load(key) {
  // 先试COS
  const cosResult = await readCos(key);
  if (cosResult.success) {
    return { data: cosResult.data, source: 'cos' };
  }

  // COS不可用，回退Git
  const gitResult = readGit(key);
  if (gitResult.success) {
    return { data: gitResult.data, source: 'git' };
  }

  // 两层都没有
  return { data: null, source: null, error: `COS: ${cosResult.error} | Git: ${gitResult.error}` };
}

// ==================== 高层记忆接口 ====================

/**
 * 保存任务执行记忆（每次任务完成后调用）
 */
async function saveTaskMemory(taskId, memory) {
  const key = `tasks/${taskId}.json`;
  return save(key, memory);
}

/**
 * 保存会话记忆（最新状态）
 */
async function saveSessionMemory(sessionData) {
  // 最新会话快照
  const latestResult = await save('session-latest.json', sessionData);

  // 同时存一份按时间戳的归档
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveResult = await save(`sessions/${ts}.json`, sessionData);

  return { latest: latestResult, archive: archiveResult };
}

/**
 * 加载最新会话记忆（唤醒时调用）
 */
async function loadLatestSession() {
  return load('session-latest.json');
}

/**
 * 保存技能记忆（蕴顱后的经验）
 */
async function saveSkillMemory(skillId, skillData) {
  return save(`skills/${skillId}.json`, skillData);
}

/**
 * 保存反思记忆
 */
async function saveReflection(reflectionData) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return save(`reflections/${ts}.json`, reflectionData);
}

/**
 * 获取记忆存储状态
 */
function getStorageStatus() {
  return {
    cos_available: isCosAvailable(),
    cos_bucket: COS_CONFIG.bucket,
    cos_region: COS_CONFIG.region,
    cos_path: COS_CONFIG.basePath,
    git_path: GIT_MEMORY_DIR,
    git_exists: fs.existsSync(GIT_MEMORY_DIR),
  };
}

module.exports = {
  // 底层
  writeCos,
  readCos,
  writeGit,
  readGit,
  isCosAvailable,
  // 双层
  save,
  load,
  // 高层
  saveTaskMemory,
  saveSessionMemory,
  loadLatestSession,
  saveSkillMemory,
  saveReflection,
  getStorageStatus,
  // 配置
  COS_CONFIG,
  GIT_MEMORY_DIR,
};
