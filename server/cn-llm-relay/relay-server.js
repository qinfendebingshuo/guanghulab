#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🇨🇳 CN LLM Relay · 国内模型API代理中继服务
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-CN-LLM-RELAY-001
 * 服务器: ZY-SVR-003 · 43.138.243.30 · 广州
 * 端口: 3900
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 接收新加坡服务器转发的LLM API请求
 *   - 在国内网络环境下直连国内模型API（零跨境延迟）
 *   - Bearer Token鉴权防止外部滥用
 *   - 返回AI回复给新加坡服务器
 *
 * 架构 (与硅谷Claude中继对称):
 *   用户 → SG(ZY-SVR-002) → 广州(ZY-SVR-003):3900 → 国内API
 *   硅谷模式: SG → SV(SSH隧道) → Claude API
 *   广州模式: SG → 广州(HTTP代理) → 国内API
 */

'use strict';

const express = require('express');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = process.env.RELAY_PORT || 3900;
const RELAY_API_KEY = process.env.ZY_CN_RELAY_API_KEY || '';

// 启动时校验: 鉴权密钥必须配置
if (!RELAY_API_KEY) {
  console.error('[CN中继] ❌ ZY_CN_RELAY_API_KEY 未配置 · 服务拒绝启动');
  console.error('[CN中继] 请在 .env.relay 中设置 ZY_CN_RELAY_API_KEY');
  process.exit(1);
}

// API请求超时（可通过环境变量调整）
const API_TIMEOUT_MS = parseInt(process.env.ZY_CN_API_TIMEOUT || '60000', 10);

// ─── 国内模型配置 ───
const DOMESTIC_MODELS = {
  ds: {
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    envKey: 'ZY_DEEPSEEK_API_KEY'
  },
  qw: {
    model: 'qwen-turbo',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    envKey: 'ZY_QIANWEN_API_KEY'
  },
  km: {
    model: 'moonshot-v1-8k',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    envKey: 'ZY_KIMI_API_KEY'
  },
  zp: {
    model: 'glm-4-flash',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    envKey: 'ZY_QINGYAN_API_KEY'
  }
};

// ─── 速率限制 ───
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, message: '请求过于频繁' }
}));

app.use(express.json({ limit: '2mb' }));

// ─── 中继状态 ───
const relayState = {
  totalCalls: 0,
  successCalls: 0,
  failedCalls: 0,
  startTime: Date.now(),
  lastCall: null,
  modelStats: {}
};

// ─── Bearer Token 鉴权 ───
function apiKeyAuth(req, res, next) {
  // 健康检查免鉴权
  if (req.path === '/health') return next();

  if (!RELAY_API_KEY) {
    return res.status(503).json({
      error: true,
      message: '中继服务未配置鉴权密钥 (ZY_CN_RELAY_API_KEY)'
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: true, message: '缺少Authorization头' });
  }

  // 常数时间比较防止时序攻击
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(RELAY_API_KEY);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ error: true, message: '鉴权失败' });
    }
  } catch {
    return res.status(403).json({ error: true, message: '鉴权失败' });
  }

  next();
}

app.use(apiKeyAuth);

// ─── 健康检查 ───
app.get('/health', (_req, res) => {
  const available = Object.entries(DOMESTIC_MODELS).filter(([, cfg]) => {
    const key = process.env[cfg.envKey];
    return key && key.length > 5;
  }).map(([id]) => id);

  res.json({
    status: 'ok',
    service: 'cn-llm-relay',
    server: 'ZY-SVR-003',
    location: 'Guangzhou, China',
    port: PORT,
    availableModels: available.length,
    totalModels: Object.keys(DOMESTIC_MODELS).length,
    uptime: Math.floor((Date.now() - relayState.startTime) / 1000),
    stats: {
      total: relayState.totalCalls,
      success: relayState.successCalls,
      failed: relayState.failedCalls
    }
  });
});

