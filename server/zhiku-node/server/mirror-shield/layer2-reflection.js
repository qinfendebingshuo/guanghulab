/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · Layer 2 · 镜面反射（身份伪装层）
 * ═══════════════════════════════════════════════════════════
 *
 * 对外暴露的服务节点，返回的指纹信息都动态模拟访问者自身的特征
 * 反爬系统看到的"我" = 它自己的镜像 → 系统自保逻辑不会封禁自己
 *
 * 核心哲学: 我是镜子，你看到的是你自己
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/**
 * 常见 Web 服务器指纹池
 * 随机选取或镜像对方的 Server header
 */
const SERVER_FINGERPRINTS = [
  'nginx/1.24.0',
  'Apache/2.4.58 (Ubuntu)',
  'cloudflare',
  'Microsoft-IIS/10.0',
  'openresty/1.21.4.1',
  'Tengine/2.3.3'
];

/**
 * Layer 2 中间件：镜面反射
 *
 * 策略：
 * 1. 移除所有能暴露真实服务身份的响应头
 * 2. 如果请求带有 Server / Via 信息，镜像返回相同的
 * 3. 否则随机选择一个常见服务器指纹
 */
function reflectionMiddleware(req, res, next) {
  // 保存原始 writeHead 用于注入响应头
  const originalWriteHead = res.writeHead.bind(res);

  res.writeHead = function (statusCode, statusMessage, headers) {
    // 获取访问者的 Server 信息（如果有 Via 或 X-Server 头）
    const visitorServer = req.headers['via'] || req.headers['x-server'] || '';

    // 移除暴露真实身份的响应头
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // 镜面反射：如果能识别对方身份，返回对方的 Server 指纹
    if (visitorServer) {
      res.setHeader('Server', visitorServer);
    } else {
      // 随机指纹
      const idx = Math.floor(Math.random() * SERVER_FINGERPRINTS.length);
      res.setHeader('Server', SERVER_FINGERPRINTS[idx]);
    }

    // 移除可能泄露信息的其他头
    res.removeHeader('X-Runtime');
    res.removeHeader('X-Request-Id');

    return originalWriteHead.call(this, statusCode, statusMessage, headers);
  };

  next();
}

module.exports = { reflectionMiddleware };
