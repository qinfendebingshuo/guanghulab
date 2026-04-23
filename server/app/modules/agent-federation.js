"""
 * ═══════════════════════════════════════════════════════════
 * 🤝 三节点Agent联邦核心模块
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FED-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 协议: HLDP-v2.0
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   1. Agent注册与身份验证
 *   2. 跨节点消息广播
 *   3. 联邦状态监控
 */

'use strict';

const crypto = require('crypto');

// ─── 常量 ───
const NODE_TIMEOUT = 5000; // 5秒节点响应超时
const MAX_NODES = 3; // 最大联邦节点数

// ─── 内存存储 ───
const registeredAgents = new Map(); // agentId → { nodeInfo, lastSeen }
const pendingMessages = new Map(); // messageId → { sender, recipients, content }

// ─── HLDP 协议验证 ───
function validateHLDP(message) {
  if (!message || 
      !message.header || 
      !message.header.sender || 
      !message.header.timestamp ||
      !message.body) {
    throw new Error('Invalid HLDP message structure');
  }
  
  // 验证时间戳在合理范围内（±5分钟）
  const now = Date.now();
  const messageTime = new Date(message.header.timestamp).getTime();
  if (Math.abs(now - messageTime) > 300000) {
    throw new Error('HLDP timestamp out of range');
  }
}

// ─── 公开方法 ───
module.exports = {
  /**
   * 注册新Agent
   * @param {object} agentInfo - 包含 agentId, nodeUrl, capabilities
   * @returns {object} 注册结果
   */
  registerAgent(agentInfo) {
    if (!agentInfo.agentId || !agentInfo.nodeUrl) {
      throw new Error('Missing required agent info');
    }
    
    // 生成验证令牌
    const authToken = crypto.randomBytes(16).toString('hex');
    
    registeredAgents.set(agentInfo.agentId, {
      nodeInfo: agentInfo,
      lastSeen: Date.now(),
      authToken
    });
    
    return {
      success: true,
      authToken,
      federationInfo: {
        nodeCount: registeredAgents.size,
        maxNodes: MAX_NODES
      }
    };
  },
  
  /**
   * 广播消息到联邦节点
   * @param {object} message - HLDP格式消息
   * @returns {object} 广播结果
   */
  broadcastMessage(message) {
    validateHLDP(message);
    
    if (registeredAgents.size === 0) {
      throw new Error('No agents registered in federation');
    }
    
    const messageId = crypto.randomBytes(8).toString('hex');
    pendingMessages.set(messageId, {
      sender: message.header.sender,
      recipients: Array.from(registeredAgents.keys()),
      content: message.body,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      messageId,
      recipients: registeredAgents.size
    };
  },
  
  /**
   * 获取联邦状态
   * @returns {object} 状态信息
   */
  getStatus() {
    return {
      nodeCount: registeredAgents.size,
      activeNodes: Array.from(registeredAgents.values()).map(a => a.nodeInfo),
      pendingMessages: pendingMessages.size,
      protocolVersion: 'HLDP-v2.0'
    };
  }
};
