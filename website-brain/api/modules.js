/**
 * 模块注册 API — 热插拔模块管理
 * L4 · 网站总大脑 · Phase 1 骨架
 */
const express = require('express');
const router = express.Router();

// POST /api/modules/register — 注册新模块
router.post('/register', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Module registration pending PostgreSQL connection (Phase 1)'
  });
});

// GET /api/modules — 列出所有模块
router.get('/', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Module listing pending PostgreSQL connection (Phase 1)'
  });
});

// GET /api/modules/:id — 获取模块详情
router.get('/:id', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Module detail pending PostgreSQL connection (Phase 1)'
  });
});

// PUT /api/modules/:id/status — 更新模块状态
router.put('/:id/status', async (req, res) => {
  res.status(501).json({
    error: true,
    code: 'NOT_IMPLEMENTED',
    message: 'Module status update pending PostgreSQL connection (Phase 1)'
  });
});

module.exports = router;
