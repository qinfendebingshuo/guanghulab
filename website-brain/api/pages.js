/**
 * 页面 CRUD API — 类 Notion Page
 * L4 · 网站总大脑 · Phase 1 骨架
 */
const express = require('express');
const router = express.Router();

// POST /api/pages — 创建页面
router.post('/', async (req, res) => {
  // Phase 1: stub — 等 PostgreSQL 连接后实现
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Page creation pending PostgreSQL connection (Phase 1)'
  });
});

// GET /api/pages/:id — 读取页面
router.get('/:id', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Page read pending PostgreSQL connection (Phase 1)'
  });
});

// PUT /api/pages/:id — 更新页面
router.put('/:id', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Page update pending PostgreSQL connection (Phase 1)'
  });
});

// DELETE /api/pages/:id — 删除页面
router.delete('/:id', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Page delete pending PostgreSQL connection (Phase 1)'
  });
});

module.exports = router;
