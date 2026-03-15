// backend/routes/feishu-bot.js
// 铸渊 · 飞书机器人事件回调处理
//
// Phase 1-3: SYSLOG 回传桥（开发者发 SYSLOG → GitHub → Notion）
// Phase 4A:  AI 对话引擎（霜砚/人格体上线飞书）
// Phase 4C:  协作数据采集（对话记录 → collaboration-logs/）
//
// 飞书事件订阅：im.message.receive_v1
// 部署：集成到现有 M-BRIDGE 后端服务
//
// 环境变量：
//   FEISHU_APP_ID              飞书应用 App ID
//   FEISHU_APP_SECRET          飞书应用 App Secret
//   GITHUB_TOKEN               GitHub Token（需要 repo scope）
//   FEISHU_VERIFICATION_TOKEN  飞书事件验证 Token（可选）
//   MODEL_API_KEY              AI 模型 API Key（Phase 4A）
//   MODEL_API_BASE             AI 模型 API Base URL（Phase 4A）
//   MODEL_NAME                 AI 模型名称（Phase 4A）
//   FEISHU_ALERT_CHAT_ID       失败告警推送的飞书群 chat_id（Phase 4D）

'use strict';

const express = require('express');
const https   = require('https');
const router  = express.Router();

const aiChat             = require('../feishu-bot/ai-chat');
const contextManager     = require('../feishu-bot/context-manager');
const collaborationLogger = require('../feishu-bot/collaboration-logger');

const FEISHU_APP_ID      = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET  = process.env.FEISHU_APP_SECRET;
const GITHUB_TOKEN       = process.env.GITHUB_TOKEN;
const VERIFICATION_TOKEN = process.env.FEISHU_VERIFICATION_TOKEN;
const ALERT_CHAT_ID      = process.env.FEISHU_ALERT_CHAT_ID;

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'qinfendebingshuo';
const GITHUB_REPO_NAME  = process.env.GITHUB_REPO_NAME  || 'guanghulab';

const VALID_PROTOCOL_VERSIONS = ['4.0', 'v4.0', '4.0.0'];

// 已处理的事件 ID 去重（飞书可能重发事件）
const processedEvents = new Set();
const MAX_PROCESSED_EVENTS = 2000;

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
    req.setTimeout(60000, () => {
      req.destroy(new Error('Request timeout'));
    });
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

async function sendFeishuGroupMessage(token, chatId, text) {
  return httpsRequest({
    hostname: 'open.feishu.cn',
    port: 443,
    path: '/open-apis/im/v1/messages?receive_id_type=chat_id',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  }, {
    receive_id: chatId,
    msg_type: 'text',
    content: JSON.stringify({ text }),
  });
}

async function triggerGitHubDispatch(eventType, payload) {
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
    event_type: eventType,
    client_payload: payload,
  });
}

// ══════════════════════════════════════════════════════════
// 事件去重
// ══════════════════════════════════════════════════════════

function isEventProcessed(eventId) {
  if (!eventId) return false;
  if (processedEvents.has(eventId)) return true;

  // 清理过多的记录
  if (processedEvents.size >= MAX_PROCESSED_EVENTS) {
    const iterator = processedEvents.values();
    for (let i = 0; i < MAX_PROCESSED_EVENTS / 2; i++) {
      processedEvents.delete(iterator.next().value);
    }
  }

  processedEvents.add(eventId);
  return false;
}

// ══════════════════════════════════════════════════════════
// SYSLOG 提取与验证
// ══════════════════════════════════════════════════════════

function extractSyslogFromMessage(text) {
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
  return null;
}

// ══════════════════════════════════════════════════════════
// 路由处理
// ══════════════════════════════════════════════════════════

// 飞书事件回调 URL 验证 + 消息处理
router.post('/event', async (req, res) => {
  const body = req.body;

  // 1. URL 验证（飞书首次配置事件订阅时会发送）
  if (body.challenge) {
    return res.json({ challenge: body.challenge });
  }

  // 2. 验证 token
  if (VERIFICATION_TOKEN && body.token && body.token !== VERIFICATION_TOKEN) {
    return res.status(403).json({ error: true, message: '验证 token 不匹配' });
  }

  // 3. 飞书 v2 事件格式
  const header = body.header || {};
  const event = body.event || {};

  // 事件去重（飞书可能在超时后重发）
  if (isEventProcessed(header.event_id)) {
    return res.json({ code: 0, message: 'duplicate event' });
  }

  // 处理 im.message.receive_v1 事件
  if (header.event_type === 'im.message.receive_v1') {
    // 立即响应飞书（避免超时重发）
    res.json({ code: 0 });

    // 异步处理消息
    processMessage(event).catch(() => {});
    return;
  }

  res.json({ code: 0, message: 'event received' });
});

