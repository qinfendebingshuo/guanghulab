import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { createSocket } from '../services/socket';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function useSocket(token: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = createSocket(token);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('ai_response', (data: { message: string; suggestions?: string[] }) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          timestamp: Date.now(),
        },
      ]);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [token]);

  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current) return;
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      },
    ]);
    socketRef.current.emit('user_message', { message });
  }, []);

  return { messages, sendMessage, connected };
}
