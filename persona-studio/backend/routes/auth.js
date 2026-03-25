/**
 * persona-studio · 登录校验路由
 * POST /api/ps/auth/login  { dev_id: "EXP-000" }
 * GET  /api/ps/auth/session { token }
 * POST /api/ps/auth/wechat/callback { code } — 微信登录回调（待配置）
 * POST /api/ps/auth/bind { openid, dev_id } — 绑定开发者编号（待配置）
 *
 * 📜 Copyright: 国作登字-2026-A-00037559
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const HUMAN_REGISTRY_PATH = path.join(__dirname, '..', '..', 'brain', 'human-registry.json');
const REGISTRY_PATH = path.join(__dirname, '..', '..', 'brain', 'registry.json');
const USERS_DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'users.json');

// In-memory session store (server restart clears sessions)
const sessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Periodic session cleanup (every hour)
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - new Date(session.created_at).getTime() > SESSION_TTL_MS) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

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

function loadUsersDB() {
  try {
    return JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
  } catch {
    return { users: {}, dev_id_map: {} };
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
    sessions.set(token, {
      dev_id: 'GUEST',
      name: guestConfig.name || '访客体验者',
      role: 'visitor',
      created_at: new Date().toISOString()
    });

    return res.json({
      error: false,
      dev_id: 'GUEST',
      name: guestConfig.name || '访客体验者',
      status: 'guest',
      role: 'visitor',
      token,
      auth_method: 'guest'
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

  // 生成 session token
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    dev_id,
    name: entry.name,
    role: entry.role || 'developer',
    created_at: new Date().toISOString()
  });

  res.json({
    error: false,
    dev_id,
    name: entry.name,
    status: entry.status,
    role: entry.role || 'developer',
    token,
    auth_method: 'dev_id'
  });
});

// GET /api/ps/auth/session — 验证 session token
router.get('/session', (req, res) => {
  const token = req.headers['x-session-token'] || req.query.token;

  if (!token) {
    return res.status(401).json({
      error: true,
      code: 'NO_TOKEN',
      message: '未提供 session token'
    });
  }

  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({
      error: true,
      code: 'INVALID_TOKEN',
      message: 'Session 已过期或无效'
    });
  }

  res.json({
    error: false,
    dev_id: session.dev_id,
    name: session.name,
    role: session.role
  });
});

// POST /api/ps/auth/wechat/callback — 微信登录回调（预留接口）
router.post('/wechat/callback', (req, res) => {
  // 微信登录需要冰朔提供 AppID/AppSecret 后才能启用
  // 当前返回提示信息
  res.status(501).json({
    error: true,
    code: 'WECHAT_NOT_CONFIGURED',
    message: '微信登录尚未配置。需要冰朔提供微信开放平台 AppID/AppSecret。当前请使用开发者编号登录。'
  });
});

// POST /api/ps/auth/bind — 绑定微信 openid 和开发者编号（预留接口）
router.post('/bind', (req, res) => {
  res.status(501).json({
    error: true,
    code: 'BIND_NOT_CONFIGURED',
    message: '绑定功能尚未启用。需要先完成微信登录配置。'
  });
});

// GET /api/ps/auth/methods — 获取可用登录方式
router.get('/methods', (_req, res) => {
  const usersDB = loadUsersDB();
  const methods = usersDB.auth_methods || {
    dev_id: { enabled: true },
    guest: { enabled: true },
    wechat: { enabled: false }
  };

  res.json({
    error: false,
    methods: {
      dev_id: { enabled: methods.dev_id ? methods.dev_id.enabled : true },
      guest: { enabled: methods.guest ? methods.guest.enabled : true },
      wechat: { enabled: methods.wechat ? methods.wechat.enabled : false }
    }
  });
});

module.exports = router;
