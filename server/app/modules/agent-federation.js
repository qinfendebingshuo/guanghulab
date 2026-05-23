'use strict';

const crypto = require('crypto');
const COS = require('cos-nodejs-sdk-v5');
const { WebSocketServer } = require('ws');

// ─── COS 客户端初始化 ───
const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
});

// ─── 联邦训练参数 ───
const TRAINING_INTERVAL = 6 * 60 * 60 * 1000; // 6小时
const HEARTBEAT_INTERVAL = 30 * 1000; // 30秒
const MAX_RETRIES = 5;

class FederationManager {
  static initFederation(server) {
    this.wss = new WebSocketServer({ noServer: true });
    this.agents = new Map(); // token → { ws, lastActive, retries }
    this.trainingData = {};

    // 处理升级请求
    server.on('upgrade', (req, socket, head) => {
      const token = req.headers['sec-websocket-protocol'];
      if (!this.validateToken(token)) {
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
      const agentId = crypto.randomBytes(16).toString('hex');
      
      this.agents.set(token, {
        ws,
        agentId,
        lastActive: Date.now(),
        retries: 0
      });

      // 心跳检测
      const heartbeat = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
        }
      }, HEARTBEAT_INTERVAL);

      ws.on('pong', () => {
        const agent = this.agents.get(token);
        if (agent) agent.lastActive = Date.now();
      });

      ws.on('close', () => {
        clearInterval(heartbeat);
        this.agents.delete(token);
      });

      ws.on('error', (err) => {
        console.error(`[联邦Agent] 连接错误: ${err.message}`);
        clearInterval(heartbeat);
        this.agents.delete(token);
      });
    });

    // 定时训练
    setInterval(() => this.runTrainingCycle(), TRAINING_INTERVAL);
    
    // 初始训练
    this.runTrainingCycle();
  }

  static async runTrainingCycle() {
    try {
      // 从COS加载共享训练数据
      const data = await this.loadTrainingData();
      this.trainingData = data || {};
      
      // 执行联邦训练
      const results = await this.executeFederatedTraining();
      
      // 保存训练结果到COS
      await this.saveTrainingData(results);
      
      console.log('[联邦训练] 周期完成:', results);
    } catch (err) {
      console.error('[联邦训练] 错误:', err);
    }
  }

  static async loadTrainingData() {
    try {
      const result = await cos.getObject({
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION,
        Key: 'federation/training-data.json'
      });
      return JSON.parse(result.Body);
    } catch (err) {
      if (err.code === 'NoSuchKey') return null;
      throw err;
    }
  }

  static async saveTrainingData(data) {
    await cos.putObject({
      Bucket: process.env.COS_BUCKET,
      Region: process.env.COS_REGION,
      Key: 'federation/training-data.json',
      Body: JSON.stringify(data, null, 2)
    });
  }

  static async executeFederatedTraining() {
    const results = {};
    
    // 广播训练请求给所有Agent
    for (const [token, agent] of this.agents.entries()) {
      if (agent.ws.readyState === agent.ws.OPEN) {
        try {
          const response = await this.sendTrainingRequest(agent.ws, {
            trainingData: this.trainingData,
            round: Date.now()
          });
          results[token] = response;
        } catch (err) {
          console.error(`[联邦训练] Agent ${token.slice(0, 8)}... 错误:`, err);
        }
      }
    }
    
    return results;
  }

  static sendTrainingRequest(ws, data) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('训练请求超时'));
      }, 30000);

      ws.send(JSON.stringify({
        type: 'federated_training',
        data
      }), (err) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });

      const listener = (message) => {
        try {
          const msg = JSON.parse(message);
          if (msg.type === 'training_result') {
            clearTimeout(timeout);
            ws.removeListener('message', listener);
            resolve(msg.data);
          }
        } catch (err) {
          clearTimeout(timeout);
          ws.removeListener('message', listener);
          reject(err);
        }
      };

      ws.on('message', listener);
    });
  }

  static validateToken(token) {
    // 实现现有的token验证逻辑
    return true;
  }
}

module.exports = { FederationManager };