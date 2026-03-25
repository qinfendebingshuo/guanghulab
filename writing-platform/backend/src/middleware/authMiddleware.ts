import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/userModel';

const JWT_SECRET = process.env.JWT_SECRET || 'writing-platform-dev-secret-change-in-production';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      role: user.role,
      aiCompanion: user.aiCompanion,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): User {
  return jwt.verify(token, JWT_SECRET) as User;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: true, code: 'UNAUTHORIZED', message: '未提供认证令牌' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: true, code: 'TOKEN_INVALID', message: '认证令牌无效或已过期' });
  }
}
