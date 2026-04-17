/**
 * ═══════════════════════════════════════════════════════════
 * 在线阅读器路由 · /api/zhiku/reader
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 2 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 端点:
 *   GET    /api/zhiku/reader/shelf/:memberId           — 获取成员书架
 *   POST   /api/zhiku/reader/shelf/:memberId           — 添加书籍到书架
 *   DELETE /api/zhiku/reader/shelf/:memberId/:bookId   — 从书架移除
 *   GET    /api/zhiku/reader/progress/:memberId        — 获取所有阅读进度
 *   GET    /api/zhiku/reader/progress/:memberId/:bookId — 获取某本书进度
 *   POST   /api/zhiku/reader/progress/:memberId/:bookId — 保存阅读进度
 *   GET    /api/zhiku/reader/prefs/:memberId            — 获取阅读偏好
 *   POST   /api/zhiku/reader/prefs/:memberId            — 保存阅读偏好
 *   GET    /api/zhiku/reader/stats                      — 阅读器统计
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router  = express.Router();
const engine  = require('../services/reader-engine');

/* ─── GET /shelf/:memberId — 获取书架 ─── */
router.get('/shelf/:memberId', (req, res) => {
  const shelf = engine.getBookshelf(req.params.memberId);
  res.json({
    error: false,
    data:  shelf,
    total: shelf.length
  });
});

/* ─── POST /shelf/:memberId — 添加到书架 ─── */
router.post('/shelf/:memberId', (req, res) => {
  try {
    const { book_id, title, author } = req.body;

    if (!book_id) {
      return res.status(400).json({
        error:   true,
        code:    'MISSING_BOOK_ID',
        message: 'book_id 为必填项'
      });
    }

    const result = engine.addToBookshelf(req.params.memberId, book_id, { title, author });

    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({
      error:   true,
      code:    'ADD_FAILED',
      message: err.message
    });
  }
});

/* ─── DELETE /shelf/:memberId/:bookId — 从书架移除 ─── */
router.delete('/shelf/:memberId/:bookId', (req, res) => {
  const result = engine.removeFromBookshelf(req.params.memberId, req.params.bookId);
  res.json({ error: false, data: result });
});

/* ─── GET /progress/:memberId — 获取所有阅读进度 ─── */
router.get('/progress/:memberId', (req, res) => {
  const progress = engine.getReadingProgress(req.params.memberId);
  res.json({
    error: false,
    data:  progress || {}
  });
});

/* ─── GET /progress/:memberId/:bookId — 获取某本书进度 ─── */
router.get('/progress/:memberId/:bookId', (req, res) => {
  const progress = engine.getReadingProgress(req.params.memberId, req.params.bookId);
  res.json({
    error: false,
    data:  progress || { chapter_index: 0, scroll_position: 0, percent: 0 }
  });
});

/* ─── POST /progress/:memberId/:bookId — 保存阅读进度 ─── */
router.post('/progress/:memberId/:bookId', (req, res) => {
  try {
    const { chapter_index, scroll_position, percent } = req.body;
    const result = engine.saveReadingProgress(
      req.params.memberId,
      req.params.bookId,
      { chapter_index, scroll_position, percent }
    );

    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({
      error:   true,
      code:    'SAVE_PROGRESS_FAILED',
      message: err.message
    });
  }
});

/* ─── GET /prefs/:memberId — 获取阅读偏好 ─── */
router.get('/prefs/:memberId', (req, res) => {
  const prefs = engine.getPreferences(req.params.memberId);
  res.json({ error: false, data: prefs });
});

/* ─── POST /prefs/:memberId — 保存阅读偏好 ─── */
router.post('/prefs/:memberId', (req, res) => {
  try {
    const { font_size, font_family, theme, line_height } = req.body;
    const result = engine.savePreferences(req.params.memberId, {
      font_size, font_family, theme, line_height
    });

    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({
      error:   true,
      code:    'SAVE_PREFS_FAILED',
      message: err.message
    });
  }
});

/* ─── GET /stats — 阅读器统计 ─── */
router.get('/stats', (req, res) => {
  res.json({
    error: false,
    data:  engine.getStats()
  });
});

module.exports = router;