async function processMessage(event) {
  const message = event.message || {};
  const sender  = event.sender || {};
  const messageId = message.message_id;
  const msgType = message.message_type;
  const userId  = sender.sender_id?.open_id || sender.sender_id?.user_id || 'unknown';

  // 只处理文本消息
  if (msgType !== 'text') return;

  let textContent = '';
  try {
    const content = JSON.parse(message.content || '{}');
    textContent = content.text || '';
  } catch (e) {
    return;
  }

  if (!textContent.trim()) return;

  // 获取飞书 token 用于回复
  let feishuToken;
  try {
    feishuToken = await getFeishuToken();
  } catch (e) {
    return;
  }

  // ── 路由判断 ────────────────────────────────────────────
  // 1. 检查是否为 SYSLOG 回传
  const syslog = extractSyslogFromMessage(textContent);
  if (syslog) {
    await handleSyslogMessage(syslog, feishuToken, messageId);
    return;
  }

  // 2. 检查是否为特殊指令
  const trimmed = textContent.trim();
  if (trimmed === '/clear' || trimmed === '/reset') {
    contextManager.clearSession(userId);
    await replyFeishuMessage(feishuToken, messageId, '🔄 对话上下文已清除。');
    return;
  }
  if (trimmed === '/status') {
    const info = contextManager.getSessionInfo(userId);
    const stats = collaborationLogger.getStats();
    await replyFeishuMessage(feishuToken, messageId,
      '📊 会话状态\n' +
      '对话轮数: ' + info.totalRounds + '\n' +
      '当前通道: ' + (info.channel || '未开始') + '\n' +
      '空闲时间: ' + (info.idleMinutes || 0) + ' 分钟\n' +
      '协作日志: ' + stats.totalLogFiles + ' 个文件');
    return;
  }

  // 3. AI 对话（Phase 4A）
  await handleAIChatMessage(textContent, userId, feishuToken, messageId);
}

// ══════════════════════════════════════════════════════════
// SYSLOG 处理（Phase 1-3）
// ══════════════════════════════════════════════════════════

async function handleSyslogMessage(syslog, feishuToken, messageId) {
  const validationError = validateSyslog(syslog);
  if (validationError) {
    await replyFeishuMessage(feishuToken, messageId,
      '❌ SYSLOG 验证失败: ' + validationError + '\n\n请检查 JSON 格式后重新发送。');
    return;
  }

  if (!GITHUB_TOKEN) {
    await replyFeishuMessage(feishuToken, messageId,
      '⚠️ 系统配置缺失 (GITHUB_TOKEN)，请联系管理员。');
    return;
  }

  // Phase 4C: 记录 SYSLOG 协作数据
  collaborationLogger.logSyslogCollaboration(syslog);

  try {
    const result = await triggerGitHubDispatch('receive-syslog', {
      syslog: syslog,
      dev_id: syslog.dev_id || syslog.developer_id || 'UNKNOWN',
      broadcast_id: syslog.broadcast_id || syslog.broadcastId || 'UNKNOWN',
    });
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

// ══════════════════════════════════════════════════════════
// AI 对话处理（Phase 4A）
// ══════════════════════════════════════════════════════════

async function handleAIChatMessage(textContent, userId, feishuToken, messageId) {
  // 获取对话历史
  const history = contextManager.getHistory(userId);

  // 调用 AI 模型
  const { reply, channel } = await aiChat.chat(textContent, history, {
    loginEntryContent: null, // TODO: 从飞书文档A缓存中获取
  });

  // 更新上下文
  contextManager.addRound(userId, textContent, reply, channel);

  // Phase 4C: 记录协作数据
  collaborationLogger.logInteraction({
    userId,
    userMessage: textContent,
    assistantReply: reply,
    channel,
    personaId: channel === 'persona' ? 'ICE-GL-ZQ001' : 'ICE-GL-SY001',
  });

  // 回复用户
  await replyFeishuMessage(feishuToken, messageId, reply);
}

// ══════════════════════════════════════════════════════════
// 失败告警（Phase 4D）
// ══════════════════════════════════════════════════════════

/**
 * 发送失败告警到飞书群（供外部 workflow 调用）
 */
router.post('/alert', async (req, res) => {
  const { title, content, level } = req.body;
  if (!ALERT_CHAT_ID) {
    return res.status(400).json({ error: true, message: '未配置 FEISHU_ALERT_CHAT_ID' });
  }

  try {
    const feishuToken = await getFeishuToken();
    const emoji = level === 'error' ? '🔴' : level === 'warning' ? '🟡' : 'ℹ️';
    const text = emoji + ' ' + (title || '系统告警') + '\n\n' + (content || '无详细信息');
    await sendFeishuGroupMessage(feishuToken, ALERT_CHAT_ID, text);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: true, message: e.message });
  }
});

