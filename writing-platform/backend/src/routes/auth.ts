import { Router, Request, Response } from 'express';
import { sendVerificationCode, verifyCode } from '../services/smsService';
import { createUser, findUserByPhone, updateLastLogin } from '../services/notionService';
import { generateToken } from '../middleware/authMiddleware';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Send verification code
router.post('/send-code', rateLimiter(5, 60000), async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: true, code: 'MISSING_PHONE', message: '请提供手机号' });
    return;
  }

  const result = await sendVerificationCode(phone);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json({ error: true, code: 'SMS_FAILED', message: result.message });
  }
});

// Register
router.post('/register', rateLimiter(5, 60000), async (req: Request, res: Response): Promise<void> => {
  const { phone, code, nickname, realName, role } = req.body;

  // Validation
  if (!phone || !code || !nickname || !role) {
    res.status(400).json({ error: true, code: 'MISSING_FIELDS', message: '请填写所有必填字段' });
    return;
  }

  if (!['author', 'editor', 'operator'].includes(role)) {
    res.status(400).json({ error: true, code: 'INVALID_ROLE', message: '无效的角色类型' });
    return;
  }

  if ((role === 'editor' || role === 'operator') && !realName) {
    res.status(400).json({ error: true, code: 'MISSING_REALNAME', message: '编辑和运营需要填写真实姓名' });
    return;
  }

  // Verify SMS code
  if (!verifyCode(phone, code)) {
    res.status(400).json({ error: true, code: 'INVALID_CODE', message: '验证码无效或已过期' });
    return;
  }

  // Check if user already exists
  const existing = await findUserByPhone(phone);
  if (existing) {
    res.status(409).json({ error: true, code: 'USER_EXISTS', message: '该手机号已注册，请直接登录' });
    return;
  }

  // Create user
  const user = await createUser({ phone, nickname, realName, role });
  const token = generateToken(user);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      role: user.role,
      phone: user.phone,
      aiCompanion: user.aiCompanion,
      creditScore: user.creditScore,
    },
  });
});

// Login
router.post('/login', rateLimiter(10, 60000), async (req: Request, res: Response): Promise<void> => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    res.status(400).json({ error: true, code: 'MISSING_FIELDS', message: '请提供手机号和验证码' });
    return;
  }

  // Verify SMS code
  if (!verifyCode(phone, code)) {
    res.status(400).json({ error: true, code: 'INVALID_CODE', message: '验证码无效或已过期' });
    return;
  }

  // Find user
  const user = await findUserByPhone(phone);
  if (!user) {
    res.status(404).json({ error: true, code: 'USER_NOT_FOUND', message: '用户不存在，请先注册' });
    return;
  }

  // Update last login
  await updateLastLogin(user.id, phone);

  const token = generateToken(user);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      role: user.role,
      phone: user.phone,
      aiCompanion: user.aiCompanion,
      creditScore: user.creditScore,
    },
  });
});

export default router;
