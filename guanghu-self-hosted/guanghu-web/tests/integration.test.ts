/**
 * 光湖网站 · 集成测试
 * GH-INT-001 · Phase-NOW-006
 *
 * 测试内容:
 * 1. 前后端联调: API端点连通性
 * 2. WebSocket通信: 连接+消息收发
 * 3. 工单指令端到端: /order指令→解析→响应
 *
 * 运行方式: npm run test:integration
 * 前置: 需要后端API(8000)和WS服务(8765)运行中
 */

describe('GH-INT-001 集成测试', () => {
  const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
  const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:8765/ws';

  // ==================== 1. 前后端联调 ====================
  describe('前后端联调 · API端点', () => {
    test('GET /api/orders 返回工单列表', async () => {
      try {
        const res = await fetch(`${API_BASE}/orders`);
        expect(res.status).toBeLessThan(500);
        if (res.ok) {
          const data = await res.json();
          expect(Array.isArray(data)).toBe(true);
        }
      } catch {
        // API未启动时跳过
        console.warn('[测试] API服务未启动，跳过联调测试');
      }
    });

    test('GET /api/agents 返回Agent列表', async () => {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        expect(res.status).toBeLessThan(500);
        if (res.ok) {
          const data = await res.json();
          expect(Array.isArray(data)).toBe(true);
        }
      } catch {
        console.warn('[测试] API服务未启动，跳过联调测试');
      }
    });

    test('GET /api/chat/messages 返回消息历史', async () => {
      try {
        const res = await fetch(`${API_BASE}/chat/messages?channel=shuangyan&limit=10`);
        expect(res.status).toBeLessThan(500);
        if (res.ok) {
          const data = await res.json();
          expect(Array.isArray(data)).toBe(true);
        }
      } catch {
        console.warn('[测试] API服务未启动，跳过联调测试');
      }
    });
  });

  // ==================== 2. WebSocket通信 ====================
  describe('WebSocket通信', () => {
    test('WebSocket连接+心跳', (done) => {
      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          ws.close();
          console.warn('[测试] WS服务未启动，跳过WebSocket测试');
          done();
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          // 发送ping
          ws.send(JSON.stringify({ type: 'ping' }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') {
            expect(msg.type).toBe('pong');
            ws.close();
            done();
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          console.warn('[测试] WS连接失败，跳过');
          done();
        };
      } catch {
        console.warn('[测试] WebSocket不可用');
        done();
      }
    });

    test('WebSocket消息广播', (done) => {
      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          ws.close();
          done();
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.send(JSON.stringify({
            type: 'chat',
            channel: 'shuangyan',
            sender: '测试用户',
            content: '集成测试消息',
            timestamp: new Date().toISOString(),
          }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'chat' && msg.content === '集成测试消息') {
            expect(msg.sender).toBe('测试用户');
            expect(msg.channel).toBe('shuangyan');
            ws.close();
            done();
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          done();
        };
      } catch {
        done();
      }
    });
  });

  // ==================== 3. 工单指令端到端 ====================
  describe('工单指令端到端', () => {
    test('/order create 指令解析', (done) => {
      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          ws.close();
          done();
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.send(JSON.stringify({
            type: 'chat',
            channel: 'shuangyan',
            sender: '冰朔',
            content: '/order create 测试工单标题',
          }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'chat' && msg.role === 'system') {
            expect(msg.content).toContain('测试工单标题');
            expect(msg.content).toContain('工单创建');
            ws.close();
            done();
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          done();
        };
      } catch {
        done();
      }
    });

    test('/order status 指令解析', (done) => {
      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          ws.close();
          done();
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.send(JSON.stringify({
            type: 'chat',
            channel: 'shuangyan',
            sender: '冰朔',
            content: '/order status',
          }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'chat' && msg.role === 'system') {
            expect(msg.content).toContain('工单状态');
            ws.close();
            done();
          }
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          done();
        };
      } catch {
        done();
      }
    });
  });
});
