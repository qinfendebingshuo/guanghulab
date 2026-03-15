/**
 * persona-studio · 开发任务路由
 * POST /api/ps/build/start  触发铸渊代理开发工作流
 *
 * 当用户点击「我要开发」时，自动触发铸渊代理（Agent）
 * 使用用户自带的 API Key 进行 5 步自动化开发。
 */
const express = require('express');
const router = express.Router();
const memoryManager = require('../brain/memory-manager');
const agentWorkflow = require('../brain/agent-workflow');
const emailSender = require('../utils/email-sender');

// 邮箱后端正则二次校验
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// 支持 EXP-XXX 和 GUEST 两种 dev_id 格式
function isValidDevId(devId) {
  return devId === 'GUEST' || /^EXP-\d{3,}$/.test(devId);
}

// POST /api/ps/build/start
router.post('/start', async (req, res) => {
  const { dev_id, email, contact, conversation, api_base, api_key, model } = req.body || {};

  if (!dev_id || !isValidDevId(dev_id)) {
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

  // 防止 header injection：API Key 不得包含换行符
  if (api_key && /[\r\n]/.test(api_key)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_API_KEY',
      message: 'API Key 格式无效'
    });
  }

  // 联系方式输入清理（去除潜在 HTML/script 注入）
  const safeContact = contact ? String(contact).replace(/[<>&"']/g, '').substring(0, 100) : null;

  // 先立即响应，后台异步处理
  res.json({
    error: false,
    message: '铸渊代理已启动，完成后将发送到 ' + email,
    status: 'agent_started'
  });

  // 异步执行铸渊代理开发工作流
  (async () => {
    const broadcastRaw = req.app.locals.broadcastToClient || function () {};
    const broadcast = function (data) { broadcastRaw(dev_id, data); };

    try {
      // 启动 Agent 工作流
      broadcast({
        type: 'progress',
        message: '🌀 铸渊代理已唤醒，正在启动开发工作流...',
        status: 'building',
        status_text: '代理已启动'
      });

      const result = await agentWorkflow.runWorkflow({
        dev_id: dev_id,
        conversation: conversation || [],
        api_base: api_base || '',
        api_key: api_key || '',
        model: model || '',
        broadcast: broadcast
      });

      // 记录项目（GUEST 也记录，方便追踪）
      try {
        memoryManager.addProject(dev_id, {
          name: result.projectName || 'untitled',
          email: email,
          contact: safeContact,
          status: 'completed',
          created_at: new Date().toISOString(),
          files: result.files || []
        });

        // 自动提取知识（仅注册开发者）
        if (dev_id !== 'GUEST') {
          memoryManager.autoExtractKnowledge(dev_id, conversation, result.projectName);
        }
      } catch (memErr) {
        console.error('Memory save error (non-fatal):', memErr.message);
      }

      // 通知预览就绪
      broadcast({
        type: 'preview_ready',
        project: result.projectName,
        message: '✅ 预览已就绪'
      });

      broadcast({
        type: 'complete',
        message: '🎉 全部完成！邮件正在发送'
      });

      // 发邮件（异步，不阻塞主流程）
      emailSender.sendCompletion({
        to: email,
        dev_id: dev_id,
        projectName: result.projectName,
        summary: result.summary,
        files: result.files
      }).catch(function (emailErr) {
        console.error('Email send error (non-fatal):', emailErr.message);
      });
    } catch (err) {
      console.error('Agent workflow error:', err.message);
      broadcast({
        type: 'error',
        message: '铸渊代理遇到问题: ' + err.message
      });
    }
  })();
});

module.exports = router;
