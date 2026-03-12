// src/routes/hli/auth/login.js
// HLI-AUTH-001: 用户登录

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;

    // TODO: 实现登录逻辑（查询数据库，验证密码，生成 token）

    res.json({
      hli_id: 'HLI-AUTH-001',
      token: '',
      user_id: '',
      persona_id: '',
      expires_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'AUTH_LOGIN_ERROR', message: err.message });
  }
});

module.exports = router;
