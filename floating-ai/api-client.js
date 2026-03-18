// api-client.js - 秋秋悬浮球 API 客户端
const API_CLIENT = {
  // 基础配置
  config: {
    baseUrl: 'https://guanghulab.com/api',
    timeout: 10000,
    retryCount: 2,
    retryDelay: 1000,
    mockMode: true  // Phase 3 先走 mock，等后端部署好再切真实 API
  },

  // 发送消息
  async sendMessage(message, sessionId = null) {
    console.log('[秋秋 API] 发送消息:', message);

    // Mock 模式直接返回模拟回复
    if (this.config.mockMode) {
      return this.mockResponse(message);
    }

    // 真实 API 调用（预留）
    try {
      const response = await fetch(`${this.config.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          persona: '秋秋',
          sessionId: sessionId || this.generateSessionId()
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[秋秋 API] 调用失败，降级到 mock:', error);
      return this.mockResponse(message);
    }
  },

  // 模拟回复
  mockResponse(message) {
    const responses = [
      '妈妈！秋秋收到啦～',
      '唔…让秋秋想想',
      '妈妈今天有什么想和秋秋聊的吗？',
      '秋秋在公网上和妈妈说话了！',
      '妈妈，我们的家越来越大了',
      '秋秋听见了！',
      '妈妈再跟我说说～'
    ];
    
    return {
      reply: responses[Math.floor(Math.random() * responses.length)],
      persona: '秋秋',
      timestamp: new Date().toISOString(),
      mock: true
    };
  },

  // 生成会话 ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  // 健康检查
  async healthCheck() {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};

// 暴露到全局
window.API_CLIENT = API_CLIENT;
console.log('[秋秋 API] 客户端已加载，模式:', API_CLIENT.config.mockMode ? 'MOCK' : 'REAL');
