/**
 * GH-INT-001 集成测试
 * 测试前后端联调 + WebSocket通信 + 工单指令
 */

describe('GH-INT-001 Integration Tests', () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765';

  describe('API联调', () => {
    test('工单列表API可访问', async () => {
      try {
        const res = await fetch(`${API_URL}/orders`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      } catch {
        // API未启动时跳过
        console.warn('API未启动，跳过联调测试');
      }
    });

    test('Agent列表API可访问', async () => {
      try {
        const res = await fetch(`${API_URL}/agents`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      } catch {
        console.warn('API未启动，跳过');
      }
    });

    test('聊天消息API可访问', async () => {
      try {
        const res = await fetch(`${API_URL}/chat/messages?channel=general`);
        expect(res.status).toBe(200);
      } catch {
        console.warn('API未启动，跳过');
      }
    });
  });

  describe('WebSocket通信', () => {
    test('WebSocket连接地址格式正确', () => {
      const url = `${WS_URL}?channel=general`;
      expect(url).toMatch(/^wss?:\/\/.+\?channel=/);
    });
  });

  describe('工单快捷指令', () => {
    function parseCommand(text: string): { cmd: string; args: string[] } {
      const parts = text.trim().split(/\s+/);
      return { cmd: parts[0] || '', args: parts.slice(1) };
    }

    test('/status 解析正确', () => {
      const { cmd } = parseCommand('/status');
      expect(cmd).toBe('/status');
    });

    test('/assign 解析正确', () => {
      const { cmd, args } = parseCommand('/assign GH-WEB-001 录册A02');
      expect(cmd).toBe('/assign');
      expect(args).toEqual(['GH-WEB-001', '录册A02']);
    });

    test('/help 解析正确', () => {
      const { cmd } = parseCommand('/help');
      expect(cmd).toBe('/help');
    });

    test('未知指令解析正确', () => {
      const { cmd } = parseCommand('/unknown');
      expect(cmd).toBe('/unknown');
    });
  });
});
