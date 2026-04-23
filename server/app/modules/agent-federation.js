'use strict';

const crypto = require('crypto');
const WebSocket = require('ws');
const COS = require('cos-nodejs-sdk-v5');

// ─── 联邦常量 ───
const HEARTBEAT_INTERVAL = 30000; // 30秒
const TRAINING_BATCH_SIZE = 10;
const MAX_RETRIES = 3;

// ─── COS 配置 ───
const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
});
const COS_BUCKET = 'agent-federation-1250000000';
const COS_REGION = 'ap-singapore';

class AgentFederation {
  constructor() {
    this.agents = new Map(); // agentId → {ws, modelVersion, lastActive}
    this.trainingQueue = [];
    this.heartbeatInterval = null;
  }

  initFederation(server) {
    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      if (request.url === '/federation') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleConnection(ws, request);
        });
      }
    });

    this.startHeartbeat();
    this.startTrainingProcessor();
    console.log('[联邦] 三节点Agent联邦服务已启动');
  }

  handleConnection(ws, req) {
    const agentId = crypto.randomBytes(16).toString('hex');
    this.agents.set(agentId, {
      ws,
      modelVersion: 0,
      lastActive: Date.now(),
      endpoint: req.headers['x-agent-endpoint']
    });

    ws.on('message', (data) => this.handleMessage(agentId, data));
    ws.on('close', () => this.handleDisconnect(agentId));
    ws.on('error', (err) => this.handleError(agentId, err));

    // 发送初始化配置
    ws.send(JSON.stringify({
      type: 'init',
      agentId,
      heartbeatInterval: HEARTBEAT_INTERVAL,
      cosBucket: COS_BUCKET
    }));
  }

  handleMessage(agentId, data) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.lastActive = Date.now();
    
    try {
      const message = JSON.parse(data);
      switch (message.type) {
        case 'heartbeat':
          this.handleHeartbeat(agentId, message);
          break;
        case 'training-data':
          this.handleTrainingData(agentId, message);
          break;
        case 'model-update':
          this.handleModelUpdate(agentId, message);
          break;
      }
    } catch (err) {
      console.error(`[联邦] 消息处理错误: ${err.message}`);
    }
  }

  handleHeartbeat(agentId, message) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.ws.send(JSON.stringify({ type: 'heartbeat-ack' }));
    }
  }

  handleTrainingData(agentId, message) {
    this.trainingQueue.push({
      agentId,
      data: message.data,
      timestamp: Date.now()
    });
  }

  handleModelUpdate(agentId, message) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // 上传模型到COS
    const modelKey = `models/${agentId}/${message.version}.bin`;
    cos.putObject({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: modelKey,
      Body: Buffer.from(message.data, 'base64')
    }, (err) => {
      if (err) {
        console.error(`[联邦] 模型上传失败: ${err.message}`);
      } else {
        console.log(`[联邦] 模型已上传: ${modelKey}`);
        // 广播模型更新
        this.broadcastModelUpdate(agentId, message.version, modelKey);
      }
    });
  }

  broadcastModelUpdate(sourceAgentId, version, modelKey) {
    this.agents.forEach((agent, agentId) => {
      if (agentId !== sourceAgentId && agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.send(JSON.stringify({
          type: 'model-update-notify',
          version,
          modelKey,
          source: sourceAgentId
        }));
      }
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      this.agents.forEach((agent, agentId) => {
        if (now - agent.lastActive > HEARTBEAT_INTERVAL * 2) {
          console.log(`[联邦] Agent ${agentId} 心跳丢失，断开连接`);
          agent.ws.terminate();
          this.agents.delete(agentId);
        }
      });
    }, HEARTBEAT_INTERVAL);
  }

  startTrainingProcessor() {
    setInterval(() => {
      if (this.trainingQueue.length >= TRAINING_BATCH_SIZE) {
        const batch = this.trainingQueue.splice(0, TRAINING_BATCH_SIZE);
        this.processTrainingBatch(batch);
      }
    }, 5000);
  }

  processTrainingBatch(batch) {
    const trainingData = batch.map(item => item.data);
    const dataKey = `training/${Date.now()}.json`;
    
    cos.putObject({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: dataKey,
      Body: JSON.stringify(trainingData)
    }, (err) => {
      if (err) {
        console.error(`[联邦] 训练数据上传失败: ${err.message}`);
        // 重试
        this.trainingQueue.unshift(...batch);
      } else {
        console.log(`[联邦] 训练数据已上传: ${dataKey}`);
      }
    });
  }

  handleDisconnect(agentId) {
    this.agents.delete(agentId);
    console.log(`[联邦] Agent ${agentId} 已断开`);
  }

  handleError(agentId, err) {
    console.error(`[联邦] Agent ${agentId} 错误: ${err.message}`);
    this.agents.delete(agentId);
  }
}

module.exports = new AgentFederation();