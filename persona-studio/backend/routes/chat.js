/**
 * persona-studio · 对话路由
 * POST /api/ps/chat/message   对话消息
 * GET  /api/ps/chat/history   对话历史
 */
const express = require('express');
const router = express.Router();
const memoryManager = require('../brain/memory-manager');
const personaEngine = require('../brain/persona-engine');

// POST /api/ps/chat/message
router.post('/message', async (req, res) => {
  const { dev_id, message, history } = req.body || {};

  if (!dev_id || !/^EXP-\d{3,}$/.test(dev_id)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_ID',
      message: '无效的开发编号'
    });
  }

  try {
    // 读取该体验者的记忆
    const memory = memoryManager.loadMemory(dev_id);

    // 判断是否是打招呼
    const isGreeting = message === '__greeting__';

    // 调用人格体引擎获取回复
    const result = await personaEngine.respond({
      dev_id,
      message: isGreeting ? null : message,
      history: history || [],
      memory,
      isGreeting
    });

    // 保存对话记忆（非打招呼时）
    if (!isGreeting && message) {
      memoryManager.appendConversation(dev_id, [
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() }
      ]);

      // 更新最后话题
      memoryManager.updateLastTopic(dev_id, message);
    }

    res.json({
      error: false,
      reply: result.reply,
      build_ready: result.build_ready || false
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({
      error: true,
      code: 'CHAT_ERROR',
      message: '对话服务暂时不可用'
    });
  }
});

// GET /api/ps/chat/history
router.get('/history', (req, res) => {
  const dev_id = req.query.dev_id;

  if (!dev_id || !/^EXP-\d{3,}$/.test(dev_id)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_ID',
      message: '无效的开发编号'
    });
  }

  try {
    const memory = memoryManager.loadMemory(dev_id);
    res.json({
      error: false,
      conversations: memory.conversations || [],
      last_topic: memory.last_topic || null
    });
  } catch {
    res.json({
      error: false,
      conversations: [],
      last_topic: null
    });
  }
});

module.exports = router;
