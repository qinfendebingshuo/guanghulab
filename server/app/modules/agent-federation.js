'use strict';

const WebSocket = require('ws');
const crypto = require('crypto');
const { validateSession } = require('./email-auth');

class FederationManager {
  static initFederation(server) {
    this.wss = new WebSocket.Server({ noServer: true });
    this.agents = new Map(); // token → ws
    this.handshakeStates = new Map(); // token → state

    // 处理升级请求
    server.on('upgrade', (req, socket, head) => {
      const token = req.headers['sec-websocket-protocol'];
      if (!token || !validateSession(token).valid) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });

    // 连接管理
    this.wss.on('connection', (ws, req) => {
      const token = req.headers['sec-websocket-protocol'];
      this.agents.set(token, ws);
      this.handshakeStates.set(token, 'init');

      // 心跳检测
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

      // 消息处理
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          this.handleMessage(token, msg);
        } catch (err) {
          console.error('[Federation] 消息解析失败:', err);
        }
      });

      // 连接关闭
      ws.on('close', () => {
        this.agents.delete(token);
        this.handshakeStates.delete(token);
      });
    });

    // 心跳检测
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping(null, false, true);
      });
    }, 30000);
  }

  static handleMessage(token, msg) {
    const state = this.handshakeStates.get(token);
    const ws = this.agents.get(token);

    // 验证消息结构
    if (!msg.type || !msg.payload) {
      return ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Invalid message format' }
      }));
    }

    // 状态机处理
    switch (state) {
      case 'init':
        if (msg.type === 'handshake-init') {
          this.handshakeStates.set(token, 'waiting-auth');
          ws.send(JSON.stringify({
            type: 'handshake-ack',
            payload: { challenge: crypto.randomBytes(16).toString('hex') }
          }));
        }
        break;

      case 'waiting-auth':
        if (msg.type === 'handshake-complete') {
          this.handshakeStates.set(token, 'ready');
          ws.send(JSON.stringify({
            type: 'handshake-success',
            payload: { status: 'connected' }
          }));
        }
        break;

      case 'ready':
        // 处理业务消息
        break;
    }
  }

  static broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload });
    this.wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}

module.exports = { FederationManager };