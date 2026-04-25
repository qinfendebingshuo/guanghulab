import React from 'react';

export interface Message {
  id: string;
  channel: string;
  sender: string;
  content: string;
  timestamp: string;
  role: 'user' | 'agent' | 'system';
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { sender, content, timestamp, role } = message;

  const renderContent = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded text-sm">$1</code>')
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-blue-400 underline" target="_blank" rel="noopener">$1</a>'
      )
      .replace(/\n/g, '<br />');
  };

  const timeStr = new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const roleStyles: Record<string, string> = {
    user: 'bg-blue-900/40 border-blue-700/50',
    agent: 'bg-purple-900/30 border-purple-700/50',
    system: 'bg-gray-800/50 border-gray-700/50',
  };

  const roleBadge: Record<string, string> = {
    user: '👤',
    agent: '🤖',
    system: '⚙️',
  };

  return (
    <div
      className={`rounded-lg border p-3 ${roleStyles[role] || roleStyles.system}`}
      data-testid="chat-message"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span>{roleBadge[role] || '💬'}</span>
          <span className="font-medium text-sm">{sender}</span>
        </div>
        <span className="text-xs text-gray-500">{timeStr}</span>
      </div>
      <div
        className="text-sm text-gray-200 leading-relaxed"
        dangerouslySetInnerHTML= __html: renderContent(content) 
      />
    </div>
  );
}
