/**
 * 数据库表 CRUD API — 类 Notion Database
 * L4 · 网站总大脑 · Phase 1 骨架
 */
const express = require('express');
const router = express.Router();

// POST /api/databases — 创建数据库
router.post('/', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Database creation pending PostgreSQL connection (Phase 1)'
  });
});

// GET /api/databases/:id — 读取数据库
router.get('/:id', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Database read pending PostgreSQL connection (Phase 1)'
  });
});

// PUT /api/databases/:id — 更新数据库
router.put('/:id', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Database update pending PostgreSQL connection (Phase 1)'
  });
});

// DELETE /api/databases/:id — 删除数据库
router.delete('/:id', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Database delete pending PostgreSQL connection (Phase 1)'
  });
});

module.exports = router;
