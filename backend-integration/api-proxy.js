/**
 * 🔌 AGE OS · API 代理层
 * 
 * 解决两个核心问题：
 *   1. 国内开发者无法直连海外模型API（被墙）
 *   2. API Key 不应暴露在前端 JavaScript 中
 * 
 * 架构：
 *   浏览器 → guanghulab.com/api/chat → 本代理 → 真实模型API
 * 
 * 支持的模型：
 *   - deepseek   (api.deepseek.com)        — 国内直连，推荐首选
 *   - moonshot   (api.moonshot.cn)          — 国内直连
 *   - zhipu      (open.bigmodel.cn)         — 国内直连
 *   - yunwu      (api.yunwu.ai)             — 团队推荐
 *   - openai     (api.openai.com)           — 需海外服务器
 *   - gemini     (generativelanguage.googleapis.com) — 需海外服务器
 * 
 * 环境变量：
 *   DEEPSEEK_API_KEY   — DeepSeek API 密钥
 *   MOONSHOT_API_KEY   — Moonshot/Kimi API 密钥
 *   ZHIPU_API_KEY      — 智谱 API 密钥
 *   YUNWU_API_KEY      — 云雾 AI API 密钥
 *   OPENAI_API_KEY     — OpenAI API 密钥
 *   GEMINI_API_KEY     — Google Gemini API 密钥
 *   PROXY_PORT         — 代理服务端口（默认 3721）
 *   ALLOWED_ORIGINS    — CORS 允许的域名（逗号分隔，默认 *）
 *   RATE_LIMIT_RPM     — 每用户每分钟最大请求数（默认 10）
 * 
 * 启动：
 *   node backend-integration/api-proxy.js
 *   或通过 PM2: pm2 start backend-integration/api-proxy.js --name api-proxy
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

// ═══════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════
const PORT = parseInt(process.env.PROXY_PORT || '3721', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://qinfendebingshuo.github.io,https://guanghulab.com,http://localhost:8765').split(',').map(s => s.trim());
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '10', 10);

// 模型端点映射
const MODEL_CONFIG = {
  deepseek: {
    base: 'https://api.deepseek.com/v1',
    keyEnv: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    label: 'DeepSeek（国内直连）'
  },
  moonshot: {
    base: 'https://api.moonshot.cn/v1',
    keyEnv: 'MOONSHOT_API_KEY',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    label: 'Moonshot/Kimi（国内直连）'
  },
  zhipu: {
    base: 'https://open.bigmodel.cn/api/paas/v4',
    keyEnv: 'ZHIPU_API_KEY',
    models: ['glm-4', 'glm-4-flash', 'glm-4-air'],
    label: '智谱AI/GLM（国内直连）'
  },
  yunwu: {
    base: 'https://api.yunwu.ai/v1',
    keyEnv: 'YUNWU_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'deepseek-chat', 'gemini-1.5-pro'],
    label: '云雾AI（团队推荐）'
  },
  openai: {
    base: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    label: 'OpenAI（需海外服务器）'
  },
  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    label: 'Google Gemini（需海外服务器）'
  }
};

// ═══════════════════════════════════════════════════════
// 频率限制（内存级，基于 IP）
// ═══════════════════════════════════════════════════════
const rateLimitMap = new Map();

function checkRateLimit(clientId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  if (!rateLimitMap.has(clientId)) {
    rateLimitMap.set(clientId, []);
  }

  const timestamps = rateLimitMap.get(clientId);
  // Remove entries older than the window
  while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT_RPM) {
    return false; // Rate limited
  }

  timestamps.push(now);
  return true;
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 120 * 1000;
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, filtered);
    }
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════
// CORS 处理
// ═══════════════════════════════════════════════════════
function setCorsHeaders(res, origin) {
  const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ═══════════════════════════════════════════════════════
// 请求体解析
// ═══════════════════════════════════════════════════════
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    const MAX_BODY = 512 * 1024; // 512KB max

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体过大'));
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('无效的 JSON 请求体'));
      }
    });
    req.on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════
// JSON 响应
// ═══════════════════════════════════════════════════════
function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ═══════════════════════════════════════════════════════
// 获取客户端 IP
// ═══════════════════════════════════════════════════════
function getClientId(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || 'unknown';
}

// ═══════════════════════════════════════════════════════
// 上游 HTTPS 请求（流式透传）
// ═══════════════════════════════════════════════════════
function proxyStream(upstreamUrl, apiKey, requestBody, res) {
  return new Promise((resolve, reject) => {
    const url = new URL(upstreamUrl);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream'
      }
    };

    const bodyStr = JSON.stringify(requestBody);
    options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const upstream = https.request(options, (upstreamRes) => {
      // Forward status and content-type
      const ct = upstreamRes.headers['content-type'] || 'text/event-stream';
      res.writeHead(upstreamRes.statusCode, {
        'Content-Type': ct,
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Nginx: disable buffering for SSE
      });

      // Pipe upstream response directly to client (streaming)
      upstreamRes.on('data', chunk => {
        res.write(chunk);
      });

      upstreamRes.on('end', () => {
        res.end();
        resolve();
      });

      upstreamRes.on('error', err => {
        console.error('上游响应错误:', err.message);
        res.end();
        reject(err);
      });
    });

    upstream.on('error', err => {
      console.error('上游连接错误:', err.message);
      if (!res.headersSent) {
        jsonResponse(res, 502, {
          error: true,
          code: 'UPSTREAM_ERROR',
          message: '无法连接模型API: ' + err.message
        });
      }
      reject(err);
    });

    // Connection timeout only — once response headers arrive, streaming can run longer
    upstream.setTimeout(60000, () => {
      upstream.destroy(new Error('连接超时'));
    });

    upstream.write(bodyStr);
    upstream.end();
  });
}

// ═══════════════════════════════════════════════════════
// 路由处理器
// ═══════════════════════════════════════════════════════

// GET /api/models — 列出可用模型
function handleGetModels(req, res) {
  const available = {};
  for (const [provider, config] of Object.entries(MODEL_CONFIG)) {
    const key = process.env[config.keyEnv];
    if (key) {
      available[provider] = {
        label: config.label,
        models: config.models
      };
    }
  }
  jsonResponse(res, 200, {
    providers: available,
    default_provider: Object.keys(available)[0] || null
  });
}

// ═══════════════════════════════════════════════════════
// 模型失败记录（自动 fallback 用）
// ═══════════════════════════════════════════════════════
const proxyFailureLog = new Map();
const PROXY_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

function recordProxyFailure(provider) {
  const entry = proxyFailureLog.get(provider) || { count: 0, lastFail: 0 };
  entry.count++;
  entry.lastFail = Date.now();
  proxyFailureLog.set(provider, entry);
}

function isProviderInCooldown(provider) {
  const entry = proxyFailureLog.get(provider);
  if (!entry) return false;
  if (Date.now() - entry.lastFail > PROXY_FAILURE_COOLDOWN_MS) {
    proxyFailureLog.delete(provider);
    return false;
  }
  return entry.count >= 3;
}

// 自动 fallback 提供商顺序（有 API key 且未冷却的优先）
function getAvailableProviders(preferredProvider) {
  const ordered = [preferredProvider, 'yunwu', 'deepseek', 'moonshot', 'zhipu', 'openai', 'gemini'];
  const seen = new Set();
  const available = [];
  for (const prov of ordered) {
    if (seen.has(prov)) continue;
    seen.add(prov);
    const cfg = MODEL_CONFIG[prov];
    if (!cfg) continue;
    const key = process.env[cfg.keyEnv];
    if (!key) continue;
    if (isProviderInCooldown(prov)) continue;
    available.push({ provider: prov, config: cfg, apiKey: key });
  }
  return available;
}

// POST /api/chat — 代理转发聊天请求（支持自动 fallback）
async function handleChat(req, res) {
  const clientId = getClientId(req);

  // Rate limit check
  if (!checkRateLimit(clientId)) {
    jsonResponse(res, 429, {
      error: true,
      code: 'RATE_LIMITED',
      message: `请求过于频繁，每分钟最多 ${RATE_LIMIT_RPM} 次请求`
    });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    jsonResponse(res, 400, {
      error: true,
      code: 'INVALID_BODY',
      message: err.message
    });
    return;
  }

  const { provider, model, messages, system, stream, temperature, max_tokens } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    jsonResponse(res, 400, {
      error: true,
      code: 'MISSING_MESSAGES',
      message: '缺少 messages 参数'
    });
    return;
  }

  // Validate numeric parameters
  const temp = typeof temperature === 'number' ? Math.max(0, Math.min(2, temperature)) : 0.8;
  const maxTok = typeof max_tokens === 'number' ? Math.max(1, Math.min(8192, Math.floor(max_tokens))) : 2000;

  // Get available providers with auto-fallback
  const prov = provider || 'deepseek';
  const availableProviders = getAvailableProviders(prov);

  if (availableProviders.length === 0) {
    // Even cooled-down providers — try the requested one anyway
    const config = MODEL_CONFIG[prov];
    if (!config) {
      jsonResponse(res, 400, {
        error: true,
        code: 'INVALID_PROVIDER',
        message: `不支持的模型提供商: ${prov}，可选: ${Object.keys(MODEL_CONFIG).join(', ')}`
      });
      return;
    }
    const apiKey = process.env[config.keyEnv];
    if (!apiKey) {
      jsonResponse(res, 503, {
        error: true,
        code: 'NO_API_KEY',
        message: `所有模型API密钥均未配置，请联系管理员`
      });
      return;
    }
    availableProviders.push({ provider: prov, config, apiKey });
  }

  // Try providers in order with auto-fallback
  for (let i = 0; i < availableProviders.length; i++) {
    const { provider: curProv, config: curConfig, apiKey: curKey } = availableProviders[i];
    const mdl = (i === 0 && model) ? model : curConfig.models[0];

    const upstreamBody = {
      model: mdl,
      messages: messages,
      stream: stream !== false,
      temperature: temp,
      max_tokens: maxTok
    };

    if (system && !messages.find(m => m.role === 'system')) {
      upstreamBody.messages = [{ role: 'system', content: system }, ...messages];
    }

    const upstreamUrl = curConfig.base + '/chat/completions';
    const isLastAttempt = i === availableProviders.length - 1;

    console.log(`[代理] ${i > 0 ? '降级→' : ''}${curProv}/${mdl}`);

    try {
      await proxyStream(upstreamUrl, curKey, upstreamBody, res);
      return; // Success — stop trying
    } catch (err) {
      recordProxyFailure(curProv);
      console.error(`[代理] ${curProv} 请求失败: ${err.message}`);

      // If headers already sent (partial streaming started), can't switch provider
      if (res.headersSent) return;

      if (isLastAttempt) {
        jsonResponse(res, 502, {
          error: true,
          code: 'ALL_PROVIDERS_FAILED',
          message: '所有模型提供商均请求失败，请稍后重试'
        });
      }
      // Otherwise continue to next provider
    }
  }
}

// GET /api/health — 健康检查
function handleHealth(req, res) {
  const configured = Object.entries(MODEL_CONFIG)
    .filter(([, config]) => process.env[config.keyEnv])
    .map(([name, config]) => ({ provider: name, label: config.label }));

  jsonResponse(res, 200, {
    status: 'ok',
    version: '1.0.0',
    service: 'AGE OS API Proxy',
    configured_providers: configured,
    rate_limit: RATE_LIMIT_RPM + ' req/min'
  });
}

// ═══════════════════════════════════════════════════════
// 用户 API Key 模型检测（Persona Studio 复用主站代理链路）
// ═══════════════════════════════════════════════════════
const userModelCache = new Map();
const USER_MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时

function getUserCacheKey(apiBase, apiKey) {
  const hash = crypto.createHash('sha256').update(apiBase + '\0' + apiKey).digest('hex').slice(0, 32);
  return 'user-models::' + hash;
}

function getCachedUserModels(apiBase, apiKey) {
  const key = getUserCacheKey(apiBase, apiKey);
  const entry = userModelCache.get(key);
  if (entry && Date.now() - entry.timestamp < USER_MODEL_CACHE_TTL_MS) {
    return entry.models;
  }
  return null;
}

function setCachedUserModels(apiBase, apiKey, models) {
  const key = getUserCacheKey(apiBase, apiKey);
  userModelCache.set(key, { models, timestamp: Date.now() });
}

/**
 * 请求用户指定的第三方 API 的 /v1/models 接口
 */
