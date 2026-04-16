/**
 * ═══════════════════════════════════════════════════════════
 * 成员Agent路由 · /api/zhiku/agent
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 3 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 端点:
 *   GET    /                          — 列出所有Agent
 *   GET    /:memberId                 — 获取Agent详情
 *   POST   /:memberId                 — 注册/获取Agent
 *   POST   /:memberId/chat            — 对话
 *   GET    /:memberId/chat            — 获取对话历史
 *   GET    /:memberId/memories        — 获取记忆
 *   POST   /:memberId/memories        — 添加记忆
 *   GET    /:memberId/notes           — 获取笔记
 *   POST   /:memberId/notes           — 添加笔记
 *   GET    /stats                     — Agent统计
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router  = express.Router();
const engine  = require('../services/member-agent-engine');

/* ─── GET /stats — 统计 (放在 /:memberId 前面) ─── */
router.get('/stats', (req, res) => {
  res.json({ error: false, data: engine.getStats() });
});

/* ─── GET / — 列出所有Agent ─── */
router.get('/', (req, res) => {
  const agents = engine.listAgents();
  res.json({ error: false, data: agents, total: agents.length });
});

/* ─── GET /:memberId — 获取Agent详情 ─── */
router.get('/:memberId', (req, res) => {
  const agent = engine.getAgent(req.params.memberId);
  if (!agent) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: 'Agent不存在' });
  // 返回摘要（不暴露全部记忆）
  res.json({
    error: false,
    data: {
      member_id:    agent.member_id,
      nickname:     agent.nickname,
      role:         agent.role,
      memory_count: agent.memory ? agent.memory.length : 0,
      note_count:   agent.notes ? agent.notes.length : 0,
      chat_count:   agent.chat_history ? agent.chat_history.length : 0,
      preferences:  agent.preferences,
      last_active:  agent.last_active,
      created_at:   agent.created_at
    }
  });
});

/* ─── POST /:memberId — 注册/获取Agent ─── */
router.post('/:memberId', (req, res) => {
  try {
    const { nickname, role } = req.body;
    const agent = engine.getOrCreateAgent(req.params.memberId, { nickname, role });
    res.json({
      error: false,
      data: {
        member_id:   agent.member_id,
        nickname:    agent.nickname,
        role:        agent.role,
        last_active: agent.last_active,
        created_at:  agent.created_at
      }
    });
  } catch (err) {
    res.status(400).json({ error: true, code: 'CREATE_FAILED', message: err.message });
  }
});

/* ─── POST /:memberId/chat — 对话 ─── */
router.post('/:memberId/chat', (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: true, code: 'EMPTY_MESSAGE', message: '消息不能为空' });
    }
    const result = engine.chat(req.params.memberId, message);
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'CHAT_FAILED', message: err.message });
  }
});

/* ─── GET /:memberId/chat — 对话历史 ─── */
router.get('/:memberId/chat', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
  const history = engine.getChatHistory(req.params.memberId, limit);
  res.json({ error: false, data: history, total: history.length });
});

/* ─── GET /:memberId/memories — 记忆列表 ─── */
router.get('/:memberId/memories', (req, res) => {
  const { type, limit } = req.query;
  const memories = engine.getMemories(req.params.memberId, {
    type, limit: limit ? parseInt(limit) : undefined
  });
  res.json({ error: false, data: memories, total: memories.length });
});

/* ─── POST /:memberId/memories — 添加记忆 ─── */
router.post('/:memberId/memories', (req, res) => {
  try {
    const { type, content, source, tags } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: true, code: 'EMPTY_CONTENT', message: 'content 不能为空' });
    }
    const result = engine.addMemory(req.params.memberId, { type, content, source, tags });
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'ADD_MEMORY_FAILED', message: err.message });
  }
});

/* ─── GET /:memberId/notes — 笔记列表 ─── */
router.get('/:memberId/notes', (req, res) => {
  const { book_id, limit } = req.query;
  const notes = engine.getNotes(req.params.memberId, {
    book_id, limit: limit ? parseInt(limit) : undefined
  });
  res.json({ error: false, data: notes, total: notes.length });
});

/* ─── POST /:memberId/notes — 添加笔记 ─── */
router.post('/:memberId/notes', (req, res) => {
  try {
    const { title, content, book_id } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: true, code: 'EMPTY_CONTENT', message: 'content 不能为空' });
    }
    const result = engine.addNote(req.params.memberId, { title, content, book_id });
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'ADD_NOTE_FAILED', message: err.message });
  }
});

module.exports = router;
