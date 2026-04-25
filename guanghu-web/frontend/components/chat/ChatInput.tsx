'use client';

import { useState, useRef, type KeyboardEvent } from 'react';

export default function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="border-t border-gh-border bg-white p-4">
      <div className="flex gap-2">
        <input ref={inputRef} type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入消息... (/help 查看指令)" className="flex-1 px-4 py-2 border border-gh-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gh-primary/30 focus:border-gh-primary" />
        <button onClick={handleSend} disabled={!text.trim()} className="px-4 py-2 bg-gh-primary text-white rounded-lg text-sm font-medium hover:bg-gh-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors">发送</button>
      </div>
      <div className="mt-1 text-xs text-gh-muted">快捷指令: /status 查询工单 · /assign 分配工单 · /help 帮助</div>
    </div>
  );
}