// ─── 调用国内模型API ───
function callDomesticAPI(modelConfig, apiKey, requestBody) {
  return new Promise((resolve, reject) => {
    const url = new URL(modelConfig.endpoint);
    const bodyStr = JSON.stringify(requestBody);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (body.error) {
            reject(new Error(`${modelConfig.endpoint}: ${body.error.message || JSON.stringify(body.error)}`));
          } else {
            resolve(body);
          }
        } catch (e) {
          reject(new Error(`${modelConfig.endpoint} 响应解析失败 (HTTP ${res.statusCode})`));
        }
      });
    });

    req.setTimeout(API_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`${modelConfig.endpoint} 请求超时(${API_TIMEOUT_MS}ms)`));
    });
    req.on('error', (err) => {
      reject(new Error(`${modelConfig.endpoint} 连接失败: ${err.message}`));
    });
    req.write(bodyStr);
    req.end();
  });
}

// ─── 核心中继接口 ───
app.post('/llm/chat', async (req, res) => {
  const startTime = Date.now();
  relayState.totalCalls++;
  relayState.lastCall = new Date().toISOString();

  try {
    const { messages, model_id, temperature, max_tokens, fallback_order } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: true,
        message: '缺少messages参数'
      });
    }

    // 确定模型尝试顺序
    const tryOrder = fallback_order && Array.isArray(fallback_order)
      ? fallback_order
      : (model_id ? [model_id] : Object.keys(DOMESTIC_MODELS));

    let lastError = null;

    for (const mid of tryOrder) {
      const modelCfg = DOMESTIC_MODELS[mid];
      if (!modelCfg) continue;

      const apiKey = process.env[modelCfg.envKey];
      if (!apiKey || apiKey.length < 5) continue;

      try {
        const requestBody = {
          model: modelCfg.model,
          messages,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 2000,
          stream: false
        };

        const response = await callDomesticAPI(modelCfg, apiKey, requestBody);
        const elapsed = Date.now() - startTime;

        // 统计
        relayState.successCalls++;
        if (!relayState.modelStats[mid]) {
          relayState.modelStats[mid] = { calls: 0, tokens: 0 };
        }
        relayState.modelStats[mid].calls++;
        relayState.modelStats[mid].tokens += (response.usage?.total_tokens || 0);

        return res.json({
          success: true,
          relay: 'cn-direct',
          model_id: mid,
          choices: response.choices,
          usage: response.usage,
          elapsed_ms: elapsed
        });
      } catch (err) {
        lastError = err;
        console.error(`[CN中继] ${mid} 调用失败: ${err.message}`);
        continue;
      }
    }

    // 所有模型都失败
    relayState.failedCalls++;
    res.status(502).json({
      error: true,
      message: '所有国内模型通道均失败',
      last_error: lastError?.message,
      elapsed_ms: Date.now() - startTime
    });
  } catch (err) {
    relayState.failedCalls++;
    res.status(500).json({
      error: true,
      message: `中继内部错误: ${err.message}`
    });
  }
});

// ─── 中继状态接口 ───
app.get('/llm/stats', (_req, res) => {
  res.json({
    ...relayState,
    uptimeMs: Date.now() - relayState.startTime,
    availableModels: Object.entries(DOMESTIC_MODELS)
      .filter(([, cfg]) => {
        const key = process.env[cfg.envKey];
        return key && key.length > 5;
      })
      .map(([id, cfg]) => ({ id, model: cfg.model }))
  });
});

// ─── 启动 ───
app.listen(PORT, '0.0.0.0', () => {
  const available = Object.entries(DOMESTIC_MODELS).filter(([, cfg]) => {
    const key = process.env[cfg.envKey];
    return key && key.length > 5;
  });
  console.log(`
═══════════════════════════════════════════════
🇨🇳 CN LLM Relay · 国内模型中继服务
═══════════════════════════════════════════════
  端口: ${PORT}
  鉴权: ${RELAY_API_KEY ? '✅ 已配置' : '❌ 未配置'}
  可用模型: ${available.length}/${Object.keys(DOMESTIC_MODELS).length}
  ${available.map(([id, cfg]) => `  · ${id}: ${cfg.model}`).join('\n')}
═══════════════════════════════════════════════
  `);
});
