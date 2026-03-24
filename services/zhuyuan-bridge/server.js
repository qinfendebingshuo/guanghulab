/**
 * services/zhuyuan-bridge/server.js
 *
 * 铸渊桥接服务 — Webhook Server（可选增强）
 *
 * 功能：
 *   - 接收 GitHub App Webhook 事件
 *   - 健康检查端点
 *   - 实时响应（不经过 Issue 中转）
 *
 * 部署：
 *   pm2 start server.js --name zhuyuan-bridge
 *
 * 环境变量：
 *   GHAPP_WEBHOOK_SECRET  — GitHub App Webhook Secret
 *   PORT                  — 服务端口（默认 3800）
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3800;

// ===== Webhook 签名验证 =====
function verifySignature(payload, signature) {
  if (!signature || !process.env.GHAPP_WEBHOOK_SECRET) return false;
  const hmac = crypto.createHmac('sha256', process.env.GHAPP_WEBHOOK_SECRET);
  hmac.update(payload);
  const expected = 'sha256=' + hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

// 解析 JSON body，但保留原始 buffer 供签名验证
app.use(function(req, res, next) {
  let rawBody = '';
  req.on('data', function(chunk) { rawBody += chunk; });
  req.on('end', function() {
    req.rawBody = rawBody;
    try {
      req.body = JSON.parse(rawBody);
    } catch (_) {
      req.body = {};
    }
    next();
  });
});

// ===== 简易速率限制 =====
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  next();
}

// ===== 健康检查 =====
app.get('/health', function(req, res) {
  res.json({
    status: 'alive',
    agent: 'zhuyuan-bridge',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ===== GitHub App Webhook 入口 =====
app.post('/webhook/github-app', rateLimit, function(req, res) {
  const event = req.headers['x-github-event'];
  const sig = req.headers['x-hub-signature-256'];

  // 签名验证（如果配置了 secret）
  if (process.env.GHAPP_WEBHOOK_SECRET) {
    if (!verifySignature(req.rawBody, sig)) {
      console.warn('[铸渊桥接] ⚠️ Webhook 签名验证失败');
      res.status(401).json({ error: 'Signature mismatch' });
      return;
    }
  }

  console.log('[铸渊桥接] 收到事件:', event);

  // 立即响应 200（避免 GitHub 超时）
  res.status(200).json({ received: true, event: event });

  // 异步处理事件
  handleWebhookEvent(event, req.body).catch(function(err) {
    console.error('[铸渊桥接] 事件处理失败:', err.message);
  });
});

/**
 * 处理 Webhook 事件
 */
async function handleWebhookEvent(event, payload) {
  switch (event) {
    case 'issues':
      if (payload.action === 'opened' || payload.action === 'labeled') {
        const labels = (payload.issue.labels || []).map(function(l) { return l.name; });
        if (labels.includes('zhuyuan-exec')) {
          console.log('[铸渊桥接] 检测到执行指令 Issue #' + payload.issue.number);
          // 在 Webhook 模式下，可以直接启动执行
          // 但默认推荐通过 Workflow 执行（更安全、有日志）
          console.log('[铸渊桥接] 由 GitHub Actions Workflow 处理执行');
        }
      }
      break;

    case 'push':
      console.log('[铸渊桥接] Push 事件 → ' + (payload.ref || ''));
      break;

    case 'pull_request':
      console.log('[铸渊桥接] PR 事件 → #' + (payload.pull_request ? payload.pull_request.number : '?'));
      break;

    default:
      console.log('[铸渊桥接] 未处理的事件类型:', event);
  }
}

// ===== 启动服务 =====
app.listen(PORT, function() {
  console.log('[铸渊桥接] 🚀 启动在端口 ' + PORT);
  console.log('[铸渊桥接] 健康检查: http://localhost:' + PORT + '/health');
  console.log('[铸渊桥接] Webhook: http://localhost:' + PORT + '/webhook/github-app');
});
