/**
 * 人格体聊天路由
 * POST /api/chat/send   — 发送消息并获取回复
 * GET  /api/chat/models  — 获取可用模型列表
 */
const express = require('express');
const router = express.Router();
const personaEngine = require('../services/persona-engine');
const llmClient = require('../services/llm-client');

// ── 获取可用模型列表 ────────────────────────────────
router.get('/models', (req, res) => {
  try {
    const models = llmClient.getAvailableModels();
    const bestModel = llmClient.selectBestModel();
    res.json({ models, defaultModel: bestModel });
  } catch (err) {
    console.error('[GET /api/chat/models]', err);
    res.status(500).json({ error: '获取模型列表失败' });
  }
});

// ── 发送消息 ────────────────────────────────────────
router.post('/send', async (req, res) => {
  try {
    const { message, history, modelId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    const result = await personaEngine.chat({
      message: message.trim(),
      history: history || [],
      modelId: modelId || undefined,
    });

    res.json({
      reply: result.reply,
      model: result.model,
      modelName: result.modelName,
      toolsUsed: result.toolsUsed,
    });
  } catch (err) {
    console.error('[POST /api/chat/send]', err);

    // 友好错误提示
    let errorMsg = '人格体暂时无法回复';
    if (err.message.includes('API Key')) {
      errorMsg = '大模型API Key未配置或无效，请检查服务器环境变量';
    } else if (err.message.includes('额度')) {
      errorMsg = '当前模型额度不足，请切换其他模型或充值';
    } else if (err.message.includes('timeout')) {
      errorMsg = '模型响应超时，请稍后重试';
    }

    res.status(500).json({
      error: errorMsg,
      detail: err.message,
    });
  }
});

module.exports = router;
