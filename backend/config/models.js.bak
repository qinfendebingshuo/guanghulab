// 模型路由配置（统一走云雾API中转）
const YUNWU_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const YUNWU_KEY = process.env.YUNWU_API_KEY;

const MODELS = {
  deepseek: {
    name: 'DeepSeek Chat',
    apiUrl: YUNWU_API_URL,
    apiKey: YUNWU_KEY,
    model: 'deepseek-chat',
    maxTokens: 4096
  },
  gpt4o_mini: {
    name: 'GPT-4o-mini',
    apiUrl: YUNWU_API_URL,
    apiKey: YUNWU_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 4096
  }
};

const DEFAULT_MODEL = 'deepseek';

module.exports = {
  MODELS,
  DEFAULT_MODEL
};
