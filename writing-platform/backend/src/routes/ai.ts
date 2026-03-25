import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { callAI, buildSystemPrompt } from '../services/aiService';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// REST endpoint for AI chat (alternative to WebSocket)
router.post('/chat', authMiddleware, rateLimiter(30, 60000), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: '未认证' });
    return;
  }

  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: true, code: 'MISSING_MESSAGE', message: '请提供消息内容' });
    return;
  }

  try {
    const systemPrompt = buildSystemPrompt(req.user);
    const aiResponse = await callAI({
      systemPrompt,
      userMessage: message.slice(0, 2000),
      userId: req.user.id,
    });

    res.json({ success: true, message: aiResponse });
  } catch (err: any) {
    res.status(500).json({ error: true, code: 'AI_ERROR', message: err.message || 'AI服务暂时不可用' });
  }
});

export default router;