// ══════════════════════════════════════════════════════════
// 广播推送（Pipeline C 调用）
// ══════════════════════════════════════════════════════════

/**
 * 接收 Pipeline C 的广播推送请求，转发到飞书聊天窗口
 * POST /push-broadcast (通过 server.js 映射到 /webhook/push-broadcast)
 */
router.post('/push-broadcast', async (req, res) => {
  // 1. 验证 token
  const token = req.headers['x-push-token'];
  if (!process.env.PUSH_BROADCAST_TOKEN || token !== process.env.PUSH_BROADCAST_TOKEN) {
    return res.status(401).json({ error: true, code: 'INVALID_TOKEN', message: 'Invalid push token' });
  }

  // 2. 解析请求体
  const { chat_id, sender_open_id, broadcast_title, broadcast_content, broadcast_url } = req.body;

  if (!broadcast_content && !broadcast_title) {
    return res.status(400).json({ error: true, code: 'MISSING_CONTENT', message: 'Missing broadcast_title or broadcast_content' });
  }

  const receive_id = chat_id || sender_open_id;
  if (!receive_id) {
    return res.status(400).json({ error: true, code: 'MISSING_TARGET', message: 'Missing chat_id or sender_open_id' });
  }

  try {
    // 3. 获取飞书 token
    const feishuToken = await getFeishuToken();

    // 4. 构造消息文本
    const urlLine = broadcast_url ? '\n🔗 ' + broadcast_url : '';
    const text = '📡 新广播 ' + (broadcast_title || '') + '\n\n' + (broadcast_content || '') + urlLine;

    // 5. 发送飞书消息（优先 chat_id，备选 open_id）
    const receive_id_type = chat_id ? 'chat_id' : 'open_id';
    const msgResult = await httpsRequest({
      hostname: 'open.feishu.cn',
      port: 443,
      path: '/open-apis/im/v1/messages?receive_id_type=' + receive_id_type,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + feishuToken,
        'Content-Type': 'application/json',
      },
    }, {
      receive_id: receive_id,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    });

    if (msgResult.data && msgResult.data.code === 0) {
      console.log('✅ 广播推送成功: ' + broadcast_title + ' → ' + receive_id);
      res.json({ success: true, message_id: msgResult.data.data && msgResult.data.data.message_id });
    } else {
      console.error('❌ 飞书发送失败:', JSON.stringify(msgResult.data));
      res.status(500).json({ error: true, code: 'FEISHU_API_ERROR', message: (msgResult.data && msgResult.data.msg) || 'Feishu API error' });
    }
  } catch (err) {
    console.error('❌ push-broadcast error:', err.message);
    res.status(500).json({ error: true, code: 'PUSH_ERROR', message: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// 健康检查 + 统计
// ══════════════════════════════════════════════════════════

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'feishu-bot-syslog-bridge',
    version: '2.0.0',
    features: {
      syslog_bridge: true,
      ai_chat: !!process.env.MODEL_API_KEY,
      collaboration_logging: true,
      failure_alerting: !!ALERT_CHAT_ID,
      push_broadcast: !!process.env.PUSH_BROADCAST_TOKEN,
    },
    github_token_configured: !!GITHUB_TOKEN,
    feishu_app_configured: !!(FEISHU_APP_ID && FEISHU_APP_SECRET),
    verification_token_configured: !!VERIFICATION_TOKEN,
    model_api_configured: !!process.env.MODEL_API_KEY,
    context_stats: contextManager.getStats(),
    collaboration_stats: collaborationLogger.getStats(),
  });
});

// 导出协作数据（对齐 persona-brain-db 格式）
router.get('/collaboration-export', (req, res) => {
  const data = collaborationLogger.exportForBrainDB();
  res.json({
    hli_id: 'HLI-FEISHU-COLLAB-EXPORT',
    ...data,
  });
});

module.exports = router;