function fetchUserModels(apiBase, apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const base = apiBase.replace(/\/+$/, '');
    const modelsPath = base.endsWith('/v1') ? base + '/models' : base + '/v1/models';

    let url;
    try {
      url = new URL(modelsPath);
    } catch (_e) {
      return reject({ code: 'INVALID_API_BASE', message: 'API Base URL 格式无效' });
    }

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
          return reject({ code: 'INVALID_API_KEY', message: 'API Key 无效或权限不足 (HTTP ' + res.statusCode + ')' });
        }
        if (res.statusCode >= 400) {
          return reject({ code: 'API_BASE_ERROR', message: 'API Base 返回错误 (HTTP ' + res.statusCode + ')' });
        }
        try {
          const json = JSON.parse(data);
          const models = json.data || json.models || [];
          const modelIds = models
            .map(function (m) { return m.id || m.name || null; })
            .filter(Boolean);
          resolve(modelIds);
        } catch (_e) {
          reject({ code: 'PARSE_ERROR', message: '当前接口不支持模型枚举（返回格式异常）' });
        }
      });
    });

    req.on('error', (err) => {
      if (err.code === 'ENOTFOUND') {
        reject({ code: 'DNS_ERROR', message: 'API Base 域名无法解析: ' + url.hostname });
      } else if (err.code === 'ECONNREFUSED') {
        reject({ code: 'CONN_REFUSED', message: 'API Base 连接被拒绝: ' + url.hostname });
      } else {
        reject({ code: 'NETWORK_ERROR', message: 'API Base 不可访问: ' + err.message });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ code: 'TIMEOUT', message: '请求超时，API Base 可能不可访问或网络不稳定' });
    });

    req.end();
  });
}

