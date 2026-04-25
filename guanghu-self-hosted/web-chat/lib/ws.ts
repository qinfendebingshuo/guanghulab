/**
 * WebSocket客户端
 * 光湖聊天系统 · 断线重连 · 消息UTF-8 · 事件驱动
 * GH-CHAT-001
 */

export interface WSMessage {
  type: 'chat' | 'status' | 'order_update' | 'ping' | 'pong' | 'error';
  id?: string;
  channel?: string;
  sender?: string;
  content?: string;
  timestamp?: string;
  role?: 'user' | 'agent' | 'system';
  agentId?: string;
  status?: string;
  [key: string]: unknown;
}

type MessageHandler = (msg: WSMessage) => void;
type ConnectionHandler = () => void;

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: MessageHandler[] = [];
  private openHandlers: ConnectionHandler[] = [];
  private closeHandlers: ConnectionHandler[] = [];
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = true;

  constructor(url: string) {
    this.url = url;
  }

  /** 建立连接 */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] 已连接:', this.url);
        this.reconnectDelay = 1000; // 重置重连延迟
        this.startPing();
        this.openHandlers.forEach((h) => h());
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          if (msg.type === 'pong') return; // 心跳回复忽略
          this.messageHandlers.forEach((h) => h(msg));
        } catch (err) {
          console.error('[WS] 消息解析失败:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] 连接关闭');
        this.stopPing();
        this.closeHandlers.forEach((h) => h());
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error('[WS] 连接错误:', err);
      };
    } catch (err) {
      console.error('[WS] 创建连接失败:', err);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /** 断开连接 */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /** 发送消息 */
  send(msg: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] 未连接，消息丢弃:', msg);
    }
  }

  /** 注册消息处理器 */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /** 注册连接成功处理器 */
  onOpen(handler: ConnectionHandler): void {
    this.openHandlers.push(handler);
  }

  /** 注册连接关闭处理器 */
  onClose(handler: ConnectionHandler): void {
    this.closeHandlers.push(handler);
  }

  /** 断线重连 · 指数退避 */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log(`[WS] ${this.reconnectDelay / 1000}秒后重连...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    // 指数退避 · 上限30秒
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  /** 心跳 · 每30秒发一次ping */
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
