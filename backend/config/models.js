// 模型路由配置（支持主备API自动切换）
const PRIMARY_API_KEY = process.env.PRIMARY_API_KEY;
const FALLBACK_API_KEY = process.env.FALLBACK_API_KEY;

const MODELS = {
  deepseek: {
    name: 'DeepSeek Chat',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    primaryApiKey: PRIMARY_API_KEY,
    fallbackApiKey: FALLBACK_API_KEY,
    model: 'deepseek-chat',
    maxTokens: 4096
  },
  gpt4o_mini: {
    name: 'GPT-4o-mini',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    primaryApiKey: PRIMARY_API_KEY,
    fallbackApiKey: FALLBACK_API_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 4096
  }
};

const DEFAULT_MODEL = 'deepseek';

module.exports = {
  MODELS,
  DEFAULT_MODEL
};
