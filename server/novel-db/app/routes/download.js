/**
 * ═══════════════════════════════════════════════════════════
 * 下载引擎路由 · /api/zhiku/download
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 2 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 端点:
 *   POST /api/zhiku/download          — 创建下载任务
 *   GET  /api/zhiku/download/tasks     — 任务列表
 *   GET  /api/zhiku/download/tasks/:id — 单个任务状态
 *   GET  /api/zhiku/download/books     — 已下载书籍列表
 *   GET  /api/zhiku/download/stats     — 引擎统计
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router  = express.Router();
const engine  = require('../services/download-engine');

/* ─── POST / — 创建下载任务 ─── */
router.post('/', (req, res) => {
  try {
    const { book_name, author, platform, requested_by } = req.body;

    if (!book_name || !platform) {
      return res.status(400).json({
        error:   true,
        code:    'MISSING_PARAMS',
        message: 'book_name 和 platform 为必填项'
      });
    }

    const task = engine.createTask({ book_name, author, platform, requested_by });

    res.status(201).json({
      error: false,
      data:  task,
      message: '下载任务已创建'
    });
  } catch (err) {
    res.status(400).json({
      error:   true,
      code:    'CREATE_TASK_FAILED',
      message: err.message
    });
  }
});

/* ─── GET /tasks — 任务列表 ─── */
router.get('/tasks', (req, res) => {
  const { status, platform, limit } = req.query;
  const tasks = engine.listTasks({
    status,
    platform,
    limit: limit ? parseInt(limit, 10) : undefined
  });

  res.json({
    error: false,
    data:  tasks,
    total: tasks.length
  });
});

/* ─── GET /tasks/:id — 单个任务 ─── */
router.get('/tasks/:id', (req, res) => {
  const task = engine.getTask(req.params.id);

  if (!task) {
    return res.status(404).json({
      error:   true,
      code:    'TASK_NOT_FOUND',
      message: `任务 ${req.params.id} 不存在`
    });
  }

  res.json({ error: false, data: task });
});

/* ─── GET /books — 已下载书籍列表 ─── */
router.get('/books', (req, res) => {
  const books = engine.listBooks();
  res.json({
    error: false,
    data:  books,
    total: books.length
  });
});

/* ─── GET /stats — 引擎统计 ─── */
router.get('/stats', (req, res) => {
  res.json({
    error: false,
    data:  engine.getStats()
  });
});

/* ─── GET /sources — 获取已注册的开源数据源列表 ─── */
router.get('/sources', (req, res) => {
  res.json({
    error: false,
    data:  engine.getRegisteredSources()
  });
});

/* ─── GET /search — 搜索开源数据库匹配 ─── */
router.get('/search', (req, res) => {
  const { book_name, author } = req.query;
  if (!book_name) {
    return res.status(400).json({
      error:   true,
      code:    'MISSING_BOOK_NAME',
      message: 'book_name 参数为必填项'
    });
  }

  const result = engine.searchOpenSources(book_name, author);
  res.json({
    error: false,
    data:  result
  });
});

module.exports = router;
