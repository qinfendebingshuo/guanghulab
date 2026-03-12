// src/middleware/hli-auth.middleware.js
// HLI 鉴权中间件：验证请求携带有效 token

module.exports = function hliAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      code: 'AUTH_TOKEN_MISSING',
      message: '请求缺少 Authorization Bearer token',
    });
  }

  const token = authHeader.slice(7);

  // TODO: 实现真实的 token 校验逻辑（JWT 验证或数据库查询）
  if (!token) {
    return res.status(401).json({
      error: true,
      code: 'AUTH_TOKEN_INVALID',
      message: 'token 无效',
    });
  }

  // 将用户信息挂载到 req 供后续中间件使用
  req.hliUser = { token };
  next();
};
