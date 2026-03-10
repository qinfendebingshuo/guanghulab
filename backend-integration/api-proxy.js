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
    } else {
      jsonResponse(res, 404, {
        error: true,
        code: 'NOT_FOUND',
        message: '接口不存在。可用接口: POST /api/chat, GET /api/models, GET /api/health'
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

  console.log('\n   可用接口:');
  console.log('   POST /api/chat    — 聊天代理（SSE 流式）');
  console.log('   GET  /api/models  — 列出可用模型');
  console.log('   GET  /api/health  — 健康检查');
  console.log('');
});
