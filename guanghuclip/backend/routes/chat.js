/**
 * 💬 聊天API路由
 * POST /api/chat          — 发送消息
 * GET  /api/chat/personas  — 获取人格体列表
 * GET  /api/chat/tools     — 获取工具清单
 * GET  /api/chat/status    — 获取系统状态
 * POST /api/chat/clear     — 清空会话
 */
const express = require('express');
const router = express.Router();
const sessionOrchestrator = require('../services/session-orchestrator');
const conversationManager = require('../services/conversation-manager');
const toolExecutor = require('../services/tool-executor');
const llmClient = require('../services/llm-client');

// ── 发送消息 ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { message, userId = 'anonymous', personaId = 'default' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    const io = req.app.get('io');

    // 通知前端：人格体开始思考
    if (io) {
      io.emit('chat:thinking', {
        userId,
        personaId,
        timestamp: new Date().toISOString(),
      });
    }

    // 核心：会话编排器处理消息
    const result = await sessionOrchestrator.handleMessage(
      userId,
      message.trim(),
      personaId,
      io
    );

    // 通知前端：人格体回复完成
    if (io) {
      io.emit('chat:reply', {
        userId,
        persona: result.persona,
        reply: result.reply,
        toolCalls: result.toolCalls,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      reply: result.reply,
      persona: result.persona,
      toolCalls: result.toolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        status: tc.status,
        result: tc.result,
        duration: tc.duration,
        timestamp: tc.timestamp,
      })),
      duration: result.duration,
    });
  } catch (err) {
    console.error('[POST /api/chat]', err);
    res.status(500).json({ error: '服务器内部错误: ' + err.message });
  }
});

// ── 获取人格体列表 ──────────────────────────────────
router.get('/personas', (_req, res) => {
  res.json({ personas: sessionOrchestrator.getPersonaList() });
});

// ── 获取工具清单 ────────────────────────────────────
router.get('/tools', (_req, res) => {
  res.json({ tools: toolExecutor.getToolList() });
});

// ── 获取系统状态 ────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({
    lighthouse: '🗼 active',
    llm: llmClient.getStatus(),
    conversations: conversationManager.getStats(),
    tools: toolExecutor.getToolList().length,
  });
});

// ── 清空会话 ────────────────────────────────────────
router.post('/clear', (req, res) => {
  const { userId = 'anonymous' } = req.body;
  conversationManager.clearSession(userId);
  res.json({ message: '会话已清空' });
});

module.exports = router;
