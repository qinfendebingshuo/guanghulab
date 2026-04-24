/**
 * routes/chat.js — 对话路由（v2.0 轻量版）
 *
 * 前端 ←→ persona-engine ←→ Notion大脑 + 仓库工具箱
 *
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const express = require('express');
const router = express.Router();
const personaEngine = require('../services/persona-engine');
const ToolRegistry = require('../services/tool-registry');

// ── 对话接口 ──
router.post('/', async (req, res) => {
  try {
    const { message, history = [], model, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '消息不能为空' });
    }

    const result = await personaEngine.chat(message, history, {
      model,
      sessionId: sessionId || `web-${Date.now()}`
    });

    res.json({
      reply: result.content,
      model: result.model,
      brainLoaded: result.brainLoaded,
      toolsUsed: result.toolsUsed || [],
      rounds: result.rounds || 0
    });
  } catch (err) {
    console.error('[Chat] 对话失败:', err.message);
    res.status(500).json({
      error: '对话服务暂时不可用',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ── 刷新大脑缓存 ──
router.post('/refresh-brain', async (req, res) => {
  personaEngine.refreshBrain();
  res.json({ message: '大脑缓存已刷新，下次对话将重新从 Notion 加载' });
});

// ── 工具箱状态 ──
router.get('/tools', (req, res) => {
  res.json({
    manifest: ToolRegistry.getToolManifest(),
    loadedCount: ToolRegistry.getLoadedCount(),
    message: '用什么拿什么，用完还回去'
  });
});

// ── 卸载所有工具模块（释放内存）──
router.post('/tools/unload', (req, res) => {
  ToolRegistry.unloadAll();
  res.json({ message: '全部工具模块已卸载', loadedCount: 0 });
});

module.exports = router;