/**
 * 调用用户指定的第三方 API 的 chat/completions 接口
 */
function callUserApiChat({ apiBase, apiKey, model, messages, maxTokens, temperature, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const base = apiBase.replace(/\/+$/, '');
    const chatPath = base.endsWith('/v1') ? base + '/chat/completions' : base + '/v1/chat/completions';

    let url;
    try {
      url = new URL(chatPath);
    } catch (_e) {
      return reject(new Error('API Base URL 格式无效'));
    }

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

// POST /api/ps/apikey/detect-models — 检测用户第三方 API 可用模型
async function handleDetectModels(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    return jsonResponse(res, 400, { error: true, code: 'INVALID_BODY', message: err.message });
  }

  const { api_base, api_key } = body;

  if (!api_base || typeof api_base !== 'string') {
    return jsonResponse(res, 400, { error: true, code: 'MISSING_API_BASE', message: '请输入 API Base URL' });
  }

  if (!api_key || typeof api_key !== 'string') {
    return jsonResponse(res, 400, { error: true, code: 'MISSING_API_KEY', message: '请输入 API Key' });
  }

  // 防止 header injection
  if (/[\r\n]/.test(api_key)) {
    return jsonResponse(res, 400, { error: true, code: 'INVALID_API_KEY', message: 'API Key 格式无效（含非法字符）' });
  }

  // 校验 api_base 格式和协议（仅允许 http/https，防止 SSRF）
  try {
    const parsedUrl = new URL(api_base);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return jsonResponse(res, 400, { error: true, code: 'INVALID_API_BASE', message: 'API Base URL 仅支持 http/https 协议' });
    }
  } catch (_e) {
    return jsonResponse(res, 400, { error: true, code: 'INVALID_API_BASE', message: 'API Base URL 格式无效，请输入完整 URL（如 https://api.openai.com）' });
  }

  // 检查缓存
  const cached = getCachedUserModels(api_base, api_key);
  if (cached) {
    return jsonResponse(res, 200, { error: false, models: cached, count: cached.length, cached: true });
  }

  try {
    const models = await fetchUserModels(api_base, api_key, 15000);

    if (!models || models.length === 0) {
      return jsonResponse(res, 404, { error: true, code: 'NO_MODELS', message: '未检测到可用模型，该 API 可能不支持模型枚举' });
    }

    setCachedUserModels(api_base, api_key, models);

    jsonResponse(res, 200, { error: false, models: models, count: models.length, cached: false });
  } catch (err) {
    const code = err.code || 'DETECT_FAILED';
    const message = err.message || '模型检测失败';
    jsonResponse(res, 502, { error: true, code: code, message: message });
  }
}

