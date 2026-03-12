// src/middleware/hli-validator.middleware.js
// HLI Schema 自动校验中间件：根据路由自动加载对应 schema 校验请求体

const fs = require('fs');
const path = require('path');

module.exports = function hliValidator(req, res, next) {
  // 从路径中解析 domain 和 action，例如 /hli/auth/login → auth/login
  const match = req.path.match(/^\/hli\/([^/]+)\/([^/]+)/);
  if (!match) return next();

  const [, domain, action] = match;
  const schemaPath = path.join(
    __dirname,
    '../schemas/hli',
    domain,
    `${action}.schema.json`
  );

  if (!fs.existsSync(schemaPath)) return next();

  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (_) {
    return next();
  }

  // 简单必填字段校验（生产环境可替换为 ajv 等标准校验库）
  const required = schema.input && schema.input.required;
  if (required && req.method !== 'GET') {
    for (const field of required) {
      if (req.body[field] === undefined || req.body[field] === '') {
        return res.status(400).json({
          error: true,
          code: 'VALIDATION_ERROR',
          message: `缺少必填字段: ${field}`,
        });
      }
    }
  }

  next();
};
