/**
 * ═══════════════════════════════════════════════════════════
 * 智能分章路由 · /api/zhiku/chapter
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 2 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 端点:
 *   POST /api/zhiku/chapter/split      — 对指定书籍执行分章
 *   GET  /api/zhiku/chapter/books       — 已分章书籍列表
 *   GET  /api/zhiku/chapter/:bookId     — 书籍分章详情(目录)
 *   GET  /api/zhiku/chapter/:bookId/:idx — 获取某章内容
 *   GET  /api/zhiku/chapter/stats       — 分章引擎统计
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router  = express.Router();
const engine  = require('../services/chapter-engine');

/* ─── POST /split — 对书籍执行分章 ─── */
router.post('/split', (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({
        error:   true,
        code:    'MISSING_FILENAME',
        message: 'filename 为必填项'
      });
    }

    const result = engine.splitChapters(filename);

    res.json({
      error: false,
      data: {
        book_id:        result.book_id,
        title:          result.title,
        author:         result.author,
        total_chapters: result.total_chapters,
        total_chars:    result.total_chars,
        split_method:   result.split_method,
        toc:            result.toc
      },
      message: `分章完成: ${result.total_chapters} 章`
    });
  } catch (err) {
    res.status(400).json({
      error:   true,
      code:    'SPLIT_FAILED',
      message: err.message
    });
  }
});

/* ─── GET /books — 已分章书籍列表 ─── */
router.get('/books', (req, res) => {
  const books = engine.listChapteredBooks();
  res.json({
    error: false,
    data:  books,
    total: books.length
  });
});

/* ─── GET /stats — 分章引擎统计 ─── */
router.get('/stats', (req, res) => {
  res.json({
    error: false,
    data:  engine.getStats()
  });
});

/* ─── GET /:bookId — 书籍分章详情 ─── */
router.get('/:bookId', (req, res) => {
  const info = engine.getBookChapters(req.params.bookId);

  if (!info) {
    return res.status(404).json({
      error:   true,
      code:    'BOOK_NOT_FOUND',
      message: `未找到已分章的书籍: ${req.params.bookId}`
    });
  }

  res.json({ error: false, data: info });
});

/* ─── GET /:bookId/:idx — 获取某章内容 ─── */
router.get('/:bookId/:idx', (req, res) => {
  const chapterIndex = parseInt(req.params.idx, 10);

  if (isNaN(chapterIndex) || chapterIndex < 0) {
    return res.status(400).json({
      error:   true,
      code:    'INVALID_INDEX',
      message: '章节索引必须为非负整数'
    });
  }

  const content = engine.getChapterContent(req.params.bookId, chapterIndex);

  if (content === null) {
    return res.status(404).json({
      error:   true,
      code:    'CHAPTER_NOT_FOUND',
      message: `未找到章节: ${req.params.bookId} 第${chapterIndex}章`
    });
  }

  // 获取目录信息以返回标题
  const bookInfo = engine.getBookChapters(req.params.bookId);
  const chapterMeta = bookInfo && bookInfo.toc ? bookInfo.toc[chapterIndex] : null;

  res.json({
    error: false,
    data: {
      book_id:       req.params.bookId,
      chapter_index: chapterIndex,
      title:         chapterMeta ? chapterMeta.title : `第${chapterIndex}章`,
      content,
      has_prev:      chapterIndex > 0,
      has_next:      bookInfo ? chapterIndex < bookInfo.total_chapters - 1 : false,
      total_chapters: bookInfo ? bookInfo.total_chapters : 0
    }
  });
});

module.exports = router;
