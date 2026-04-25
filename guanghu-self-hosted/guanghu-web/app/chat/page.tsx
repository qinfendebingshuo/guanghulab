'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChannelList, Channel } from '@/components/ChannelList';
import { ChatMessage, Message } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { WebSocketClient, WSMessage } from '@/lib/ws';

/**
 * 光湖聊天页面
 * GH-INT-001 集成: 从 GH-CHAT-001 迁入统一Next.js应用
 * WebSocket连接 → ws_server.py(GH-CHAT-001后端)
 * 工单指令 → 通过WebSocket → ws_server → GH-API-001
 */

const DEFAULT_CHANNELS: Channel[] = [
  { id: 'shuangyan', name: '霜砚主频道', type: 'main', status: 'online' },
  { id: 'luce-a02', name: '录册A02', type: 'agent', status: 'online' },
  { id: 'yidian-a05', name: '译典A05', type: 'agent', status: 'offline' },
  { id: 'peiyuan-a04', name: '培园A04', type: 'agent', status: 'offline' },
  { id: 'shuangyan-web', name: '霜砚Web握手体', type: 'agent', status: 'offline' },
];

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [activeChannel, setActiveChannel] = useState<string>('shuangyan');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocketClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765/ws';
    const ws = new WebSocketClient(wsUrl);

    ws.onMessage((msg: WSMessage) => {
      if (msg.type === 'chat') {
        const newMsg: Message = {
          id: msg.id || crypto.randomUUID(),
          channel: msg.channel || 'shuangyan',
          sender: msg.sender || '系统',
          content: msg.content || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          role: msg.role || 'system',
        };
        setMessages((prev) => ({
          ...prev,
          [newMsg.channel]: [...(prev[newMsg.channel] || []), newMsg],
        }));
      } else if (msg.type === 'status') {
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === msg.agentId ? { ...ch, status: msg.status as Channel['status'] } : ch
          )
        );
      } else if (msg.type === 'order_update') {
        const sysMsg: Message = {
          id: crypto.randomUUID(),
          channel: activeChannel,
          sender: '系统',
          content: `📋 工单状态变更: ${msg.content}`,
          timestamp: new Date().toISOString(),
          role: 'system',
        };
        setMessages((prev) => ({
          ...prev,
          [activeChannel]: [...(prev[activeChannel] || []), sysMsg],
        }));
      }
    });

    ws.onOpen(() => setWsConnected(true));
    ws.onClose(() => setWsConnected(false));
    ws.connect();
    wsRef.current = ws;

    return () => { ws.disconnect(); };
  }, [activeChannel]);

  useEffect(() => { scrollToBottom(); }, [messages, activeChannel, scrollToBottom]);

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      const msg: Message = {
        id: crypto.randomUUID(),
        channel: activeChannel,
        sender: '冰朔',
        content,
        timestamp: new Date().toISOString(),
        role: 'user',
      };
      setMessages((prev) => ({ ...prev, [activeChannel]: [...(prev[activeChannel] || []), msg] }));
      wsRef.current?.send({ type: 'chat', channel: activeChannel, content, sender: '冰朔', timestamp: msg.timestamp });
    },
    [activeChannel]
  );

  const currentMessages = messages[activeChannel] || [];
  const currentChannel = channels.find((ch) => ch.id === activeChannel);

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 flex" style= height: 'calc(100vh - 64px)' >
      {/* 左侧: 频道列表 */}
      <div className="w-64 border-r border-gray-800 flex-shrink-0 bg-gray-950">
        <ChannelList channels={channels} activeChannel={activeChannel} onSelectChannel={setActiveChannel} />
      </div>

      {/* 右侧: 消息区 */}
      <div className="flex-1 flex flex-col bg-gray-950 text-white">
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{currentChannel?.name || '选择频道'}</span>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          <span className="text-xs text-gray-500">{wsConnected ? '已连接' : '连接断开'}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {currentMessages.length === 0 && (
            <div className="text-center text-gray-600 mt-10">暂无消息 · 开始对话吧</div>
          )}
          {currentMessages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={handleSend} disabled={!wsConnected} />
      </div>
    </div>
  );
}
