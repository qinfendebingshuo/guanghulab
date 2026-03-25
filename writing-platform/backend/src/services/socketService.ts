import { Server } from 'socket.io';
import http from 'http';
import { verifyToken } from '../middleware/authMiddleware';
import { callAI, getWelcomeMessage, buildSystemPrompt } from './aiService';
import { saveConversation } from './notionService';

export function setupSocketService(httpServer: http.Server) {
  const io = new Server(httpServer, {
    path: '/writing-ai/',
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('认证令牌缺失'));
    }
    try {
      const user = verifyToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error('认证失败'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[AI伙伴] ${user.aiCompanion?.name || 'AI'} 已连接 · 用户: ${user.nickname}`);

    // Send welcome message
    socket.emit('ai_response', {
      message: getWelcomeMessage(user),
    });

    socket.on('user_message', async (data: { message: string }) => {
      if (!data.message || typeof data.message !== 'string') {
        socket.emit('ai_response', { message: '请输入有效的消息。' });
        return;
      }

      // Limit message length
      const message = data.message.slice(0, 2000);

      try {
        const systemPrompt = buildSystemPrompt(user);
        const aiResponse = await callAI({
          systemPrompt,
          userMessage: message,
          userId: user.id,
        });

        // Save conversation (non-blocking)
        saveConversation({
          userId: user.id,
          userMessage: message,
          aiResponse,
          timestamp: new Date().toISOString(),
        }).catch((err) => console.error('[Conversation Save] Error:', err));

        socket.emit('ai_response', { message: aiResponse });
      } catch (error: any) {
        console.error('[AI] Error:', error.message);
        socket.emit('ai_response', {
          message: '抱歉，我遇到了一些问题，请稍后再试。',
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[AI伙伴] 用户 ${user.nickname} 已断开连接`);
    });
  });

  return io;
}
