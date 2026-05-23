'use strict';

const crypto = require('crypto');
const WebSocket = require('ws');
const { HLDPValidator } = require('../hldp/validator');

/**
 * ═══════════════════════════════════════════════════════════
 * 🤝 三节点Agent联邦握手协议核心模块
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FED-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   1. 建立WebSocket连接通道
 *   2. 实现HLDP协议握手流程
 *   3. 管理联邦Agent状态
 *   4. 处理心跳检测和断线重连
 */

// ─── 常量 ───
const HEARTBEAT_INTERVAL = 30000; // 30秒心跳
const RECONNECT_DELAY = 5000;     // 5秒重连延迟
const SESSION_TIMEOUT = 60000;    // 60秒会话超时

// ─── 联邦节点配置 ───
const FEDERATION_NODES = {
  GITHUB: {
    id: 'AG-GH-001',
    endpoint: process.env.ZY_GH_AGENT_ENDPOINT,
    publicKey: process.env.ZY_GH_AGENT_PUBKEY
  },
  NOTION: {
    id: 'AG-NT-001',
    endpoint: process.env.ZY_NT_AGENT_ENDPOINT,
    publicKey: process.env.ZY_NT_AGENT_PUBKEY
  }
};

// ─── 联邦会话存储 ───
const activeSessions = new Map(); // sessionId → {ws, nodeType, lastActive}

// ─── HLDP消息类型 ───
const HLDP_MESSAGE_TYPES = {
  HANDSHAKE_INIT: 'federation/handshake-init',
  HANDSHAKE_ACK: 'federation/handshake-ack',
  HEARTBEAT: 'federation/heartbeat',
  DATA: 'federation/data',
  ERROR: 'federation/error'
};

class FederationManager {
  constructor(server) {
    this.wss = new WebSocket.Server({ noServer: true });
    this.setupHandlers();
    this.attachToServer(server);
    this.startHeartbeat();
  }

  attachToServer(server) {
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
      
      if (pathname === '/federation') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
  }

  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      const sessionId = crypto.randomBytes(16).toString('hex');
      
      ws.on('message', (data) => this.handleMessage(ws, sessionId, data));
      ws.on('close', () => this.handleClose(sessionId));
      ws.on('error', (err) => this.handleError(sessionId, err));
      
      // 初始化会话
      activeSessions.set(sessionId, {
        ws,
        nodeType: null,
        lastActive: Date.now()
      });
      
      this.sendWelcome(sessionId);
    });
  }

  handleMessage(ws, sessionId, data) {
    try {
      const session = activeSessions.get(sessionId);
      if (!session) return;
      
      session.lastActive = Date.now();
      
      const message = JSON.parse(data);
      if (!HLDPValidator.validate(message)) {
        throw new Error('Invalid HLDP message format');
      }
      
      switch (message.type) {
        case HLDP_MESSAGE_TYPES.HANDSHAKE_INIT:
          this.handleHandshakeInit(sessionId, message);
          break;
        case HLDP_MESSAGE_TYPES.HEARTBEAT:
          this.handleHeartbeat(sessionId);
          break;
        case HLDP_MESSAGE_TYPES.DATA:
          this.handleData(sessionId, message);
          break;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`[Federation] 消息处理错误: ${err.message}`);
      this.sendError(sessionId, err.message);
    }
  }

  handleHandshakeInit(sessionId, message) {
    const session = activeSessions.get(sessionId);
    if (!session) return;
    
    // 验证节点身份
    const node = FEDERATION_NODES[message.payload.nodeType];
    if (!node || node.id !== message.payload.agentId) {
      throw new Error('Unauthorized federation node');
    }
    
    // 更新会话信息
    session.nodeType = message.payload.nodeType;
    
    // 发送握手确认
    this.sendMessage(sessionId, {
      type: HLDP_MESSAGE_TYPES.HANDSHAKE_ACK,
      payload: {
        sessionId,
        timestamp: Date.now()
      }
    });
    
    console.log(`[Federation] 握手成功: ${session.nodeType}节点已连接`);
  }

  handleHeartbeat(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) return;
    
    session.lastActive = Date.now();
    
    this.sendMessage(sessionId, {
      type: HLDP_MESSAGE_TYPES.HEARTBEAT,
      payload: {
        sessionId,
        timestamp: Date.now()
      }
    });
  }

  handleData(sessionId, message) {
    // 数据转发逻辑将在阶段3实现
    console.log(`[Federation] 收到数据: ${JSON.stringify(message.payload)}`);
  }

  handleClose(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) return;
    
    console.log(`[Federation] 连接关闭: ${session.nodeType || '未知'}节点`);
    activeSessions.delete(sessionId);
    
    // 计划重连（如果是有身份的节点）
    if (session.nodeType) {
      setTimeout(() => {
        this.attemptReconnect(session.nodeType);
      }, RECONNECT_DELAY);
    }
  }

  handleError(sessionId, err) {
    console.error(`[Federation] 会话错误: ${sessionId} - ${err.message}`);
    this.sendError(sessionId, err.message);
  }

  sendWelcome(sessionId) {
    this.sendMessage(sessionId, {
      type: 'federation/welcome',
      payload: {
        version: '1.0',
        sessionId,
        timestamp: Date.now(),
        supportedProtocols: ['HLDP/v1']
      }
    });
  }

  sendMessage(sessionId, message) {
    const session = activeSessions.get(sessionId);
    if (!session || !session.ws) return;
    
    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(message));
      }
    } catch (err) {
      console.error(`[Federation] 发送消息失败: ${err.message}`);
    }
  }

  sendError(sessionId, error) {
    this.sendMessage(sessionId, {
      type: HLDP_MESSAGE_TYPES.ERROR,
      payload: {
        sessionId,
        error,
        timestamp: Date.now()
      }
    });
  }

  startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [sessionId, session] of activeSessions.entries()) {
        // 检查超时会话
        if (now - session.lastActive > SESSION_TIMEOUT) {
          console.log(`[Federation] 会话超时: ${sessionId}`);
          session.ws.close();
          activeSessions.delete(sessionId);
          continue;
        }
        
        // 发送心跳
        if (session.nodeType) {
          this.sendMessage(sessionId, {
            type: HLDP_MESSAGE_TYPES.HEARTBEAT,
            payload: {
              sessionId,
              timestamp: now
            }
          });
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  attemptReconnect(nodeType) {
    console.log(`[Federation] 尝试重连: ${nodeType}节点`);
    // 实际重连逻辑将在阶段4实现
  }

  static initFederation(server) {
    return new FederationManager(server);
  }
}

module.exports = {
  FederationManager
};