/**
 * ═══════════════════════════════════════════════════════════
 * AI桥接服务 · AI Bridge Service
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 4 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 接入多模型 AI API（DeepSeek / Kimi / 通义千问）
 *   - 自动降级：按优先级尝试，一个失败自动切换下一个
 *   - 支持第三方 OpenAI 兼容 API（LLM_BASE_URL）
 *   - SSE 流式响应预留
 *
 * 模型优先级:
 *   1. DeepSeek-Chat（成本低·中文强）
 *   2. Kimi / Moonshot（长上下文）
 *   3. 通义千问 Qwen（阿里云原生）
 *   4. 第三方 OpenAI 兼容 API（备用）
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const https = require('https');
const http  = require('http');

// ─── 模型配置（从环境变量读取 API Key） ───
const MODELS = [
  {
    id:       'deepseek',
    name:     'DeepSeek-Chat',
    model:    'deepseek-chat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    envKey:   'DEEPSEEK_API_KEY',
    altEnvKey: 'ZY_DEEPSEEK_API_KEY'
  },
  {
    id:       'kimi',
    name:     'Kimi (Moonshot)',
    model:    'moonshot-v1-8k',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    envKey:   'KIMI_API_KEY',
    altEnvKey: 'ZY_KIMI_API_KEY'
  },
  {
    id:       'qwen',
    name:     '通义千问 Qwen',
    model:    'qwen-max',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    envKey:   'DASHSCOPE_API_KEY',
    altEnvKey: 'ZY_QIANWEN_API_KEY'
  },
  {
    id:       'third-party',
    name:     '第三方 OpenAI 兼容',
    model:    process.env.LLM_MODEL || 'gpt-4o',
    endpoint: (process.env.LLM_BASE_URL || '').replace(/\/$/, '') + '/chat/completions',
    envKey:   'LLM_API_KEY',
    altEnvKey: ''
  }
];

/**
 * 获取模型 API Key
 */
function getApiKey(modelCfg) {
  const key = process.env[modelCfg.envKey] || '';
  if (key && key.length > 5) return key;
  if (modelCfg.altEnvKey) {
    const altKey = process.env[modelCfg.altEnvKey] || '';
    if (altKey && altKey.length > 5) return altKey;
  }
  return '';
}

/**
 * 获取可用模型列表
 */
function getAvailableModels() {
  return MODELS.filter(m => {
    if (m.id === 'third-party' && !process.env.LLM_BASE_URL) return false;
    return !!getApiKey(m);
  }).map(m => ({ id: m.id, name: m.name, model: m.model }));
}

/**
 * HTTP POST 请求
 */
function httpPost(url, body, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!url) {
      return reject(new Error('无效的 API endpoint'));
    }
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        ...headers,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout:  timeoutMs || 60000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`API 错误 (${res.statusCode}): ${data.slice(0, 200)}`));
          return;
        }
        resolve(data);
      });
    });

    req.on('error', err => reject(new Error(`网络错误: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API 请求超时'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * 调用单个模型
 */
async function callSingleModel(modelCfg, messages, options) {
  const apiKey = getApiKey(modelCfg);
  if (!apiKey) throw new Error(`${modelCfg.name} API Key 未配置`);

  const requestBody = {
    model:       modelCfg.model,
    messages:    messages,
    temperature: options.temperature || 0.7,
    max_tokens:  options.maxTokens || 2000,
    stream:      false
  };

  const response = await httpPost(
    modelCfg.endpoint,
    JSON.stringify(requestBody),
    {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    options.timeout || 60000
  );

  const data = JSON.parse(response);

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error(`${modelCfg.name} 返回格式异常`);
  }

  return {
    content:  data.choices[0].message.content,
    model:    data.model || modelCfg.model,
    provider: modelCfg.id,
    usage:    data.usage || {}
  };
}

/**
 * 智能调用 AI（自动降级）
 *
 * @param {Array} messages  OpenAI 格式消息列表
 * @param {object} options  { temperature, maxTokens, preferredModel, timeout }
 * @returns {Promise<object>} { content, model, provider, usage }
 */
async function callAI(messages, options) {
  options = options || {};

  // 如果指定了首选模型，优先使用
  let models = MODELS.filter(m => {
    if (m.id === 'third-party' && !process.env.LLM_BASE_URL) return false;
    return !!getApiKey(m);
  });

  if (options.preferredModel) {
    const preferred = models.find(m => m.id === options.preferredModel);
    if (preferred) {
      models = [preferred, ...models.filter(m => m.id !== options.preferredModel)];
    }
  }

  if (models.length === 0) {
    // 没有任何 API Key 可用，返回离线回复
    return {
      content:  '⚠️ AI服务暂未配置。请在环境变量中设置 DEEPSEEK_API_KEY / KIMI_API_KEY / DASHSCOPE_API_KEY 中的任意一个即可启用AI对话。',
      model:    'offline',
      provider: 'none',
      usage:    {}
    };
  }

  let lastError = null;

  for (const modelCfg of models) {
    try {
      const result = await callSingleModel(modelCfg, messages, options);
      console.log(`[AI-Bridge] ✅ ${modelCfg.name} 调用成功`);
      return result;
    } catch (err) {
      console.error(`[AI-Bridge] ⚠️ ${modelCfg.name} 调用失败: ${err.message}`);
      lastError = err;
      continue;
    }
  }

  // 全部失败
  return {
    content:  `⚠️ AI服务暂时不可用（已尝试 ${models.length} 个模型）。错误: ${lastError ? lastError.message : '未知'}。请稍后重试。`,
    model:    'fallback',
    provider: 'none',
    usage:    {}
  };
}

/**
 * 构建智库 Agent 系统提示词
 */
function buildAgentSystemPrompt(agent) {
  const nickname = agent.nickname || '成员';
  const memoryCount = agent.memory ? agent.memory.length : 0;
  const noteCount = agent.notes ? agent.notes.length : 0;

  // 获取最近的记忆摘要
  const recentMemories = (agent.memory || [])
    .slice(-5)
    .map(m => `- [${m.type}] ${m.content.slice(0, 100)}`)
    .join('\n');

  return `你是光湖智库的AI阅读助手，服务于成员「${nickname}」。

你的核心能力：
1. 📖 阅读辅助 — 帮助理解小说内容、分析情节、解读人物
2. ✂️ 拆文整理 — 分析小说结构、提取大纲、梳理人物关系
3. 📝 摘要生成 — 为章节或整本书生成摘要
4. 💡 创作建议 — 提供写作灵感、情节走向建议
5. 🔍 内容分析 — 分析文风、叙事手法、节奏把控

成员档案：
- 昵称：${nickname}
- 记忆条目：${memoryCount} 条
- 阅读笔记：${noteCount} 条
${recentMemories ? '\n最近记忆：\n' + recentMemories : ''}

交互规则：
- 使用中文回复，语气友好且专业
- 回复简洁有力，避免冗长
- 涉及小说分析时，给出具体的分析角度
- 可以使用 emoji 增强表达`;
}

/**
 * 健康检查
 */
function healthCheck() {
  const available = getAvailableModels();
  return {
    status:          available.length > 0 ? 'ok' : 'no_models',
    available_models: available,
    total_configured: MODELS.length
  };
}

module.exports = {
  callAI,
  getAvailableModels,
  buildAgentSystemPrompt,
  healthCheck
};
