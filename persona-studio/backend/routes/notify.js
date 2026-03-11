/**
 * persona-studio · 邮件推送路由
 * POST /api/ps/notify/send  手动触发邮件
 */
const express = require('express');
const router = express.Router();
const emailSender = require('../utils/email-sender');

// POST /api/ps/notify/send
router.post('/send', async (req, res) => {
  const { to, subject, body } = req.body || {};

  if (!to || !subject) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_FIELDS',
      message: '缺少必要字段：to, subject'
    });
  }

  try {
    await emailSender.send({ to, subject, body: body || '' });
    res.json({ error: false, message: '邮件已发送' });
  } catch (err) {
    console.error('Notify error:', err.message);
    res.status(500).json({
      error: true,
      code: 'SEND_FAILED',
      message: '邮件发送失败'
    });
  }
});

module.exports = router;
