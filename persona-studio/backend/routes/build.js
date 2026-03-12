/**
 * persona-studio · 开发任务路由
 * POST /api/ps/build/start  触发代码生成
 */
const express = require('express');
const router = express.Router();
const memoryManager = require('../brain/memory-manager');
const codeGenerator = require('../brain/code-generator');
const emailSender = require('../utils/email-sender');

// 邮箱后端正则二次校验
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// POST /api/ps/build/start
router.post('/start', async (req, res) => {
  const { dev_id, email, contact, conversation } = req.body || {};

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

  // 后端二次邮箱校验
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_EMAIL',
      message: '邮箱格式不正确'
    });
  }

  // 联系方式输入清理（去除潜在 HTML/script 注入）
  const safeContact = contact ? String(contact).replace(/[<>&"']/g, '').substring(0, 100) : null;

  // 先立即响应，后台异步处理
  res.json({
    error: false,
    message: '开发任务已接收，完成后将发送到 ' + email,
    status: 'queued'
  });

  // 异步执行代码生成 + 邮件通知
  (async () => {
    const broadcast = req.app.locals.broadcastToClient || function () {};

    try {
      broadcast(dev_id, {
        type: 'progress',
        message: '🔧 正在创建项目骨架...',
        status: 'building',
        status_text: '构建中'
      });

      const result = await codeGenerator.generate({
        dev_id,
        conversation: conversation || [],
      });

      // 记录项目
      memoryManager.addProject(dev_id, {
        name: result.projectName || 'untitled',
        email: email,
        contact: safeContact,
        status: 'completed',
        created_at: new Date().toISOString(),
        files: result.files || []
      });

      // 自动提取知识
      memoryManager.autoExtractKnowledge(dev_id, conversation, result.projectName);

      // 通知预览就绪
      broadcast(dev_id, {
        type: 'preview_ready',
        project: result.projectName,
        message: '✅ 预览已就绪'
      });

      broadcast(dev_id, {
        type: 'complete',
        message: '🎉 全部完成！邮件正在发送'
      });

      // 发邮件
      await emailSender.sendCompletion({
        to: email,
        dev_id,
        projectName: result.projectName,
        summary: result.summary,
        files: result.files
      });
    } catch (err) {
      console.error('Build pipeline error:', err.message);
      broadcast(dev_id, {
        type: 'error',
        message: '构建过程出错: ' + err.message
      });
    }
  })();
});

module.exports = router;
