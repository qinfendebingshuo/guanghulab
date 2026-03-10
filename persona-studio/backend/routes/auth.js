/**
 * persona-studio · 登录校验路由
 * POST /api/ps/auth/login  { dev_id: "EXP-001" }
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'brain', 'registry.json');

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch {
    return { developers: {} };
  }
}

// POST /api/ps/auth/login
router.post('/login', (req, res) => {
  const { dev_id } = req.body || {};

  if (!dev_id || !/^EXP-\d{3,}$/.test(dev_id)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_ID',
      message: '编号格式不正确，请使用 EXP-XXX 格式'
    });
  }

  const registry = loadRegistry();
  const entry = registry.developers && registry.developers[dev_id];

  if (!entry) {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: '编号未注册，请联系管理员获取编号'
    });
  }

  if (entry.status !== 'active' && entry.status !== 'pending_activation') {
    return res.status(403).json({
      error: true,
      code: 'INACTIVE',
      message: '编号未激活，请联系管理员'
    });
  }

  // 生成简单 session token
  const token = crypto.randomBytes(32).toString('hex');

  res.json({
    error: false,
    dev_id,
    name: entry.name,
    status: entry.status,
    token
  });
});

module.exports = router;