// POST /api/ps/apikey/chat — 通过用户 API Key 对话
async function handleApiKeyChat(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    return jsonResponse(res, 400, { error: true, code: 'INVALID_BODY', message: err.message });
  }

  const { api_base, api_key, model, messages } = body;

  if (!api_base || !api_key || !model) {
    return jsonResponse(res, 400, { error: true, code: 'MISSING_PARAMS', message: '缺少必要参数 (api_base, api_key, model)' });
  }

  if (/[\r\n]/.test(api_key)) {
    return jsonResponse(res, 400, { error: true, code: 'INVALID_API_KEY', message: 'API Key 格式无效' });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(res, 400, { error: true, code: 'MISSING_MESSAGES', message: '缺少消息内容' });
  }

  try {
    const reply = await callUserApiChat({
      apiBase: api_base,
      apiKey: api_key,
      model: model,
      messages: messages,
      maxTokens: 2000,
      temperature: 0.8,
      timeoutMs: 60000
    });

    jsonResponse(res, 200, { error: false, reply: reply, model: model });
  } catch (err) {
    jsonResponse(res, 502, { error: true, code: 'CHAT_FAILED', message: err.message || '对话请求失败' });
  }
}

// ═══════════════════════════════════════════════════════
// Persona Studio 后端反向代理
// 将 /api/ps/chat/*, /api/ps/auth/*, /api/ps/build/*, /api/ps/notify/*
// 转发到 persona-studio 后端服务（默认端口 3002）
// ═══════════════════════════════════════════════════════
const PS_BACKEND_PORT = parseInt(process.env.PS_PORT || '3002', 10);
const PS_PROXY_PATHS = ['/api/ps/chat/', '/api/ps/auth/', '/api/ps/build/', '/api/ps/notify/'];

