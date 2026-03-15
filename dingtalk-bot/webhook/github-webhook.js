// GitHub Webhook 接收器 · github-webhook.js
// HoloLake · M-DINGTALK Phase 3
// DEV-004 之之 × 秋秋
//

const crypto = require('crypto');

// Webhook密钥（后续从GitHub Settings配置，现在用模拟值）
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'hololake-webhook-secret-2026';

// 事件处理器注册表
const eventHandlers = {};

/**
 * 验证GitHub Webhook签名
 * GitHub发来的每个请求都有签名，防止伪造
 */
function verifySignature(payload, signature) {
  if (!signature) {
    console.log('[Webhook] ⚠️ 请求没有签名，跳过验证（开发模式）');
    return true; // 开发模式下允许无签名
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (e) {
    return false;
  }
}

/**
 * 注册事件处理器
 * @param {string} eventType - GitHub事件类型 (push/pull_request等)
 * @param {Function} handler - 处理函数
 */
function on(eventType, handler) {
  if (!eventHandlers[eventType]) {
    eventHandlers[eventType] = [];
  }
  eventHandlers[eventType].push(handler);
  console.log(`[Webhook] 注册事件处理器: ${eventType}`);
}

/**
 * 处理收到的Webhook请求
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
async function handleWebhook(req, res) {
  const event = req.headers['x-github-event'];
  const delivery = req.headers['x-github-delivery'];
  const signature = req.headers['x-hub-signature-256'];

  console.log('\n[Webhook] ====================');
  console.log(`[Webhook] 收到GitHub事件：${event}`);
  console.log(`[Webhook] Delivery ID: ${delivery}`);
  console.log(`[Webhook] 时间：${new Date().toLocaleString('zh-CN')}`);

  // 验证签名
  const payload = JSON.stringify(req.body);
  if (!verifySignature(payload, signature)) {
    console.log('[Webhook] ❌ 签名验证失败！可能是伪造请求');
    return res.status(401).json({ error: '签名验证失败' });
  }

  // 记录事件日志
  const eventLog = {
    event,
    delivery,
    timestamp: new Date().toISOString(),
    sender: req.body.sender ? req.body.sender.login : 'unknown',
    repository: req.body.repository ? req.body.repository.full_name : 'unknown'
  };

  // 特殊处理push事件
  if (event === 'push') {
    eventLog.branch = req.body.ref;
    eventLog.commits = (req.body.commits || []).length;
    eventLog.changedFiles = [];

    // 收集所有变更文件
    for (const commit of (req.body.commits || [])) {
      eventLog.changedFiles.push(...(commit.added || []));
      eventLog.changedFiles.push(...(commit.modified || []));
    }
    eventLog.changedFiles = [...new Set(eventLog.changedFiles)];

    console.log(`[Webhook] 分支：${eventLog.branch}`);
    console.log(`[Webhook] 提交数：${eventLog.commits}`);
    console.log(`[Webhook] 变更文件：${eventLog.changedFiles.join(', ')}`);
  }

  // 调用注册的事件处理器
  const handlers = eventHandlers[event] || [];
  console.log(`[Webhook] 匹配到 ${handlers.length} 个处理器`);

  for (const handler of handlers) {
    try {
      await handler(req.body, eventLog);
    } catch (err) {
      console.error('[Webhook] 处理器执行错误：', err.message);
    }
  }

  // 也调用通配符处理器
  const wildcardHandlers = eventHandlers['*'] || [];
  for (const handler of wildcardHandlers) {
    try {
      await handler(req.body, eventLog);
    } catch (err) {
      console.error('[Webhook] 通配符处理器错误：', err.message);
    }
  }

  console.log('[Webhook] 事件处理完成 ✅');
  res.status(200).json({ status: 'ok', event, delivery });
}

/**
 * 创建模拟的GitHub push事件（用于测试）
 */
function createMockPushEvent(branch, files) {
  return {
    ref: `refs/heads/${branch || 'main'}`,
    repository: {
      full_name: 'qinfendebingshuo/guanghulab'
    },
    sender: {
      login: 'test-user'
    },
    commits: [
      {
        message: '测试提交',
        added: files || ['test-file.js'],
        modified: [],
        removed: []
      }
    ]
  };
}

module.exports = {
  verifySignature,
  on,
  handleWebhook,
  createMockPushEvent
};
