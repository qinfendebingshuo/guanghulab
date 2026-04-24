/**
 * 🧠 LLM 客户端 · 多模型路由
 * 
 * 支持的模型（按优先级）：
 * 1. DeepSeek (ZY_DEEPSEEK_API_KEY)
 * 2. 通义千问 (ZY_QIANWEN_API_KEY)
 * 3. Kimi (ZY_KIMI_API_KEY)
 * 4. 智谱清言 (ZY_QINGYAN_API_KEY)
 */
const axios = require('axios');

const MODEL_CONFIGS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    envKey: 'ZY_DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 4096,
  },
  {
    id: 'qianwen',
    name: '通义千问',
    envKey: 'ZY_QIANWEN_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    maxTokens: 4096,
  },
  {
    id: 'kimi',
    name: 'Kimi',
    envKey: 'ZY_KIMI_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    maxTokens: 4096,
  },
  {
    id: 'qingyan',
    name: '智谱清言',
    envKey: 'ZY_QINGYAN_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    maxTokens: 4096,
  },
];

function getAvailableModels() {
  return MODEL_CONFIGS.filter(m => !!process.env[m.envKey]);
}

function getActiveModel() {
  const available = getAvailableModels();
  return available.length > 0 ? available[0] : null;
}

/**
 * 调用 LLM
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @returns {string} AI回复文本
 */
async function chat(messages, options = {}) {
  let model;
  
  if (options.modelId) {
    model = MODEL_CONFIGS.find(m => m.id === options.modelId && process.env[m.envKey]);
    if (!model) throw new Error(`模型 ${options.modelId} 不可用`);
  } else {
    model = getActiveModel();
    if (!model) throw new Error('没有可用的LLM模型，请检查API Key配置');
  }
  
  const apiKey = process.env[model.envKey];
  console.log(`[🧠 LLM] 使用模型: ${model.name} (${model.model})`);
  
  try {
    const resp = await axios.post(
      `${model.baseUrl}/chat/completions`,
      {
        model: model.model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || model.maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    
    const reply = resp.data?.choices?.[0]?.message?.content;
    if (!reply) {
      console.error('[🧠 LLM] 响应无内容:', JSON.stringify(resp.data));
      throw new Error('LLM返回了空内容');
    }
    
    console.log(`[🧠 LLM] 回复长度: ${reply.length} chars`);
    return reply;
  } catch (err) {
    if (err.response) {
      const msg = err.response.data?.error?.message
        || err.response.data?.message
        || JSON.stringify(err.response.data);
      console.error(`[🧠 LLM] ${model.name} 错误 (${err.response.status}): ${msg}`);
      
      // 自动降级
      const available = getAvailableModels();
      const nextModel = available.find(m => m.id !== model.id);
      if (nextModel && !options._retried) {
        console.log(`[🧠 LLM] 自动降级到 ${nextModel.name}`);
        return chat(messages, { ...options, modelId: nextModel.id, _retried: true });
      }
      
      throw new Error(`${model.name} API错误: ${msg}`);
    }
    throw err;
  }
}

function getStatus() {
  const available = getAvailableModels();
  const active = getActiveModel();
  return {
    available: available.map(m => ({ id: m.id, name: m.name })),
    active: active ? { id: active.id, name: active.name } : null,
    totalConfigured: available.length,
  };
}

module.exports = { chat, getStatus, getAvailableModels, getActiveModel };