function shouldProxyToPersonaStudio(pathname) {
  return PS_PROXY_PATHS.some(prefix => pathname.startsWith(prefix));
}

function proxyToPersonaStudio(req, res, fullPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PS_BACKEND_PORT,
      path: fullPath,
      method: req.method,
      headers: Object.assign({}, req.headers, {
        host: '127.0.0.1:' + PS_BACKEND_PORT
      }),
      timeout: 60000
    };

    const proxyReq = http.request(options, (proxyRes) => {
      // Forward status and headers, but skip backend's CORS headers
      // because the api-proxy already set CORS headers via setCorsHeaders()
      // at the top of the request handler — forwarding both would cause duplicates
      const headers = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (!key.startsWith('access-control-')) {
          headers[key] = value;
        }
      }
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
      proxyRes.on('end', resolve);
      proxyRes.on('error', reject);
    });

    proxyReq.on('error', (err) => {
      console.error('[代理→PS] persona-studio 后端连接失败:', err.message);
      if (!res.headersSent) {
        jsonResponse(res, 502, {
          error: true,
          code: 'PS_BACKEND_UNAVAILABLE',
          message: 'Persona Studio 后端服务不可用，请稍后重试'
        });
      }
      resolve();
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        jsonResponse(res, 504, {
          error: true,
          code: 'PS_BACKEND_TIMEOUT',
          message: 'Persona Studio 后端响应超时'
        });
      }
      resolve();
    });

    // Pipe the original request body to the proxy request
    req.pipe(proxyReq);
  });
}

