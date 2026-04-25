'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChannelList, Channel } from '../components/ChannelList';
import { ChatMessage, Message } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { WebSocketClient, WSMessage } from '../lib/ws';

// 默认频道列表
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

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 初始化WebSocket连接
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
        // Agent状态变更
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === msg.agentId ? { ...ch, status: msg.status as Channel['status'] } : ch
          )
        );
      } else if (msg.type === 'order_update') {
        // 工单状态变更通知
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

    return () => {
      ws.disconnect();
    };
  }, [activeChannel]);

  // 自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChannel, scrollToBottom]);

  // 发送消息
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

      // 本地立即显示
      setMessages((prev) => ({
        ...prev,
        [activeChannel]: [...(prev[activeChannel] || []), msg],
      }));

      // 通过WebSocket发送
      wsRef.current?.send({
        type: 'chat',
        channel: activeChannel,
        content,
        sender: '冰朔',
        timestamp: msg.timestamp,
      });
    },
    [activeChannel]
  );

  const currentMessages = messages[activeChannel] || [];
  const currentChannel = channels.find((ch) => ch.id === activeChannel);

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* 左侧: 频道列表 */}
      <div className="w-64 border-r border-gray-800 flex-shrink-0">
        <ChannelList
          channels={channels}
          activeChannel={activeChannel}
          onSelectChannel={setActiveChannel}
        />
      </div>

      {/* 右侧: 消息区 */}
      <div className="flex-1 flex flex-col">
        {/* 频道标题栏 */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {currentChannel?.name || '选择频道'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          </div>
          <span className="text-xs text-gray-500">
            {wsConnected ? '已连接' : '连接断开'}
          </span>
        </div>

        {/* 消息流 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {currentMessages.length === 0 && (
            <div className="text-center text-gray-600 mt-10">
              暂无消息 · 开始对话吧
            </div>
          )}
          {currentMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <ChatInput onSend={handleSend} disabled={!wsConnected} />
      </div>
    </div>
  );
}
