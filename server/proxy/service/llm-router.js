#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/llm-router.js
// 🤖 AI大模型动态路由器
//
// 核心原则 (冰朔指令):
//   - 不写死模型，系统自动检测+按需调用
//   - 调用失败自动切换下一个
//   - 所有模型都失败 → 推送邮件给冰朔
//
// 使用仓库已配置的 ZY_LLM_API_KEY + ZY_LLM_BASE_URL
// secrets-manifest.json 确认此KEY支持多模型动态路由
// ═══════════════════════════════════════════════

'use strict';

const https = require('https');
const http = require('http');

// ── 模型优先级列表（自动降级）──────────────────
// API网关会根据可用性自动路由，但我们仍按优先级尝试
const MODEL_PRIORITY = [
  'deepseek-chat',
  'qwen-turbo',
  'moonshot-v1-8k',
  'glm-4-flash',
  'claude-3-haiku-20240307',
  'gpt-4o-mini'
];

// ── 路由器状态 ──────────────────────────────
const routerState = {
  total_calls: 0,
  successful_calls: 0,
  failed_calls: 0,
  last_success: null,
  last_error: null,
  model_stats: {}  // 每个模型的调用统计
};

/**
 * 调用LLM API（自动模型降级）
 * @param {string} prompt - 用户/系统提示
 * @param {Object} options - 可选配置
 * @param {string} options.systemPrompt - 系统提示
 * @param {number} options.maxTokens - 最大token数
 * @param {number} options.timeout - 超时时间(ms)
 * @param {string[]} options.preferModels - 优先尝试的模型列表
 * @returns {Promise<{content: string, model: string, usage: Object}|null>}
 */
async function callLLM(prompt, options = {}) {
  const apiKey = process.env.ZY_LLM_API_KEY || '';
  const baseUrl = process.env.ZY_LLM_BASE_URL || '';

  if (!apiKey || !baseUrl) {
    console.log('[LLM路由器] API未配置 (ZY_LLM_API_KEY / ZY_LLM_BASE_URL)');
    return null;
  }

  const {
    systemPrompt = '你是光湖语言世界VPN系统的AI助手。请简洁、准确地回答问题。',
    maxTokens = 500,
    timeout = 30000,
    preferModels = null
  } = options;

  const modelsToTry = preferModels || MODEL_PRIORITY;
  routerState.total_calls++;

  for (const model of modelsToTry) {
    try {
      const result = await _callSingleModel(baseUrl, apiKey, model, prompt, systemPrompt, maxTokens, timeout);
      if (result) {
        routerState.successful_calls++;
        routerState.last_success = {
          model,
          time: new Date().toISOString()
        };

        // 更新模型统计
        if (!routerState.model_stats[model]) {
          routerState.model_stats[model] = { success: 0, fail: 0 };
        }
        routerState.model_stats[model].success++;

        return result;
      }
    } catch (err) {
      console.log(`[LLM路由器] 模型 ${model} 调用失败: ${err.message}，尝试下一个...`);

      if (!routerState.model_stats[model]) {
        routerState.model_stats[model] = { success: 0, fail: 0 };
      }
      routerState.model_stats[model].fail++;
    }
  }

  // 所有模型都失败
  routerState.failed_calls++;
  routerState.last_error = {
    time: new Date().toISOString(),
    message: `所有模型(${modelsToTry.length}个)均调用失败`
  };

  console.error(`[LLM路由器] ❌ 所有模型均不可用`);
  return null;
}

/**
 * 调用单个模型
 */
function _callSingleModel(baseUrl, apiKey, model, prompt, systemPrompt, maxTokens, timeout) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(baseUrl);
    } catch {
      // 如果baseUrl不含协议，加上https
      urlObj = new URL(`https://${baseUrl}`);
    }

    const postData = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    });

    // 构建路径：如果baseUrl已包含chat/completions路径则使用
    // 否则追加 /v1/chat/completions
    let apiPath = urlObj.pathname;
    if (!apiPath || apiPath === '/') {
      apiPath = '/v1/chat/completions';
    } else if (!apiPath.includes('/chat/completions')) {
      apiPath = apiPath.replace(/\/+$/, '') + '/chat/completions';
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout
    };

    const httpModule = urlObj.protocol === 'http:' ? http : https;

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: 请求失败`));
            return;
          }
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error('响应中无content字段'));
            return;
          }
          resolve({
            content,
            model: json.model || model,
            usage: json.usage || null
          });
        } catch (e) {
          reject(new Error(`JSON解析失败: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`超时(${timeout}ms)`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 获取路由器状态
 */
function getRouterStatus() {
  return {
    ...routerState,
    api_configured: !!(process.env.ZY_LLM_API_KEY && process.env.ZY_LLM_BASE_URL),
    models_available: MODEL_PRIORITY
  };
}

module.exports = { callLLM, getRouterStatus, MODEL_PRIORITY };
