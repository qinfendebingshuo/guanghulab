/**
 * ═══════════════════════════════════════════════════════════
 * 智能小说系统路由 · /api/novel
 * ═══════════════════════════════════════════════════════════
 *
 * ZY-PROJ-004 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 端点:
 *   — 小说项目 —
 *   GET    /                                  — 列出小说
 *   POST   /                                  — 创建小说
 *   GET    /:novelId                          — 小说详情
 *   PUT    /:novelId                          — 更新小说
 *   DELETE /:novelId                          — 删除小说
 *
 *   — 章节 —
 *   GET    /:novelId/chapters                 — 章节列表
 *   POST   /:novelId/chapters                 — 添加章节
 *   GET    /:novelId/chapters/:chapterId      — 章节详情
 *   PUT    /:novelId/chapters/:chapterId      — 更新章节
 *   DELETE /:novelId/chapters/:chapterId      — 删除章节
 *
 *   — 人物卡 —
 *   GET    /:novelId/characters               — 人物列表
 *   POST   /:novelId/characters               — 添加人物
 *   PUT    /:novelId/characters/:charId       — 更新人物
 *
 *   — 大纲 —
 *   GET    /:novelId/outline                  — 获取大纲树
 *   POST   /:novelId/outline                  — 添加大纲节点
 *   PUT    /:novelId/outline/:nodeId          — 更新大纲节点
 *
 *   — AI辅助 —
 *   POST   /:novelId/ai/continue/:chapterId   — 续写
 *   POST   /:novelId/ai/rewrite/:chapterId    — 改写
 *   POST   /:novelId/ai/suggest               — 情节建议
 *
 *   — 统计 —
 *   GET    /stats                             — 系统统计
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router  = express.Router();
const engine  = require('../services/novel-engine');

// ══════════════════════════════════════════
// 小说 CRUD
// ══════════════════════════════════════════

/* ─── GET /stats (放在 /:novelId 前面) ─── */
router.get('/stats', (req, res) => {
  res.json({ error: false, data: engine.getStats() });
});

/* ─── GET / — 列表 ─── */
router.get('/', (req, res) => {
  const { author, status, limit } = req.query;
  const novels = engine.listNovels({
    author, status,
    limit: limit ? parseInt(limit) : undefined
  });
  // 返回摘要（不含完整章节内容）
  const summaries = novels.map(n => ({
    novel_id:     n.novel_id,
    title:        n.title,
    author:       n.author,
    genre:        n.genre,
    synopsis:     n.synopsis,
    status:       n.status,
    chapter_count: n.chapters.length,
    character_count: n.characters.length,
    word_count:   n.word_count,
    created_at:   n.created_at,
    updated_at:   n.updated_at
  }));
  res.json({ error: false, data: summaries, total: summaries.length });
});

/* ─── POST / — 创建 ─── */
router.post('/', (req, res) => {
  try {
    const { title, author, genre, synopsis, target_words } = req.body;
    if (!title) return res.status(400).json({ error: true, code: 'MISSING_TITLE', message: 'title 为必填项' });
    const novel = engine.createNovel({ title, author, genre, synopsis, target_words });
    res.json({ error: false, data: novel });
  } catch (err) {
    res.status(400).json({ error: true, code: 'CREATE_FAILED', message: err.message });
  }
});

/* ─── GET /:novelId — 详情 ─── */
router.get('/:novelId', (req, res) => {
  const novel = engine.getNovel(req.params.novelId);
  if (!novel) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '小说不存在' });
  // 返回完整数据（含章节摘要+人物+大纲）
  const data = {
    ...novel,
    chapters: novel.chapters.map(c => ({
      chapter_id: c.chapter_id,
      title:      c.title,
      order:      c.order,
      word_count: c.word_count,
      updated_at: c.updated_at
    }))
  };
  res.json({ error: false, data });
});

/* ─── PUT /:novelId — 更新 ─── */
router.put('/:novelId', (req, res) => {
  try {
    const novel = engine.updateNovel(req.params.novelId, req.body);
    res.json({ error: false, data: novel });
  } catch (err) {
    res.status(400).json({ error: true, code: 'UPDATE_FAILED', message: err.message });
  }
});

