/**
 * GitHub Webhook 监听器
 * 工单编号: GH-GMP-004
 * 开发者: 培园A04 (5TH-LE-HK-A04)
 * 职责: 接收GitHub push/PR事件 · 验证签名 · 触发模块自动部署
 */

const crypto = require('crypto');
const express = require('express');
const { createLogger } = require('./lib/logger');

const logger = createLogger('webhook');

// ─── 速率限制 (纯Map实现, 不引入新依赖) ──────────────────
// 策略: 同一IP在 60秒窗口内最多 30 次请求, 超出返回 429
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
// IP -> 时间戳数组 (滑动窗口)
const rateLimitStore = new Map();

/**
 * 提取客户端IP (兼容直连 / 反向代理后的 X-Forwarded-For)
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * 速率限制中间件
 */
function rateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = rateLimitStore.get(ip) || [];
  // 丢弃窗口外的旧请求
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
    logger.warn('[Webhook] 速率限制触发 ip=' + ip + ' count=' + timestamps.length);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: '请求过于频繁, 请稍后再试',
      retryAfter: retryAfter
    });
  }

  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);

  // 周期性清理冷IP (避免Map无限增长)
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore) {
      const fresh = v.filter(t => t > windowStart);
      if (fresh.length === 0) {
        rateLimitStore.delete(k);
      } else {
        rateLimitStore.set(k, fresh);
      }
    }
  }

  next();
}

/**
 * 验证GitHub Webhook签名 (HMAC SHA-256)
 */
function verifySignature(secret, payload, signature) {
  if (!secret || !signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch (err) {
    return false;
  }
}

/**
 * 解析push事件中变更的模块目录
 * 约定: guanghu-self-hosted/<module-name>/ 下的变更触发该模块重新部署
 */
function extractChangedModules(commits) {
  const modules = new Set();
  for (const commit of commits || []) {
    const allFiles = []
      .concat(commit.added || [])
      .concat(commit.modified || [])
      .concat(commit.removed || []);

    for (const file of allFiles) {
      // 匹配 guanghu-self-hosted/<module-name>/... 路径
      const match = file.match(/^guanghu-self-hosted\/([^\/]+)\//);
      if (match) {
        modules.add(match[1]);
      }
    }
  }
  return Array.from(modules);
}

/**
 * 创建Webhook路由
 * @param {GMPAgent} agent - GMP-Agent实例引用
 */
function createWebhookRouter(agent) {
  const router = express.Router();

  // 需要原始body来验证签名
  router.use(express.raw({ type: 'application/json', limit: '10mb' }));

  /**
   * POST /webhook/github
   * 接收GitHub Webhook事件
   */
  router.post('/github', rateLimiter, async (req, res) => {
    const event = req.headers['x-github-event'];
    const delivery = req.headers['x-github-delivery'];
    const signature = req.headers['x-hub-signature-256'];

    logger.info('[Webhook] 收到事件: ' + event + ' delivery=' + (delivery || 'N/A'));

    // 签名验证
    const secret = agent.config.webhookSecret;
    // express.raw 将 req.body 设为 Buffer
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = Buffer.from(req.body, 'utf-8');
    } else {
      rawBody = Buffer.from(JSON.stringify(req.body), 'utf-8');
    }

    if (secret) {
      if (!verifySignature(secret, rawBody, signature)) {
        logger.warn('[Webhook] 签名验证失败, 拒绝请求');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // 解析payload
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf-8'));
    } catch (err) {
      logger.error('[Webhook] payload解析失败: ' + err.message);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // 先响应200, 后台处理
    res.json({ received: true, event: event, delivery: delivery });

    // 异步处理事件
    try {
      await handleEvent(agent, event, payload);
    } catch (err) {
      logger.error('[Webhook] 事件处理失败: ' + err.message);
    }
  });

  // Webhook状态
  router.get('/status', (req, res) => {
    res.json({
      webhookEnabled: true,
      secretConfigured: !!agent.config.webhookSecret,
      endpoint: '/webhook/github'
    });
  });

  return router;
}

/**
 * 处理GitHub事件
 */
async function handleEvent(agent, event, payload) {
  switch (event) {
    case 'push':
      await handlePushEvent(agent, payload);
      break;

    case 'pull_request':
      await handlePullRequestEvent(agent, payload);
      break;

    case 'ping':
      logger.info('[Webhook] Ping事件: ' + (payload.zen || ''));
      break;

    default:
      logger.info('[Webhook] 忽略事件类型: ' + event);
  }
}

/**
 * 处理push事件 → 自动部署变更的模块
 */
async function handlePushEvent(agent, payload) {
  const ref = payload.ref || '';
  const branch = ref.replace('refs/heads/', '');
  const repo = (payload.repository && payload.repository.full_name) || 'unknown';
  const pusher = (payload.pusher && payload.pusher.name) || 'unknown';

  logger.info('[Webhook] Push事件: ' + repo + ' 分支=' + branch + ' 推送者=' + pusher);

  // 只处理main分支的push (或配置的目标分支)
  const targetBranch = agent.config.targetBranch || 'main';
  if (branch !== targetBranch) {
    logger.info('[Webhook] 忽略非目标分支: ' + branch + ' (目标=' + targetBranch + ')');
    return;
  }

  // 提取变更的模块
  const changedModules = extractChangedModules(payload.commits);
  if (changedModules.length === 0) {
    logger.info('[Webhook] 无模块目录变更, 跳过部署');
    return;
  }

  logger.info('[Webhook] 检测到 ' + changedModules.length + ' 个模块变更: ' + changedModules.join(', '));

  // 逐个触发安装/更新
  for (const moduleName of changedModules) {
    try {
      logger.info('[Webhook] 开始自动部署模块: ' + moduleName);
      const result = await agent.installer.install({
        repoUrl: (payload.repository && payload.repository.clone_url) || '',
        moduleName: moduleName,
        branch: targetBranch,
        autoTriggered: true
      });
      logger.info('[Webhook] 模块部署完成: ' + moduleName + ' -> ' + result.status);
    } catch (err) {
      logger.error('[Webhook] 模块部署失败: ' + moduleName + ' -> ' + err.message);
    }
  }
}

/**
 * 处理pull_request事件 (记录日志, 后续可扩展为自动审查)
 */
async function handlePullRequestEvent(agent, payload) {
  const action = payload.action || 'unknown';
  const prNumber = (payload.pull_request && payload.pull_request.number) || 'N/A';
  const prTitle = (payload.pull_request && payload.pull_request.title) || 'N/A';
  const prUser = (payload.pull_request && payload.pull_request.user && payload.pull_request.user.login) || 'unknown';

  logger.info('[Webhook] PR事件: #' + prNumber + ' ' + action + ' by ' + prUser + ' - ' + prTitle);

  // PR合并到目标分支时也可触发部署 (留作扩展)
  if (action === 'closed' && payload.pull_request && payload.pull_request.merged) {
    logger.info('[Webhook] PR已合并, 等待push事件触发部署');
  }
}

module.exports = createWebhookRouter;
