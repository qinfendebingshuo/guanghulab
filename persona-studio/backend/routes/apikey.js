/**
 * persona-studio · API Key 模型检测路由
 * POST /api/ps/apikey/detect-models   检测可用模型
 * POST /api/ps/apikey/chat            通过用户 API Key 对话
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const http = require('http');

/* ---- 模型列表缓存（1 小时有效期） ---- */
const modelCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时

function getCacheKey(apiBase, apiKey) {
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
  return apiBase + '::' + hash;
}

function getCachedModels(apiBase, apiKey) {
  const key = getCacheKey(apiBase, apiKey);
  const entry = modelCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.models;
  }
  return null;
}

function setCachedModels(apiBase, apiKey, models) {
  const key = getCacheKey(apiBase, apiKey);
  modelCache.set(key, { models, timestamp: Date.now() });
}

/**
 * 请求第三方 API 的 /v1/models 接口
 */
function fetchModels(apiBase, apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    // 规范化 apiBase：去除末尾斜杠
    const base = apiBase.replace(/\/+$/, '');
    // 支持 base 已带 /v1 或不带的情况
    const modelsPath = base.endsWith('/v1') ? base + '/models' : base + '/v1/models';
    const url = new URL(modelsPath);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Accept': 'application/json'
      },
      timeout: timeoutMs || 15000
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reject(new Error('API Key 无效'));
        }
        if (res.statusCode >= 400) {
          return reject(new Error('API Base 不可访问 (HTTP ' + res.statusCode + ')'));
        }
        try {
          const json = JSON.parse(data);
          const models = json.data || json.models || [];
          const modelIds = models
            .map(function (m) { return m.id || m.name || null; })
            .filter(Boolean);
          resolve(modelIds);
        } catch (_e) {
          reject(new Error('未检测到可用模型'));
        }
      });
    });

    req.on('error', (err) => {
      const wrapped = new Error('API Base 不可访问: ' + err.message);
      wrapped.code = err.code;
      reject(wrapped);
    });

    req.on('timeout', () => {
      req.destroy();
      const err = new Error('API Base 不可访问（请求超时）');
      err.code = 'ETIMEDOUT';
      reject(err);
    });

    req.end();
  });
}

/**
 * 调用用户 API 的 chat/completions 接口
 */
function callUserApi({ apiBase, apiKey, model, messages, maxTokens, temperature, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const base = apiBase.replace(/\/+$/, '');
    const chatPath = base.endsWith('/v1') ? base + '/chat/completions' : base + '/v1/chat/completions';
    const url = new URL(chatPath);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    const body = JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens || 2000,
      temperature: temperature != null ? temperature : 0.8
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs || 60000
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0] && json.choices[0].message) {
            resolve(json.choices[0].message.content);
          } else if (json.error) {
            reject(new Error(json.error.message || 'API 调用失败'));
          } else {
            reject(new Error('API 返回格式异常'));
          }
        } catch (_e) {
          reject(new Error('API 返回解析失败'));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error('API 请求失败: ' + err.message));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API 请求超时'));
    });

    req.write(body);
    req.end();
  });
}

// POST /api/ps/apikey/detect-models
router.post('/detect-models', async (req, res) => {
  const { api_base, api_key } = req.body || {};

  if (!api_base || typeof api_base !== 'string') {
    return res.status(400).json({
      error: true,
      code: 'MISSING_API_BASE',
      message: '请输入 API Base URL'
    });
  }

  // 校验 URL 格式
  try {
    const testBase = api_base.replace(/\/+$/, '');
    const testPath = testBase.endsWith('/v1') ? testBase + '/models' : testBase + '/v1/models';
    new URL(testPath);
  } catch (_e) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_API_BASE',
      message: 'API Base URL 格式无效'
    });
  }

  if (!api_key || typeof api_key !== 'string') {
    return res.status(400).json({
      error: true,
      code: 'MISSING_API_KEY',
      message: '请输入 API Key'
    });
  }

  // 防止 header injection：API Key 不得包含换行符
  if (/[\r\n]/.test(api_key)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_API_KEY',
      message: 'API Key 格式无效'
    });
  }
  const cached = getCachedModels(api_base, api_key);
  if (cached) {
    return res.json({
      error: false,
      models: cached,
      count: cached.length,
      cached: true
    });
  }

  try {
    const models = await fetchModels(api_base, api_key, 15000);

    if (!models || models.length === 0) {
      return res.status(404).json({
        error: true,
        code: 'NO_MODELS',
        message: '未检测到可用模型'
      });
    }

    // 写入缓存
    setCachedModels(api_base, api_key, models);

    res.json({
      error: false,
      models: models,
      count: models.length,
      cached: false
    });
  } catch (err) {
    const errMsg = err.message || '模型检测失败';
    const errCode = err.code || '';
    let code = 'DETECT_FAILED';

    // 区分 DNS / 网络 / 超时错误（优先使用 Node.js 错误码）
    if (errCode === 'ENOTFOUND' || errCode === 'EAI_AGAIN' || /ENOTFOUND|getaddrinfo/.test(errMsg)) {
      code = 'DNS_ERROR';
    } else if (errCode === 'ECONNREFUSED' || errCode === 'ECONNRESET' || errCode === 'EHOSTUNREACH' || errCode === 'ENETUNREACH' || /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|socket hang up/.test(errMsg)) {
      code = 'NETWORK_ERROR';
    } else if (errCode === 'ETIMEDOUT' || errCode === 'ESOCKETTIMEDOUT' || /timeout|ETIMEDOUT/.test(errMsg)) {
      code = 'TIMEOUT';
    }

    res.status(502).json({
      error: true,
      code: code,
      message: errMsg
    });
  }
});

// POST /api/ps/apikey/chat
router.post('/chat', async (req, res) => {
  const { api_base, api_key, model, messages } = req.body || {};

  if (!api_base || !api_key || !model) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_PARAMS',
      message: '缺少必要参数 (api_base, api_key, model)'
    });
  }

  // 防止 header injection
  if (/[\r\n]/.test(api_key)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_API_KEY',
      message: 'API Key 格式无效'
    });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_MESSAGES',
      message: '缺少消息内容'
    });
  }

  try {
    const reply = await callUserApi({
      apiBase: api_base,
      apiKey: api_key,
      model: model,
      messages: messages,
      maxTokens: 2000,
      temperature: 0.8,
      timeoutMs: 60000
    });

    res.json({
      error: false,
      reply: reply,
      model: model
    });
  } catch (err) {
    res.status(502).json({
      error: true,
      code: 'CHAT_FAILED',
      message: err.message || '对话请求失败'
    });
  }
});

module.exports = router;