// ═══════════════════════════════════════════════════════
// HTTP 服务器
// ═══════════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  setCorsHeaders(res, origin);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    if (path === '/api/chat' && req.method === 'POST') {
      await handleChat(req, res);
    } else if (path === '/api/models' && req.method === 'GET') {
      handleGetModels(req, res);
    } else if (path === '/api/health' && req.method === 'GET') {
      handleHealth(req, res);
    } else if (path === '/api/ps/apikey/detect-models' && req.method === 'POST') {
      await handleDetectModels(req, res);
    } else if (path === '/api/ps/apikey/chat' && req.method === 'POST') {
      await handleApiKeyChat(req, res);
    } else if (shouldProxyToPersonaStudio(path)) {
      await proxyToPersonaStudio(req, res, url.pathname + url.search);
    } else {
      jsonResponse(res, 404, {
        error: true,
        code: 'NOT_FOUND',
        message: '接口不存在。可用接口: POST /api/chat, GET /api/models, GET /api/health, POST /api/ps/apikey/detect-models, POST /api/ps/apikey/chat, POST /api/ps/chat/message, GET /api/ps/chat/history, POST /api/ps/auth/login'
      });
    }
  } catch (err) {
    console.error('服务器错误:', err);
    if (!res.headersSent) {
      jsonResponse(res, 500, {
        error: true,
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n🔌 AGE OS API 代理层已启动`);
  console.log(`   端口: ${PORT}`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   频率限制: ${RATE_LIMIT_RPM} 次/分钟`);
  console.log(`   CORS: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log('');

  // Show configured providers
  let hasAny = false;
  for (const [name, config] of Object.entries(MODEL_CONFIG)) {
    const key = process.env[config.keyEnv];
    const status = key ? '✅ 已配置' : '❌ 未配置';
    const china = ['deepseek', 'moonshot', 'zhipu'].includes(name) ? '🇨🇳' : '🌐';
    console.log(`   ${china} ${config.label}: ${status}`);
    if (key) hasAny = true;
  }

  if (!hasAny) {
    console.log('\n   ⚠️  未配置任何 API 密钥！');
    console.log('   请设置环境变量（推荐先配 DeepSeek，国内直连）:');
    console.log('   export DEEPSEEK_API_KEY=sk-xxx');
    console.log('   export YUNWU_API_KEY=sk-xxx');
  }

  console.log(`\n   Persona Studio 后端代理: http://127.0.0.1:${PS_BACKEND_PORT}`);
  console.log('   代理路径: /api/ps/chat/*, /api/ps/auth/*, /api/ps/build/*, /api/ps/notify/*');

  console.log('\n   可用接口:');
  console.log('   POST /api/chat                      — 聊天代理（SSE 流式）');
  console.log('   GET  /api/models                    — 列出可用模型');
  console.log('   GET  /api/health                    — 健康检查');
  console.log('   POST /api/ps/apikey/detect-models   — 用户 API Key 模型检测');
  console.log('   POST /api/ps/apikey/chat            — 用户 API Key 对话');
  console.log('   POST /api/ps/chat/message            — 知秋对话（→ PS后端）');
  console.log('   GET  /api/ps/chat/history            — 对话历史（→ PS后端）');
  console.log('   POST /api/ps/auth/login              — 登录校验（→ PS后端）');
  console.log('');
});
