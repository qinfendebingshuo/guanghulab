// src/routes/hli/auth/register.js
// HLI-AUTH-002: 用户注册

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // TODO: 实现注册逻辑（检查重复，写入数据库）

    res.json({
      hli_id: 'HLI-AUTH-002',
      user_id: '',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'AUTH_REGISTER_ERROR', message: err.message });
  }
});

module.exports = router;
