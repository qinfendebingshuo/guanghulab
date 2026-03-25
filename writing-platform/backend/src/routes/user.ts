import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Get current user profile
router.get('/me', rateLimiter(30, 60000), authMiddleware, (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: '未认证' });
    return;
  }

  res.json({
    user: {
      id: req.user.id,
      nickname: req.user.nickname,
      role: req.user.role,
      phone: req.user.phone,
      aiCompanion: req.user.aiCompanion,
      creditScore: req.user.creditScore,
    },
  });
});

export default router;
