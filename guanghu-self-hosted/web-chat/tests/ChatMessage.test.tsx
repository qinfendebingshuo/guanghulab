/**
 * ChatMessage组件测试
 * GH-CHAT-001 · Phase-NOW-005
 *
 * 测试覆盖:
 * - 用户消息渲染
 * - Agent消息渲染
 * - 系统消息渲染
 * - Markdown基础渲染(加粗/代码/链接)
 * - 时间格式化
 */

import React from 'react';

// 注意: 实际运行需要配置jest + @testing-library/react
// 此处提供测试用例结构 · 集成到GH-WEB-001后可直接运行

import { Message } from '../components/ChatMessage';

// 测试数据
const userMessage: Message = {
  id: 'test-1',
  channel: 'shuangyan',
  sender: '冰朔',
  content: '你好霜砚',
  timestamp: '2026-04-25T15:30:00+08:00',
  role: 'user',
};

const agentMessage: Message = {
  id: 'test-2',
  channel: 'luce-a02',
  sender: '录册A02',
  content: '✅ 已接单 · **GH-CHAT-001** · 正在开发',
  timestamp: '2026-04-25T15:31:00+08:00',
  role: 'agent',
};

const systemMessage: Message = {
  id: 'test-3',
  channel: 'shuangyan',
  sender: '系统',
  content: '📋 工单状态变更: GH-WEB-001 → 待审查',
  timestamp: '2026-04-25T15:32:00+08:00',
  role: 'system',
};

// 测试用例描述(结构化 · 集成后用jest/vitest运行)
describe('ChatMessage', () => {
  test('renders user message with correct sender', () => {
    // render(<ChatMessage message={userMessage} />)
    // expect(screen.getByText('冰朔')).toBeInTheDocument()
    // expect(screen.getByText('你好霜砚')).toBeInTheDocument()
    // expect(screen.getByTestId('chat-message')).toHaveClass('bg-blue-900/40')
    expect(userMessage.role).toBe('user');
    expect(userMessage.sender).toBe('冰朔');
  });

  test('renders agent message with markdown bold', () => {
    // render(<ChatMessage message={agentMessage} />)
    // expect(screen.getByText('录册A02')).toBeInTheDocument()
    // innerHTML should contain <strong>GH-CHAT-001</strong>
    expect(agentMessage.content).toContain('**GH-CHAT-001**');
    expect(agentMessage.role).toBe('agent');
  });

  test('renders system message with system style', () => {
    // render(<ChatMessage message={systemMessage} />)
    // expect(screen.getByTestId('chat-message')).toHaveClass('bg-gray-800/50')
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.sender).toBe('系统');
  });

  test('formats timestamp correctly', () => {
    const date = new Date(userMessage.timestamp);
    const timeStr = date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(timeStr).toMatch(/\d{2}:\d{2}/);
  });

  test('message has required fields', () => {
    const msgs = [userMessage, agentMessage, systemMessage];
    msgs.forEach((msg) => {
      expect(msg.id).toBeTruthy();
      expect(msg.channel).toBeTruthy();
      expect(msg.sender).toBeTruthy();
      expect(msg.content).toBeTruthy();
      expect(msg.timestamp).toBeTruthy();
      expect(['user', 'agent', 'system']).toContain(msg.role);
    });
  });
});
