/**
 * API鉴权中间件
 * Phase A：简单Token鉴权
 * Token通过环境变量 BRAIN_API_TOKEN 配置
 */

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header'
    });
  }

  const token = authHeader.slice(7);
  const expectedToken = process.env.BRAIN_API_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      error: true,
      code: 'CONFIG_ERROR',
      message: 'BRAIN_API_TOKEN not configured on server'
    });
  }

  if (token !== expectedToken) {
    return res.status(403).json({
      error: true,
      code: 'FORBIDDEN',
      message: 'Invalid API token'
    });
  }

  next();
};
