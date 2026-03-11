// backend/routes/feishu-bot.js
// 铸渊 · 飞书机器人事件回调处理
//
// SYSLOG 回传桥：开发者发 SYSLOG → 飞书机器人 → GitHub repository_dispatch
//
// 飞书事件订阅：im.message.receive_v1
// 部署：集成到现有 M-BRIDGE 后端服务
//
// 环境变量：
//   FEISHU_APP_ID          飞书应用 App ID
//   FEISHU_APP_SECRET      飞书应用 App Secret
//   GITHUB_TOKEN           GitHub Token（需要 repo scope）
//   FEISHU_VERIFICATION_TOKEN  飞书事件验证 Token（可选，用于安全校验）

'use strict';

const express = require('express');
const https   = require('https');
const router  = express.Router();

const FEISHU_APP_ID     = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const GITHUB_TOKEN      = process.env.GITHUB_TOKEN;
const VERIFICATION_TOKEN = process.env.FEISHU_VERIFICATION_TOKEN;

const GITHUB_REPO_OWNER = 'qinfendebingshuo';
const GITHUB_REPO_NAME  = 'guanghulab';

const VALID_PROTOCOL_VERSIONS = ['4.0', 'v4.0', '4.0.0'];

// ══════════════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════════════

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      options.headers = options.headers || {};
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getFeishuToken() {
  const result = await httpsRequest({
    hostname: 'open.feishu.cn',
    port: 443,
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET });
  return result.data.tenant_access_token;
}

async function replyFeishuMessage(token, messageId, content) {
  return httpsRequest({
    hostname: 'open.feishu.cn',
    port: 443,
    path: '/open-apis/im/v1/messages/' + messageId + '/reply',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  }, {
    msg_type: 'text',
    content: JSON.stringify({ text: content }),
  });
}

async function triggerGitHubDispatch(syslog) {
  return httpsRequest({
    hostname: 'api.github.com',
    port: 443,
    path: '/repos/' + GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME + '/dispatches',
    method: 'POST',
    headers: {
      'Authorization': 'token ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'guanghulab-feishu-bot',
      'Content-Type': 'application/json',
    },
  }, {
    event_type: 'receive-syslog',
    client_payload: {
      syslog: syslog,
      dev_id: syslog.dev_id || syslog.developer_id || 'UNKNOWN',
      broadcast_id: syslog.broadcast_id || syslog.broadcastId || 'UNKNOWN',
    },
  });
}

// ══════════════════════════════════════════════════════════
// SYSLOG 提取与验证
// ══════════════════════════════════════════════════════════

function extractSyslogFromMessage(text) {
  // 尝试从消息中提取 JSON
  // 支持：纯 JSON、代码块包裹的 JSON、混合文本中的 JSON
  if (!text || typeof text !== 'string') return null;

  // 1. 尝试直接解析整个文本
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed === 'object' && parsed.protocol_version) {
      return parsed;
    }
  } catch (e) { /* not pure JSON */ }

  // 2. 尝试提取代码块中的 JSON
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed && typeof parsed === 'object' && parsed.protocol_version) {
        return parsed;
      }
    } catch (e) { /* not valid JSON in code block */ }
  }

  // 3. 尝试提取大括号包裹的 JSON
  const jsonMatch = text.match(/\{[\s\S]*"protocol_version"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) { /* not valid JSON */ }
  }

  return null;
}

function validateSyslog(syslog) {
  if (!syslog || typeof syslog !== 'object') {
    return '无效的 SYSLOG 数据';
  }
  if (!syslog.protocol_version) {
    return '缺少 protocol_version 字段';
  }
  if (!VALID_PROTOCOL_VERSIONS.includes(String(syslog.protocol_version))) {
    return 'protocol_version 不合法: ' + syslog.protocol_version + '（需要 v4.0）';
  }
  if (!syslog.dev_id && !syslog.developer_id) {
    return '缺少 dev_id 或 developer_id 字段';
  }
  return null; // 验证通过
}

