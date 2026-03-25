/**
 * persona-studio · 服务器端 AI 模型代理路由
 * 
 * 目的：消除用户手动输入 API 密钥的需求
 * 所有模型调用由服务器端代理完成，API 密钥仅存在于服务器 .env
 * 
 * 路由前缀：/api/ps/proxy
 * 
 * 📜 Copyright: 国作登字-2026-A-00037559
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 */
const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// 服务器端配置的模型 API
const MODEL_API_KEY = process.env.MODEL_API_KEY || process.env.YUNWU_API_KEY || '';
const MODEL_API_BASE = process.env.MODEL_API_BASE || 'https://api.yunwu.ai/v1';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gemini-2.0-flash';

if (!MODEL_API_KEY) {
  console.warn('[Proxy] ⚠️ MODEL_API_KEY / YUNWU_API_KEY 未配置，服务器代理模式不可用。用户需使用自有 API 密钥。');
}

/**
 * 检查服务器端代理是否可用
 * GET /api/ps/proxy/status
 */
router.get('/status', (_req, res) => {
  const available = !!MODEL_API_KEY;
  res.json({
    error: false,
    proxy_available: available,
    model: available ? DEFAULT_MODEL : null,
    api_base: available ? MODEL_API_BASE : null,
    message: available
      ? '服务器端代理可用 · 无需 API 密钥'
      : '服务器端代理未配置 · 请使用自有 API 密钥'
  });
});

/**
 * 获取服务器端可用模型列表
 * GET /api/ps/proxy/models
 */
router.get('/models', async (_req, res) => {
  if (!MODEL_API_KEY) {
    return res.status(503).json({
      error: true,
      code: 'PROXY_NOT_CONFIGURED',
      message: '服务器端 API 密钥未配置'
    });
  }

  try {
    const data = await callModelAPI('GET', '/models', null);
    const models = (data.data || []).map(m => m.id).filter(Boolean).sort();
    res.json({ error: false, models, api_base: MODEL_API_BASE });
  } catch (err) {
    res.status(502).json({
      error: true,
      code: 'MODEL_API_ERROR',
      message: '无法获取模型列表: ' + (err.message || 'Unknown error')
    });
  }
});

/**
 * 服务器端代理聊天
 * POST /api/ps/proxy/chat
 * Body: { messages: [...], model?: string, max_tokens?: number }
 */
router.post('/chat', async (req, res) => {
  if (!MODEL_API_KEY) {
    return res.status(503).json({
      error: true,
      code: 'PROXY_NOT_CONFIGURED',
      message: '服务器端 API 密钥未配置，请使用自有 API 密钥'
    });
  }

  const { messages, model, max_tokens } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_MESSAGES',
      message: '消息列表不能为空'
    });
  }

  // Validate message format
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return res.status(400).json({
        error: true,
        code: 'INVALID_MESSAGE_FORMAT',
        message: '每条消息必须包含 role 和 content 字段'
      });
    }
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      return res.status(400).json({
        error: true,
        code: 'INVALID_ROLE',
        message: '消息 role 必须是 system/user/assistant'
      });
    }
  }

  try {
    const data = await callModelAPI('POST', '/chat/completions', {
      model: model || DEFAULT_MODEL,
      messages,
      max_tokens: Math.min(max_tokens || 4000, 8000),
      temperature: 0.3
    });

    if (data.choices && data.choices[0] && data.choices[0].message) {
      res.json({
        error: false,
        reply: data.choices[0].message.content,
        model: data.model || model || DEFAULT_MODEL,
        usage: data.usage || null
      });
    } else if (data.error) {
      res.status(502).json({
        error: true,
        code: 'MODEL_ERROR',
        message: data.error.message || '模型返回错误'
      });
    } else {
      res.status(502).json({
        error: true,
        code: 'UNEXPECTED_RESPONSE',
        message: '模型返回了意外格式的响应'
      });
    }
  } catch (err) {
    res.status(502).json({
      error: true,
      code: 'PROXY_ERROR',
      message: '服务器代理请求失败: ' + (err.message || 'Unknown error')
    });
  }
});

/**
 * 服务器端代理流式聊天（SSE）
 * POST /api/ps/proxy/chat/stream
 * Body: { messages: [...], model?: string, max_tokens?: number }
 */
router.post('/chat/stream', async (req, res) => {
  if (!MODEL_API_KEY) {
    return res.status(503).json({
      error: true,
      code: 'PROXY_NOT_CONFIGURED',
      message: '服务器端 API 密钥未配置'
    });
  }

  const { messages, model, max_tokens } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_MESSAGES',
      message: '消息列表不能为空'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const base = MODEL_API_BASE.replace(/\/+$/, '');
    const chatUrl = new URL(base + '/chat/completions');
    const isHttps = chatUrl.protocol === 'https:';
    const mod = isHttps ? https : http;

    const body = JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      max_tokens: Math.min(max_tokens || 4000, 8000),
      temperature: 0.3,
      stream: true
    });

    const options = {
      hostname: chatUrl.hostname,
      port: chatUrl.port || (isHttps ? 443 : 80),
      path: chatUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + MODEL_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    };

    const proxyReq = mod.request(options, (proxyRes) => {
      proxyRes.on('data', (chunk) => {
        res.write(chunk);
      });
      proxyRes.on('end', () => {
        res.end();
      });
    });

    proxyReq.on('error', (err) => {
      res.write('data: ' + JSON.stringify({ error: true, message: err.message }) + '\n\n');
      res.end();
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      res.write('data: ' + JSON.stringify({ error: true, message: 'Request timeout' }) + '\n\n');
      res.end();
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.write(body);
    proxyReq.end();
  } catch (err) {
    res.write('data: ' + JSON.stringify({ error: true, message: err.message }) + '\n\n');
    res.end();
  }
});

/**
 * Helper: Call model API (non-streaming)
 */
function callModelAPI(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const base = MODEL_API_BASE.replace(/\/+$/, '');
    const url = new URL(base + endpoint);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method,
      headers: {
        'Authorization': 'Bearer ' + MODEL_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_e) {
          reject(new Error('Failed to parse API response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = router;
