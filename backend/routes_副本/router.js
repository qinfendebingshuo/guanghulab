const express = require('express');
const axios = require('axios');
const router = express.Router();
const { MODELS, DEFAULT_MODEL } = require('../config/models');

router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: '模型路由正常 ❤️',
    available_models: Object.keys(MODELS),
    default_model: DEFAULT_MODEL
  });
});

router.post('/chat', async (req, res) => {
  try {
    const { message, model_name } = req.body;
    const model = MODELS[model_name || DEFAULT_MODEL];

    if (!model) {
      return res.status(400).json({ error: '未知模型: ' + model_name });
    }

    if (!model.apiKey) {
      return res.status(503).json({ 
        error: '模型 ' + model.name + ' 的 API Key 尚未配置', 
        hint: '请检查 .env 文件中的 YUNWU_API_KEY' 
      });
    }

    const response = await axios.post(
      model.apiUrl,
      {
        model: model.model,
        messages: [{ role: 'user', content: message }],
        max_tokens: model.maxTokens
      },
      {
        headers: {
          'Authorization': 'Bearer ' + model.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      model: model.name,
      reply: response.data.choices[0].message.content
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      detail: err.response ? err.response.data : null
    });
  }
});

module.exports = router;
