'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createReconnectingWebSocket, type ReconnectingWS } from '@/lib/ws';
import ChannelList from '@/components/chat/ChannelList';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';

export interface Message {
  id: string;
  channel: string;
  sender: string;
  senderIcon?: string;
  text: string;
  timestamp: string;
  type: 'text' | 'command' | 'system';
}

const DEFAULT_CHANNELS = [
  { id: 'general', name: '综合频道', icon: '🌊' },
  { id: 'orders', name: '工单通知', icon: '📋' },
  { id: 'dev', name: '开发讨论', icon: '💻' },
];

const MOCK_MESSAGES: Message[] = [
  { id: '1', channel: 'general', sender: '系统', text: '欢迎来到光湖聊天频道', timestamp: new Date().toISOString(), type: 'system' },
];

export default function ChatPage() {
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wsRef = useRef<ReconnectingWS | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = createReconnectingWebSocket(activeChannel);
    wsRef.current = ws;

    ws.onMessage((data: string) => {
      try {
        const msg: Message = JSON.parse(data);
        setMessages((prev) => [...prev, msg]);
      } catch {
        // ignore parse errors
      }
    });

    return () => { ws.close(); };
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback((text: string) => {
    const isCommand = text.startsWith('/');
    const msg: Message = {
      id: Date.now().toString(),
      channel: activeChannel,
      sender: '冰朔',
      text,
      timestamp: new Date().toISOString(),
      type: isCommand ? 'command' : 'text',
    };
    setMessages((prev) => [...prev, msg]);

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify(msg));
    }

    // 工单快捷指令处理
    if (isCommand) {
      const parts = text.split(' ');
      const cmd = parts[0];
      let responseText = '';
      switch (cmd) {
        case '/status': responseText = '📋 工单状态查询中... 请访问 /orders 查看完整看板'; break;
        case '/assign': responseText = `✅ 工单分配指令已发送: ${parts.slice(1).join(' ')}`; break;
        case '/help': responseText = '📖 可用指令: /status 查看工单 | /assign <工单号> <Agent> 分配 | /help 帮助'; break;
        default: responseText = `❓ 未知指令: ${cmd}，输入 /help 查看可用指令`;
      }
      const sysMsg: Message = { id: (Date.now() + 1).toString(), channel: activeChannel, sender: '系统', text: responseText, timestamp: new Date().toISOString(), type: 'system' };
      setTimeout(() => setMessages((prev) => [...prev, sysMsg]), 300);
    }
  }, [activeChannel]);

  const channelMessages = messages.filter((m) => m.channel === activeChannel);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-60' : 'w-0'} transition-all duration-200 overflow-hidden border-r border-gh-border bg-white`}>
        <div className="p-4 border-b border-gh-border">
          <h2 className="font-semibold text-gh-text">💬 聊天频道</h2>
        </div>
        <ChannelList channels={DEFAULT_CHANNELS} active={activeChannel} onSelect={(id) => setActiveChannel(id)} />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-gh-border bg-white flex items-center px-4 gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gh-muted hover:text-gh-text">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="text-lg">#{DEFAULT_CHANNELS.find((c) => c.id === activeChannel)?.name}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gh-bg scrollbar-thin">
          {channelMessages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
