// ========== HoloLake 看板 · WebSocket 客户端模块 ==========
// 功能：连接管理、自动重连（指数退避）、心跳检测、状态回调

class WebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.reconnectInterval = options.reconnectInterval || 1000;  // 初始重连间隔 1秒
    this.maxReconnectInterval = options.maxReconnectInterval || 30000; // 最大30秒
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 心跳间隔30秒
    this.onMessage = options.onMessage || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});

    this.ws = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.forcedClose = false;
    this.reconnectAttempts = 0;
  }

  // 连接
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.forcedClose = false;
    this.onStatusChange('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      console.error('[WS] 连接失败', e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] 连接成功');
      this.reconnectAttempts = 0;
      this.onStatusChange('connected');
      this._startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch (e) {
        console.warn('[WS] 消息解析失败', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WS] 连接关闭', event.code, event.reason);
      this._stopHeartbeat();
      if (!this.forcedClose) {
        this.onStatusChange('disconnected');
        this._scheduleReconnect();
      } else {
        this.onStatusChange('offline');
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] 错误', error);
      this.onStatusChange('error');
    };
  }

  // 主动断开
  disconnect() {
    this.forcedClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // 发送消息
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WS] 未连接，无法发送');
    }
  }

  // 重连调度（指数退避）
  _scheduleReconnect() {
    if (this.forcedClose) return;
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectInterval
    );
    console.log(`[WS] ${delay}ms 后尝试重连...`);
    this.onStatusChange('reconnecting');
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  // 心跳
  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}