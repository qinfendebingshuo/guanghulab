/**
 * persona-studio · 开发任务路由
 * POST /api/ps/build/start  触发代码生成
 */
const express = require('express');
const router = express.Router();
const memoryManager = require('../brain/memory-manager');
const codeGenerator = require('../brain/code-generator');
const emailSender = require('../utils/email-sender');

// POST /api/ps/build/start
router.post('/start', async (req, res) => {
  const { dev_id, email, conversation } = req.body || {};

  if (!dev_id || !/^EXP-\d{3,}$/.test(dev_id)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_ID',
      message: '无效的开发编号'
    });
  }

  if (!email) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_EMAIL',
      message: '请提供邮箱地址'
    });
  }

  // 先立即响应，后台异步处理
  res.json({
    error: false,
    message: '开发任务已接收，完成后将发送到 ' + email,
    status: 'queued'
  });

  // 异步执行代码生成 + 邮件通知
  (async () => {
    try {
      const result = await codeGenerator.generate({
        dev_id,
        conversation: conversation || [],
      });

      // 记录项目
      memoryManager.addProject(dev_id, {
        name: result.projectName || 'untitled',
        status: 'completed',
        created_at: new Date().toISOString(),
        files: result.files || []
      });

      // 发邮件
      await emailSender.sendCompletion({
        to: email,
        dev_id,
        projectName: result.projectName,
        summary: result.summary
      });
    } catch (err) {
      console.error('Build pipeline error:', err.message);
    }
  })();
});

module.exports = router;
