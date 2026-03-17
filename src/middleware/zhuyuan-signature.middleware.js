// src/middleware/zhuyuan-signature.middleware.js
// 铸渊指令签名校验中间件 v1.1
// 核心原则：铸渊只认签名，不认请求内容

'use strict';

const {
  verifySignature,
  ERROR_CODES,
} = require('../../scripts/zhuyuan-signature-verify');

/**
 * 从请求中提取签名对象
 * 支持两种来源：
 *   1. 请求头 x-zhuyuan-signature（JSON 字符串）
 *   2. 请求体 _signature 字段
 */
function extractSignature(req) {
  // 优先从 header 提取
  const headerSig = req.headers['x-zhuyuan-signature'];
  if (headerSig) {
    try {
      return JSON.parse(headerSig);
    } catch (_e) {
      return null;
    }
  }

  // 其次从 body._signature 提取
  if (req.body && req.body._signature) {
    return req.body._signature;
  }

  return null;
}

/**
 * 铸渊签名校验中间件工厂
 * @param {object} [options]
 * @param {string} [options.operation] - 固定操作类型（不从请求中推断）
 * @param {string} [options.registryPath] - 自定义注册表路径
 * @returns {Function} Express 中间件
 */
function zhuyuanSignature(options) {
  const opts = options || {};

  return function (req, res, next) {
    const signature = extractSignature(req);

    if (!signature) {
      return res.status(401).json({
        error: true,
        code: ERROR_CODES.NO_SIGNATURE,
        message: '请求缺少铸渊指令签名（x-zhuyuan-signature header 或 _signature body 字段）',
      });
    }

    // 从请求中推断操作类型（如果未固定）
    const operation = opts.operation || req.headers['x-zhuyuan-operation'] || null;

    const result = verifySignature(signature, operation, {
      registryPath: opts.registryPath,
    });

    if (!result.success) {
      const statusMap = {
        [ERROR_CODES.NO_SIGNATURE]: 401,
        [ERROR_CODES.UNKNOWN_SENDER]: 403,
        [ERROR_CODES.PERMISSION_DENIED]: 403,
      };

      return res.status(statusMap[result.code] || 403).json({
        error: true,
        code: result.code,
        message: result.error,
        detail: result.detail,
      });
    }

    // 校验通过：将发送者信息挂载到 req
    req.zhuyuanSender = result.sender;
    req.zhuyuanSignature = signature;
    next();
  };
}

module.exports = zhuyuanSignature;
module.exports.extractSignature = extractSignature;
