'use strict';

/**
 * ═══════════════════════════════════════════════════════════
 * 🤝 三节点Agent联邦核心模块
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FED-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   1. Agent注册与身份验证
 *   2. 跨节点消息广播
 *   3. 联邦状态监控
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ─── 常量 ───
const AGENT_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24小时
const TOKEN_BYTES = 32;

// ─── 内存存储 ───
const registeredAgents = new Map(); // agentId → { name, token, createdAt, expiresAt }
const broadcastChannels = new Map(); // channelId → [agentId1, agentId2...]

/**
 * 生成安全token
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * 清理过期的Agent
 */
function cleanupExpiredAgents() {
  const now = Date.now();
  for (const [agentId, agent] of registeredAgents.entries()) {
    if (now > agent.expiresAt) {
      registeredAgents.delete(agentId);
      // 从所有广播频道移除
      for (const [channelId, agents] of broadcastChannels.entries()) {
        const index = agents.indexOf(agentId);
        if (index !== -1) {
          agents.splice(index, 1);
        }
      }
    }
  }
}

// 每10分钟清理一次
setInterval(cleanupExpiredAgents, 10 * 60 * 1000);

/**
 * 注册新Agent
 * @param {object} payload - 注册信息
 * @returns {object} 注册结果
 */
function registerAgent(payload) {
  if (!payload || !payload.name || typeof payload.name !== 'string') {
    throw new Error('无效的注册信息: 必须提供Agent名称');
  }

  const agentId = uuidv4();
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + AGENT_EXPIRE_MS;

  registeredAgents.set(agentId, {
    name: payload.name,
    token,
    createdAt: now,
    expiresAt
  });

  console.log(`[Agent Federation] 新Agent注册: ${payload.name} (${agentId.slice(0, 8)}...)`);

  return {
    agentId,
    token,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

/**
 * 验证Agent token
 * @param {string} agentId - Agent ID
 * @param {string} token - 验证token
 * @returns {boolean} 是否有效
 */
function validateAgent(agentId, token) {
  if (!agentId || !token) return false;

  const agent = registeredAgents.get(agentId);
  if (!agent) return false;

  // 使用时间恒定比较防止时序攻击
  const tokenBuffer = Buffer.from(token);
  const agentBuffer = Buffer.from(agent.token);

  return tokenBuffer.length === agentBuffer.length &&
         crypto.timingSafeEqual(tokenBuffer, agentBuffer) &&
         Date.now() <= agent.expiresAt;
}

/**
 * 广播消息
 * @param {object} payload - 广播信息
 * @returns {object} 广播结果
 */
function broadcastMessage(payload) {
  if (!payload || !payload.agentId || !payload.token || !payload.channelId) {
    throw new Error('无效的广播请求: 必须提供agentId, token和channelId');
  }

  if (!validateAgent(payload.agentId, payload.token)) {
    throw new Error('Agent验证失败');
  }

  const channelAgents = broadcastChannels.get(payload.channelId) || [];
  const senderName = registeredAgents.get(payload.agentId).name;

  console.log(`[Agent Federation] 消息广播: ${senderName} → ${channelAgents.length}个接收者`);

  return {
    success: true,
    channelId: payload.channelId,
    recipients: channelAgents.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * 获取联邦状态
 * @returns {object} 状态信息
 */
function getStatus() {
  return {
    totalAgents: registeredAgents.size,
    totalChannels: broadcastChannels.size,
    lastUpdated: new Date().toISOString()
  };
}

module.exports = {
  registerAgent,
  broadcastMessage,
  getStatus
};