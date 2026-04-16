/**
 * ═══════════════════════════════════════════════════════════
 * 团队书库路由 · /api/zhiku/library
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 3 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 端点:
 *   GET    /                    — 列出团队书库 (?category=&search=&sort=&limit=)
 *   POST   /                    — 添加书籍到团队书库
 *   GET    /categories          — 获取分类列表
 *   GET    /:bookId             — 获取书籍详情
 *   POST   /:bookId/rate        — 评分
 *   POST   /:bookId/review      — 添加评论
 *   GET    /stats               — 书库统计
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router  = express.Router();
const engine  = require('../services/library-engine');

/* ─── GET /stats — 书库统计 (放在 /:bookId 前面防止路由冲突) ─── */
router.get('/stats', (req, res) => {
  res.json({ error: false, data: engine.getStats() });
});

/* ─── GET /categories — 分类列表 ─── */
router.get('/categories', (req, res) => {
  res.json({ error: false, data: engine.CATEGORIES });
});

/* ─── GET / — 列表 ─── */
router.get('/', (req, res) => {
  const { category, search, sort, limit } = req.query;
  const books = engine.listBooks({
    category, search, sort,
    limit: limit ? parseInt(limit) : undefined
  });
  res.json({ error: false, data: books, total: books.length });
});

/* ─── POST / — 添加书籍 ─── */
router.post('/', (req, res) => {
  try {
    const { book_name, author, category, tags, source_file, added_by } = req.body;
    if (!book_name) {
      return res.status(400).json({ error: true, code: 'MISSING_BOOK_NAME', message: 'book_name 为必填项' });
    }
    const result = engine.addBook({ book_name, author, category, tags, source_file, added_by });
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'ADD_FAILED', message: err.message });
  }
});

/* ─── GET /:bookId — 详情 ─── */
router.get('/:bookId', (req, res) => {
  const book = engine.getBook(req.params.bookId);
  if (!book) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '书籍不存在' });
  res.json({ error: false, data: book });
});

/* ─── POST /:bookId/rate — 评分 ─── */
router.post('/:bookId/rate', (req, res) => {
  try {
    const { score, member_id } = req.body;
    const result = engine.rateBook(req.params.bookId, Number(score), member_id);
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'RATE_FAILED', message: err.message });
  }
});

/* ─── POST /:bookId/review — 评论 ─── */
router.post('/:bookId/review', (req, res) => {
  try {
    const { member_id, content } = req.body;
    const result = engine.addReview(req.params.bookId, { member_id, content });
    res.json({ error: false, data: result });
  } catch (err) {
    res.status(400).json({ error: true, code: 'REVIEW_FAILED', message: err.message });
  }
});

module.exports = router;
