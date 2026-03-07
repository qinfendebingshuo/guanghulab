const express = require('express');
const axios = require('axios');
const router = express.Router();
const { MODELS, DEFAULT_MODEL } = require('../config/models');

router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: '模型路由正常 ❤️ (支持主备自动切换)',
    available_models: Object.keys(MODELS),
    default_model: DEFAULT_MODEL
  });
});

// 带 fallback 的 API 调用函数
async function callAPIWithFallback(model, message) {
  // 第一次尝试：主密钥
  try {
    console.log(`[API] 尝试使用主密钥调用 ${model.name}`);
    const response = await axios.post(
      model.apiUrl,
      {
        model: model.model,
        messages: [{ role: 'user', content: message }],
        max_tokens: model.maxTokens
      },
      {
        headers: {
          'Authorization': 'Bearer ' + model.primaryApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    return { success: true, data: response.data };
  } catch (primaryErr) {
    // 判断是否需要 fallback（余额不足/超时/401/403）
    const shouldFallback = 
      primaryErr.response?.status === 401 ||
      primaryErr.response?.status === 403 ||
      primaryErr.response?.data?.error?.type === 'insufficient_quota' ||
      primaryErr.code === 'ECONNABORTED' ||
      primaryErr.message.includes('timeout');

    if (!shouldFallback || !model.fallbackApiKey) {
      // 不需要 fallback 或没有备用密钥，直接抛出错误
      throw primaryErr;
    }

    // 需要 fallback，尝试备用密钥
    console.log(`[API Fallback] 从主密钥切换到备用密钥 (${model.name})`);
    try {
      const fallbackResponse = await axios.post(
        model.apiUrl,
        {
          model: model.model,
          messages: [{ role: 'user', content: message }],
          max_tokens: model.maxTokens
        },
        {
          headers: {
            'Authorization': 'Bearer ' + model.fallbackApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      return { success: true, data: fallbackResponse.data, fallback: true };
    } catch (fallbackErr) {
      // 备用也失败了，抛出备用错误
      throw fallbackErr;
    }
  }
}

router.post('/chat', async (req, res) => {
  try {
    const { message, model_name } = req.body;
    const model = MODELS[model_name || DEFAULT_MODEL];

    if (!model) {
      return res.status(400).json({ error: '未知模型: ' + model_name });
    }

    if (!model.primaryApiKey) {
      return res.status(503).json({ 
        error: '模型 ' + model.name + ' 的主 API Key 尚未配置', 
        hint: '请检查 .env 文件中的 PRIMARY_API_KEY' 
      });
    }

    const result = await callAPIWithFallback(model, message);
    
    res.json({
      model: model.name,
      reply: result.data.choices[0].message.content,
      fallback_used: result.fallback || false
    });
  } catch (err) {
    console.error('[API Error]', err.message);
    res.status(500).json({
      error: err.message,
      detail: err.response ? err.response.data : null
    });
  }
});

module.exports = router;
