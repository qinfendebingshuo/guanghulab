'use client';

import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

// 工单快捷指令提示
const COMMAND_HINTS: Record<string, string> = {
  '/order create': '/order create {标题} — 创建工单',
  '/order status': '/order status — 查看所有工单状态',
  '/order assign': '/order assign {编号} {Agent} — 分配工单',
  '/deploy': '/deploy {模块} — 触发部署(预留)',
};

/**
 * 聊天输入框组件
 * 支持工单快捷指令 · Enter发送 · Shift+Enter换行
 */
export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showHints, setShowHints] = useState(false);
  const [matchedHints, setMatchedHints] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检测指令前缀
  const checkCommands = useCallback((value: string) => {
    if (value.startsWith('/')) {
      const matches = Object.keys(COMMAND_HINTS).filter((cmd) =>
        cmd.startsWith(value.split(' ')[0])
      );
      setMatchedHints(matches);
      setShowHints(matches.length > 0);
    } else {
      setShowHints(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    checkCommands(value);

    // 自动调整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSend = useCallback(() => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      setShowHints(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHintClick = (cmd: string) => {
    setInput(cmd + ' ');
    setShowHints(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-gray-800 p-3 relative">
      {/* 指令提示 */}
      {showHints && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg">
          {matchedHints.map((cmd) => (
            <button
              key={cmd}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg"
              onClick={() => handleHintClick(cmd)}
            >
              {COMMAND_HINTS[cmd]}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? '连接断开 · 等待重连...' : '输入消息 · 支持 /order 快捷指令'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-600 disabled:opacity-50"
          data-testid="chat-input"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="send-button"
        >
          发送
        </button>
      </div>
    </div>
  );
}
