/**
 * 国内大模型统一调用客户端
 * 支持: 通义千问 / DeepSeek / Kimi / 智谱清言
 * 全部走官方 OpenAI-compatible 接口
 *
 * 优先级策略（按成本）:
 *   1. 通义千问 — 免费额度
 *   2. 智谱清言 — 免费额度
 *   3. Kimi — 送了15块
 *   4. DeepSeek — 充了50块
 */
const axios = require('axios');
const config = require('../config');

// 模型注册表
const MODEL_REGISTRY = {
  qianwen: {
    name: '通义千问',
    icon: '🧠',
    provider: 'alibaba',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    envKey: 'ZY_QIANWEN_API_KEY',
    costTier: 'free',
    maxTokens: 4096,
    description: '阿里通义千问，中文理解强，有免费额度',
  },
  deepseek: {
    name: 'DeepSeek',
    icon: '🔮',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    envKey: 'ZY_DEEPSEEK_API_KEY',
    costTier: 'low',
    maxTokens: 4096,
    description: 'DeepSeek V3，性价比高，推理能力强',
  },
  kimi: {
    name: 'Kimi',
    icon: '🌙',
    provider: 'moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    envKey: 'ZY_KIMI_API_KEY',
    costTier: 'low',
    maxTokens: 4096,
    description: '月之暗面Kimi，长文本处理强',
  },
  zhipu: {
    name: '智谱清言',
    icon: '💎',
    provider: 'zhipu',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    envKey: 'ZY_QINGYAN_API_KEY',
    costTier: 'free',
    maxTokens: 4096,
    description: '智谱GLM，中文对话优秀，有免费额度',
  },
};

// 优先级顺序（成本从低到高）
const PRIORITY_ORDER = ['qianwen', 'zhipu', 'kimi', 'deepseek'];

class LLMClient {
  /**
   * 获取可用模型列表
   */
  getAvailableModels() {
    const models = [];
    for (const [id, reg] of Object.entries(MODEL_REGISTRY)) {
      const apiKey = config.llm[id]?.apiKey;
      models.push({
        id,
        name: reg.name,
        icon: reg.icon,
        description: reg.description,
        costTier: reg.costTier,
        available: !!apiKey,
      });
    }
    return models;
  }

  /**
   * 自动选择最优模型
   */
  selectBestModel() {
    for (const id of PRIORITY_ORDER) {
      const apiKey = config.llm[id]?.apiKey;
      if (apiKey) return id;
    }
    return null;
  }

  /**
   * 调用大模型 Chat Completion
   * @param {object} opts
   * @param {string} [opts.modelId] - 模型ID，不传则自动选择
   * @param {Array} opts.messages - OpenAI格式消息数组
   * @param {number} [opts.maxTokens] - 最大输出token数
   * @param {number} [opts.temperature] - 温度
   * @param {Array} [opts.tools] - function calling工具定义
   * @returns {Promise<{content: string, model: string, usage: object, toolCalls?: Array}>}
   */
  async chat({ modelId, messages, maxTokens, temperature = 0.7, tools }) {
    const id = modelId || this.selectBestModel();
    if (!id) throw new Error('没有可用的大模型，请检查API Key配置');

    const reg = MODEL_REGISTRY[id];
    if (!reg) throw new Error(`未知模型: ${id}`);

    const apiKey = config.llm[id]?.apiKey;
    if (!apiKey) throw new Error(`${reg.name} API Key 未配置`);

    const payload = {
      model: reg.model,
      messages,
      max_tokens: maxTokens || reg.maxTokens,
      temperature,
    };

    // function calling (通义千问/DeepSeek/智谱 都支持 OpenAI 格式)
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    console.log(`[LLM] 调用 ${reg.name} (${reg.model}) messages=${messages.length}`);

    try {
      const resp = await axios.post(`${reg.baseUrl}/chat/completions`, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      const choice = resp.data.choices?.[0];
      if (!choice) throw new Error('模型未返回有效响应');

      const result = {
        content: choice.message?.content || '',
        model: id,
        modelName: reg.name,
        usage: resp.data.usage || {},
      };

      // 处理 tool calls
      if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
        result.toolCalls = choice.message.tool_calls;
        result.content = choice.message.content || '';
      }

      // 处理 finish_reason
      result.finishReason = choice.finish_reason;

      console.log(`[LLM] ✅ ${reg.name} 响应 ${result.content.length}字 usage=${JSON.stringify(result.usage)}`);
      return result;
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const msg = err.response.data?.error?.message
          || err.response.data?.message
          || JSON.stringify(err.response.data);

        // 额度耗尽，尝试 fallback
        if (status === 429 || status === 402) {
          console.warn(`[LLM] ⚠️ ${reg.name} 额度不足(${status})，尝试切换模型...`);
          const fallback = this._findFallback(id);
          if (fallback) {
            return this.chat({ modelId: fallback, messages, maxTokens, temperature, tools });
          }
          throw new Error(`${reg.name} 额度已用完，且没有可用的备选模型`);
        }

        throw new Error(`${reg.name} API错误(${status}): ${msg}`);
      }
      throw err;
    }
  }

  /**
   * 查找 fallback 模型
   */
  _findFallback(excludeId) {
    for (const id of PRIORITY_ORDER) {
      if (id === excludeId) continue;
      const apiKey = config.llm[id]?.apiKey;
      if (apiKey) return id;
    }
    return null;
  }
}

module.exports = new LLMClient();
module.exports.MODEL_REGISTRY = MODEL_REGISTRY;
module.exports.PRIORITY_ORDER = PRIORITY_ORDER;
