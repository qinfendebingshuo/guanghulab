import React from 'react';

export interface Channel {
  id: string;
  name: string;
  type: 'main' | 'agent' | 'system';
  status: 'online' | 'offline' | 'busy';
}

interface ChannelListProps {
  channels: Channel[];
  activeChannel: string;
  onSelectChannel: (channelId: string) => void;
}

const STATUS_COLORS: Record<Channel['status'], string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-600',
  busy: 'bg-yellow-500',
};

const STATUS_LABELS: Record<Channel['status'], string> = {
  online: '在线',
  offline: '离线',
  busy: '忙碌',
};

const TYPE_ICONS: Record<Channel['type'], string> = {
  main: '🖊️',
  agent: '🤖',
  system: '⚙️',
};

/**
 * 频道列表组件
 * 左侧显示所有可用对话频道(霜砚主频道 + 各半体独立频道)
 */
export function ChannelList({ channels, activeChannel, onSelectChannel }: ChannelListProps) {
  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* 标题 */}
      <div className="h-14 border-b border-gray-800 flex items-center px-4">
        <span className="text-lg font-bold text-white">🌊 光湖聊天</span>
      </div>

      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-2">
          <span className="text-xs text-gray-500 uppercase tracking-wide">频道</span>
        </div>
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              activeChannel === channel.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
            }`}
            data-testid={`channel-${channel.id}`}
          >
            <span>{TYPE_ICONS[channel.type]}</span>
            <span className="flex-1 text-sm truncate">{channel.name}</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[channel.status]}`} />
              <span className="text-xs text-gray-600">{STATUS_LABELS[channel.status]}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 底部信息 */}
      <div className="border-t border-gray-800 px-4 py-3">
        <div className="text-xs text-gray-600">GH-CHAT-001 · 光湖聊天系统</div>
      </div>
    </div>
  );
}