/* ─── DELETE /:novelId — 删除 ─── */
router.delete('/:novelId', (req, res) => {
  try {
    const result = engine.deleteNovel(req.params.novelId);
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'DELETE_FAILED', message: err.message });
  }
});

// ══════════════════════════════════════════
// 章节
// ══════════════════════════════════════════

router.get('/:novelId/chapters', (req, res) => {
  const chapters = engine.listChapters(req.params.novelId);
  res.json({ error: false, data: chapters, total: chapters.length });
});

router.post('/:novelId/chapters', (req, res) => {
  try {
    const { title, content, order } = req.body;
    const chapter = engine.addChapter(req.params.novelId, { title, content, order });
    res.json({ error: false, data: chapter });
  } catch (err) {
    res.status(400).json({ error: true, code: 'ADD_CHAPTER_FAILED', message: err.message });
  }
});

router.get('/:novelId/chapters/:chapterId', (req, res) => {
  const chapter = engine.getChapter(req.params.novelId, req.params.chapterId);
  if (!chapter) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '章节不存在' });
  res.json({ error: false, data: chapter });
});

router.put('/:novelId/chapters/:chapterId', (req, res) => {
  try {
    const chapter = engine.updateChapter(req.params.novelId, req.params.chapterId, req.body);
    res.json({ error: false, data: chapter });
  } catch (err) {
    res.status(400).json({ error: true, code: 'UPDATE_CHAPTER_FAILED', message: err.message });
  }
});

router.delete('/:novelId/chapters/:chapterId', (req, res) => {
  try {
    const result = engine.deleteChapter(req.params.novelId, req.params.chapterId);
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'DELETE_CHAPTER_FAILED', message: err.message });
  }
});

// ══════════════════════════════════════════
// 人物卡
// ══════════════════════════════════════════

router.get('/:novelId/characters', (req, res) => {
  const characters = engine.listCharacters(req.params.novelId);
  res.json({ error: false, data: characters, total: characters.length });
});

router.post('/:novelId/characters', (req, res) => {
  try {
    const character = engine.addCharacter(req.params.novelId, req.body);
    res.json({ error: false, data: character });
  } catch (err) {
    res.status(400).json({ error: true, code: 'ADD_CHARACTER_FAILED', message: err.message });
  }
});

router.put('/:novelId/characters/:charId', (req, res) => {
  try {
    const character = engine.updateCharacter(req.params.novelId, req.params.charId, req.body);
    res.json({ error: false, data: character });
  } catch (err) {
    res.status(400).json({ error: true, code: 'UPDATE_CHARACTER_FAILED', message: err.message });
  }
});

// ══════════════════════════════════════════
// 大纲
// ══════════════════════════════════════════

router.get('/:novelId/outline', (req, res) => {
  const outline = engine.getOutline(req.params.novelId);
  res.json({ error: false, data: outline });
});

router.post('/:novelId/outline', (req, res) => {
  try {
    const node = engine.addOutlineNode(req.params.novelId, req.body);
    res.json({ error: false, data: node });
  } catch (err) {
    res.status(400).json({ error: true, code: 'ADD_OUTLINE_FAILED', message: err.message });
  }
});

router.put('/:novelId/outline/:nodeId', (req, res) => {
  try {
    const node = engine.updateOutlineNode(req.params.novelId, req.params.nodeId, req.body);
    res.json({ error: false, data: node });
  } catch (err) {
    res.status(400).json({ error: true, code: 'UPDATE_OUTLINE_FAILED', message: err.message });
  }
});

// ══════════════════════════════════════════
// AI 辅助
// ══════════════════════════════════════════

router.post('/:novelId/ai/continue/:chapterId', (req, res) => {
  try {
    const result = engine.aiContinue(req.params.novelId, req.params.chapterId, req.body);
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'AI_CONTINUE_FAILED', message: err.message });
  }
});

router.post('/:novelId/ai/rewrite/:chapterId', (req, res) => {
  try {
    const result = engine.aiRewrite(req.params.novelId, req.params.chapterId, req.body);
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'AI_REWRITE_FAILED', message: err.message });
  }
});

router.post('/:novelId/ai/suggest', (req, res) => {
  try {
    const result = engine.aiSuggest(req.params.novelId, req.body);
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'AI_SUGGEST_FAILED', message: err.message });
  }
});

module.exports = router;
