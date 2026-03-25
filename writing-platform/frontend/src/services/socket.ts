import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export function createSocket(token: string): Socket {
  return io(SOCKET_URL, {
    path: '/writing-ai/',
    auth: { token },
    transports: ['websocket'],
  });
}
