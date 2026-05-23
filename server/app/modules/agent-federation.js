'use strict';

const WebSocket = require('ws');
const crypto = require('crypto');
const { validateSession } = require('./email-auth');

class FederationManager {
  constructor() {
    this.agents = new Map(); // token → agentInfo
    this.heartbeatInterval = 30000; // 30秒心跳
    this.maxMissedHeartbeats = 3; // 最多错过3次心跳
  }

  static initFederation(server) {
    const wss = new WebSocket.Server({ noServer: true });
    const manager = new FederationManager();

    server.on('upgrade', (request, socket, head) => {
      const token = request.headers['sec-websocket-protocol'];
      
      // 验证会话
      const session = validateSession(token);
      if (!session.valid) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        // 注册新Agent
        const agentId = crypto.randomBytes(16).toString('hex');
        const agentInfo = {
          id: agentId,
          email: session.email,
          ws,
          lastHeartbeat: Date.now(),
          missedHeartbeats: 0,
          nodeType: null // 待握手确认
        };
        
        manager.agents.set(agentId, agentInfo);
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            manager.handleMessage(agentId, message);
          } catch (err) {
            console.error(`[Federation] 消息解析失败: ${err.message}`);
          }
        });
        
        ws.on('close', () => {
          manager.agents.delete(agentId);
        });
        
        // 发送初始化握手
        ws.send(JSON.stringify({
          type: 'handshake_init',
          agentId,
          timestamp: Date.now()
        }));
      });
    });
    
    // 心跳检测
    setInterval(() => {
      const now = Date.now();
      manager.agents.forEach((agent) => {
        if (now - agent.lastHeartbeat > manager.heartbeatInterval) {
          agent.missedHeartbeats++;
          
          if (agent.missedHeartbeats >= manager.maxMissedHeartbeats) {
            agent.ws.close();
            manager.agents.delete(agent.id);
          } else {
            // 发送心跳请求
            agent.ws.send(JSON.stringify({
              type: 'heartbeat_request',
              timestamp: now
            }));
          }
        }
      });
    }, manager.heartbeatInterval);
    
    return wss;
  }
  
  handleMessage(agentId, message) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    switch (message.type) {
      case 'handshake_response':
        this.handleHandshake(agent, message);
        break;
      case 'heartbeat_response':
        agent.lastHeartbeat = Date.now();
        agent.missedHeartbeats = 0;
        break;
      default:
        console.log(`[Federation] 未知消息类型: ${message.type}`);
    }
  }
  
  handleHandshake(agent, message) {
    // 验证节点类型
    if (!['github', 'notion', 'website'].includes(message.nodeType)) {
      agent.ws.close();
      return;
    }
    
    agent.nodeType = message.nodeType;
    
    // 发送握手确认
    agent.ws.send(JSON.stringify({
      type: 'handshake_complete',
      agentId: agent.id,
      nodeType: agent.nodeType,
      timestamp: Date.now()
    }));
    
    console.log(`[Federation] 节点握手成功: ${agent.email.slice(0, 3)}*** (${agent.nodeType})`);
  }
}

module.exports = { FederationManager };