// ══════════════════════════════════════════════════════════
// 路由处理
// ══════════════════════════════════════════════════════════

// 飞书事件回调 URL 验证（首次配置时飞书会发送 challenge）
router.post('/event', async (req, res) => {
  const body = req.body;

  // 1. URL 验证（飞书首次配置事件订阅时会发送）
  if (body.challenge) {
    return res.json({ challenge: body.challenge });
  }

  // 2. 验证 token（如果配置了 VERIFICATION_TOKEN）
  if (VERIFICATION_TOKEN && body.token && body.token !== VERIFICATION_TOKEN) {
    return res.status(403).json({ error: true, message: '验证 token 不匹配' });
  }

  // 3. 飞书 v2 事件格式
  const header = body.header || {};
  const event = body.event || {};

  // 处理 im.message.receive_v1 事件
  if (header.event_type === 'im.message.receive_v1') {
    // 立即响应飞书（避免超时重发）
    res.json({ code: 0 });

    // 异步处理消息
    processMessage(event).catch(err => {
      console.error('❌ 消息处理失败:', err.message);
    });
    return;
  }

  // 其他事件类型
  res.json({ code: 0, message: 'event received' });
});

async function processMessage(event) {
  const message = event.message || {};
  const messageId = message.message_id;
  const msgType = message.message_type;

  // 只处理文本消息
  if (msgType !== 'text') return;

  let textContent = '';
  try {
    const content = JSON.parse(message.content || '{}');
    textContent = content.text || '';
  } catch (e) {
    return;
  }

  // 提取 SYSLOG
  const syslog = extractSyslogFromMessage(textContent);
  if (!syslog) return; // 不是 SYSLOG 消息，忽略

  // 验证 SYSLOG
  const validationError = validateSyslog(syslog);

  // 获取飞书 token 用于回复
  let feishuToken;
  try {
    feishuToken = await getFeishuToken();
  } catch (e) {
    console.error('❌ 获取飞书 token 失败:', e.message);
    return;
  }

  if (validationError) {
    await replyFeishuMessage(feishuToken, messageId,
      '❌ SYSLOG 验证失败: ' + validationError + '\n\n请检查 JSON 格式后重新发送。');
    return;
  }

  // 触发 GitHub repository_dispatch
  if (!GITHUB_TOKEN) {
    await replyFeishuMessage(feishuToken, messageId,
      '⚠️ 系统配置缺失 (GITHUB_TOKEN)，请联系管理员。');
    return;
  }

  try {
    const result = await triggerGitHubDispatch(syslog);
    if (result.statusCode === 204 || result.statusCode === 200) {
      const devId = syslog.dev_id || syslog.developer_id;
      const broadcastId = syslog.broadcast_id || syslog.broadcastId || '无';
      await replyFeishuMessage(feishuToken, messageId,
        '✅ SYSLOG 已收到，正在回传系统\n\n' +
        '📋 开发者: ' + devId + '\n' +
        '📡 广播编号: ' + broadcastId + '\n' +
        '🔄 GitHub Action 已触发，Notion 工单将自动创建');
    } else {
      await replyFeishuMessage(feishuToken, messageId,
        '⚠️ GitHub dispatch 触发异常 (HTTP ' + result.statusCode + ')，请稍后重试。');
    }
  } catch (e) {
    await replyFeishuMessage(feishuToken, messageId,
      '❌ SYSLOG 回传失败: ' + e.message + '\n\n请稍后重试或联系管理员。');
  }
}

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'feishu-bot-syslog-bridge',
    github_token_configured: !!GITHUB_TOKEN,
    feishu_app_configured: !!(FEISHU_APP_ID && FEISHU_APP_SECRET),
    verification_token_configured: !!VERIFICATION_TOKEN,
  });
});

module.exports = router;
