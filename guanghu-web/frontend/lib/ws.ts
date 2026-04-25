const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765';

export interface ReconnectingWS {
  send: (data: string) => void;
  close: () => void;
  onMessage: (cb: (data: string) => void) => void;
  onStatusChange: (cb: (connected: boolean) => void) => void;
}

/**
 * 光湖WebSocket客户端 · 断线重连 + 心跳
 * GH-INT-001 集成组件
 */
export function createReconnectingWebSocket(channel: string): ReconnectingWS {
  let ws: WebSocket | null = null;
  let messageCallbacks: Array<(data: string) => void> = [];
  let statusCallbacks: Array<(connected: boolean) => void> = [];
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let reconnectDelay = 1000;
  const MAX_RECONNECT_DELAY = 30000;

  function connect() {
    if (closed) return;
    try {
      ws = new WebSocket(`${WS_URL}?channel=${encodeURIComponent(channel)}`);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 1000;
      statusCallbacks.forEach((cb) => cb(true));
      // 心跳: 每30秒发送ping
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : '';
      // 忽略pong
      try { const parsed = JSON.parse(data); if (parsed.type === 'pong') return; } catch { /* not JSON, pass through */ }
      messageCallbacks.forEach((cb) => cb(data));
    };

    ws.onclose = () => {
      clearHeartbeat();
      statusCallbacks.forEach((cb) => cb(false));
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      connect();
    }, reconnectDelay);
  }

  function clearHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  connect();

  return {
    send: (data: string) => { if (ws?.readyState === WebSocket.OPEN) ws.send(data); },
    close: () => { closed = true; clearHeartbeat(); if (reconnectTimer) clearTimeout(reconnectTimer); ws?.close(); },
    onMessage: (cb) => { messageCallbacks.push(cb); },
    onStatusChange: (cb) => { statusCallbacks.push(cb); },
  };
}
