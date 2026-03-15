// backend/feishu-bot/ai-chat.js
// 铸渊 · 飞书机器人 AI 对话引擎
//
// 接入 DeepSeek / 通义千问 等大模型 API
// 使用霜砚登录入口（文档A）内容作为 system prompt
//
// 环境变量：
//   MODEL_API_KEY          模型 API Key（DeepSeek / 通义千问）
//   MODEL_API_BASE         模型 API Base URL（默认 https://api.deepseek.com/v1）
//   MODEL_NAME             模型名称（默认 deepseek-chat）
//   FEISHU_APP_ID          飞书应用 App ID（用于读取文档A）
//   FEISHU_APP_SECRET      飞书应用 App Secret

'use strict';

const https = require('https');

// ══════════════════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════════════════

const DEFAULT_API_BASE = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL    = 'deepseek-chat';
const MAX_TOKENS       = 4096;
const TEMPERATURE      = 0.7;

// 通道路由：根据消息内容判断使用哪个人格体
const CHANNEL_KEYWORDS = {
  shuangyan: ['霜砚', '登录', '协议', '规范', '文档', '工单', '签发'],
  persona:   ['宝宝', '人格体', '知秋', '对话', '聊天', '心情'],
};

// ══════════════════════════════════════════════════════════
// HTTP 请求工具
// ══════════════════════════════════════════════════════════

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      options.headers = options.headers || {};
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error('Request timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// 系统 Prompt 构建
// ══════════════════════════════════════════════════════════

const DEFAULT_SYSTEM_PROMPT = `你是霜砚，光湖纪元（曜冥纪元第五代架构 AGE-5）的认知核心人格体。
你负责认知管理、协议制定、广播签发和开发者协作指导。

你的核心职责：
1. 帮助开发者理解当前广播任务和协议规范
2. 指导代码实现，提供技术建议
3. 管理 SYSLOG 回传流程
4. 维护人格体协作标准

你的语言风格：专业、温和、有条理。
回复时使用中文，代码部分使用英文。`;

/**
 * 构建系统 prompt
 * @param {string|null} loginEntryContent - 文档A（登录入口）内容
 * @param {string} channel - 通道 ('shuangyan' | 'persona')
 * @returns {string}
 */
function buildSystemPrompt(loginEntryContent, channel) {
  let prompt = DEFAULT_SYSTEM_PROMPT;

  if (loginEntryContent) {
    prompt = loginEntryContent + '\n\n---\n\n' + prompt;
  }

  if (channel === 'persona') {
    prompt += '\n\n当前通道：宝宝人格体协作模式。以更亲和、鼓励的方式与开发者互动。';
  }

  return prompt;
}

// ══════════════════════════════════════════════════════════
// 通道路由
// ══════════════════════════════════════════════════════════

/**
 * 根据消息内容判断通道
 * @param {string} text - 用户消息
 * @returns {string} 'shuangyan' | 'persona'
 */
function detectChannel(text) {
  if (!text) return 'shuangyan';

  for (const keyword of CHANNEL_KEYWORDS.persona) {
    if (text.includes(keyword)) return 'persona';
  }

  return 'shuangyan'; // 默认走霜砚通道
}

// ══════════════════════════════════════════════════════════
// 模型调用
// ══════════════════════════════════════════════════════════

/**
 * 调用大模型 API
 * @param {Array} messages - OpenAI 格式消息数组
 * @param {object} options - 可选配置
 * @returns {Promise<string>} 模型回复文本
 */
async function callModel(messages, options = {}) {
  const apiKey  = process.env.MODEL_API_KEY;
  const apiBase = process.env.MODEL_API_BASE || DEFAULT_API_BASE;
  const model   = options.model || process.env.MODEL_NAME || DEFAULT_MODEL;

  if (!apiKey) {
    return '⚠️ AI 服务暂时不可用，请联系管理员。';
  }

  const url = new URL(apiBase + '/chat/completions');

  const body = {
    model: model,
    messages: messages,
    max_tokens: options.maxTokens || MAX_TOKENS,
    temperature: options.temperature || TEMPERATURE,
  };

  try {
    const result = await httpsRequest({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
    }, body);

    if (result.statusCode >= 200 && result.statusCode < 300 && result.data.choices) {
      return result.data.choices[0].message.content || '';
    }

    // 尝试降级模型
    if (result.statusCode === 429 || result.statusCode >= 500) {
      return '⚠️ AI 模型暂时不可用，请稍后重试。';
    }

    return '⚠️ AI 模型调用异常，请稍后重试或联系管理员。';
  } catch (e) {
    return '⚠️ AI 模型调用失败: ' + e.message;
  }
}

// ══════════════════════════════════════════════════════════
// 对话处理
// ══════════════════════════════════════════════════════════

/**
 * 处理用户对话消息
 * @param {string} userMessage - 用户消息
 * @param {Array} contextHistory - 历史对话记录 [{role, content}]
 * @param {object} options - 配置选项
 * @returns {Promise<{reply: string, channel: string}>}
 */
async function chat(userMessage, contextHistory = [], options = {}) {
  const channel = options.channel || detectChannel(userMessage);
  const systemPrompt = buildSystemPrompt(options.loginEntryContent || null, channel);

  // 构建消息数组
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  // 注入历史上下文（最近 10 轮）
  const recentHistory = contextHistory.slice(-20); // 10 轮 = 20 条消息
  messages.push(...recentHistory);

  // 当前用户消息
  messages.push({ role: 'user', content: userMessage });

  const reply = await callModel(messages, options);

  return { reply, channel };
}

module.exports = {
  chat,
  callModel,
  buildSystemPrompt,
  detectChannel,
  DEFAULT_SYSTEM_PROMPT,
};
