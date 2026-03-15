// src/routes/hli/auth/verify.js
// HLI-AUTH-003: Token 验证

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { token } = req.body;

    // TODO: 实现 token 验证逻辑

    res.json({
      hli_id: 'HLI-AUTH-003',
      valid: false,
      user_id: '',
      persona_id: '',
      expires_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'AUTH_VERIFY_ERROR', message: err.message });
  }
});

module.exports = router;
