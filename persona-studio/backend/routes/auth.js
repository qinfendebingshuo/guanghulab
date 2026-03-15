/**
 * persona-studio · 登录校验路由
 * POST /api/ps/auth/login  { dev_id: "EXP-000" }
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const HUMAN_REGISTRY_PATH = path.join(__dirname, '..', '..', 'brain', 'human-registry.json');
const REGISTRY_PATH = path.join(__dirname, '..', '..', 'brain', 'registry.json');

function loadHumanRegistry() {
  try {
    return JSON.parse(fs.readFileSync(HUMAN_REGISTRY_PATH, 'utf-8'));
  } catch {
    return { developers: [] };
  }
}

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch {
    return { developers: {}, guest_mode: {} };
  }
}

function findDeveloper(devId) {
  const humanReg = loadHumanRegistry();
  if (humanReg.developers && Array.isArray(humanReg.developers)) {
    const found = humanReg.developers.find(d => d.exp_id === devId);
    if (found) {
      return { name: found.name, status: found.status, role: found.role };
    }
  }

  const registry = loadRegistry();
  const entry = registry.developers && registry.developers[devId];
  if (entry) {
    return { name: entry.name, status: entry.status, role: entry.role };
  }

  return null;
}

// POST /api/ps/auth/login
router.post('/login', (req, res) => {
  const { dev_id } = req.body || {};

  // 访客体验模式
  if (dev_id === 'GUEST') {
    const registry = loadRegistry();
    const guestConfig = registry.guest_mode || {};

    if (!guestConfig.enabled) {
      return res.status(403).json({
        error: true,
        code: 'GUEST_DISABLED',
        message: '访客体验暂未开放，正式编号用户（EXP-XXX）可正常登录'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    return res.json({
      error: false,
      dev_id: 'GUEST',
      name: guestConfig.name || '访客体验者',
      status: 'guest',
      token
    });
  }

  if (!dev_id || !/^EXP-\d{3,}$/.test(dev_id)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_ID',
      message: '编号格式不正确，请使用 EXP-XXX 格式'
    });
  }

  const entry = findDeveloper(dev_id);

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
    role: entry.role,
    token
  });
});

module.exports = router;
