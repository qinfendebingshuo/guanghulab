'use strict';

/**
 * ═══════════════════════════════════════════════════════════
 * 🤝 三节点Agent联邦握手协议模块
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FED-HANDSHAKE-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   1. 管理网站Agent ↔ GitHub/Notion Agent之间的握手协议
 *   2. 维护联邦成员状态
 *   3. 处理消息路由和广播
 *
 * 协议:
 *   - 使用WebSocket实现实时通信
 *   - 消息格式遵循HLDP语言结构
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const { validateSession } = require('./email-auth');

// ─── 常量 ───
const FEDERATION_VERSION = '1.0';
const HEARTBEAT_INTERVAL = 30000; // 30秒
const RECONNECT_TIMEOUT = 5000;   // 5秒

// ─── 联邦成员状态 ───
const federationMembers = new Map(); // agentId → { ws, lastSeen, metadata }
const messageQueues = new Map();    // agentId → message[]

// ─── WebSocket 服务器 ───
let wss;

/**
 * 初始化联邦握手服务
 * @param {http.Server} server - HTTP服务器实例
 */
function initFederation(server) {
  wss = new WebSocket.Server({
    server,
    path: '/api/federation/ws',
    verifyClient: (info, cb) => {
      // 验证session token
      const token = info.req.headers['x-federation-token'];
      if (!token || !validateSession(token).valid) {
        return cb(false, 401, 'Unauthorized');
      }
      cb(true);
    }
  });

  wss.on('connection', handleConnection);
  wss.on('error', handleError);

  // 启动心跳检测
  setInterval(checkHeartbeats, HEARTBEAT_INTERVAL);
}

/**
 * 处理新连接
 * @param {WebSocket} ws - WebSocket连接
 * @param {http.IncomingMessage} req - HTTP请求
 */
function handleConnection(ws, req) {
  const token = req.headers['x-federation-token'];
  const session = validateSession(token);
  const agentId = generateAgentId(session.email);

  // 注册新成员
  federationMembers.set(agentId, {
    ws,
    lastSeen: Date.now(),
    metadata: {
      type: 'website', // 或 'github'/'notion'
      version: FEDERATION_VERSION,
      session: session.email
    }
  });

  ws.on('message', (data) => handleMessage(agentId, data));
  ws.on('close', () => handleDisconnect(agentId));
  ws.on('pong', () => updateHeartbeat(agentId));

  // 发送欢迎消息
  sendMessage(ws, {
    type: 'handshake',
    status: 'welcome',
    agentId,
    timestamp: Date.now()
  });

  console.log(`[Federation] 新成员连接: ${agentId}`);
}

/**
 * 处理消息
 * @param {string} agentId - 发送方ID
 * @param {string} data - 原始消息数据
 */
function handleMessage(agentId, data) {
  try {
    const message = JSON.parse(data);
    updateHeartbeat(agentId);

    switch (message.type) {
      case 'handshake':
        handleHandshake(agentId, message);
        break;
      case 'broadcast':
        handleBroadcast(agentId, message);
        break;
      case 'direct':
        handleDirectMessage(agentId, message);
        break;
      default:
        console.warn(`[Federation] 未知消息类型: ${message.type}`);
    }
  } catch (err) {
    console.error(`[Federation] 消息处理错误: ${err.message}`);
  }
}

/**
 * 处理握手消息
 * @param {string} agentId - 发送方ID
 * @param {object} message - 握手消息
 */
function handleHandshake(agentId, message) {
  const member = federationMembers.get(agentId);
  if (!member) return;

  if (message.status === 'ready') {
    member.metadata.type = message.agentType; // github/notion/website
    console.log(`[Federation] 握手完成: ${agentId} (${message.agentType})`);

    // 如果有排队消息，立即发送
    if (messageQueues.has(agentId)) {
      const queue = messageQueues.get(agentId);
      messageQueues.delete(agentId);
      queue.forEach(msg => sendMessage(member.ws, msg));
    }
  }
}

/**
 * 处理广播消息
 * @param {string} senderId - 发送方ID
 * @param {object} message - 广播消息
 */
function handleBroadcast(senderId, message) {
  federationMembers.forEach((member, agentId) => {
    if (agentId !== senderId) {
      sendMessage(member.ws, {
        type: 'broadcast',
        from: senderId,
        content: message.content,
        timestamp: Date.now()
      });
    }
  });
}

/**
 * 处理直接消息
 * @param {string} senderId - 发送方ID
 * @param {object} message - 直接消息
 */
function handleDirectMessage(senderId, message) {
  const target = federationMembers.get(message.to);
  if (target) {
    sendMessage(target.ws, {
      type: 'direct',
      from: senderId,
      content: message.content,
      timestamp: Date.now()
    });
  } else {
    // 目标不在线，加入队列
    if (!messageQueues.has(message.to)) {
      messageQueues.set(message.to, []);
    }
    messageQueues.get(message.to).push({
      type: 'direct',
      from: senderId,
      content: message.content,
      timestamp: Date.now()
    });
  }
}

/**
 * 处理断开连接
 * @param {string} agentId - 断开连接的Agent ID
 */
function handleDisconnect(agentId) {
  federationMembers.delete(agentId);
  console.log(`[Federation] 成员断开: ${agentId}`);
}

/**
 * 处理错误
 * @param {Error} err - 错误对象
 */
function handleError(err) {
  console.error(`[Federation] WebSocket错误: ${err.message}`);
}

/**
 * 更新心跳时间
 * @param {string} agentId - Agent ID
 */
function updateHeartbeat(agentId) {
  const member = federationMembers.get(agentId);
  if (member) {
    member.lastSeen = Date.now();
  }
}

/**
 * 检查心跳
 */
function checkHeartbeats() {
  const now = Date.now();
  federationMembers.forEach((member, agentId) => {
    if (now - member.lastSeen > HEARTBEAT_INTERVAL * 2) {
      console.warn(`[Federation] 心跳超时: ${agentId}`);
      member.ws.terminate();
    } else {
      member.ws.ping();
    }
  });
}

/**
 * 发送消息
 * @param {WebSocket} ws - WebSocket连接
 * @param {object} message - 消息对象
 */
function sendMessage(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * 生成Agent ID
 * @param {string} email - 用户邮箱
 * @returns {string} 唯一Agent ID
 */
function generateAgentId(email) {
  const hash = crypto.createHash('sha256');
  hash.update(email + Date.now());
  return 'agent-' + hash.digest('hex').slice(0, 8);
}

/**
 * 获取联邦状态
 * @returns {object} 联邦状态
 */
function getStatus() {
  return {
    version: FEDERATION_VERSION,
    members: Array.from(federationMembers.keys()),
    activeConnections: wss?.clients?.size || 0,
    queuedMessages: Array.from(messageQueues.entries()).map(([k, v]) => ({
      agent: k,
      count: v.length
    }))
  };
}

module.exports = {
  initFederation,
  getStatus
};