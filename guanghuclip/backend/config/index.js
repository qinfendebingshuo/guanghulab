/**
 * 光湖短视频工作台 · 配置中心
 * 环境变量统一管理
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3910,

  // 即梦 Seedance API (火山方舟)
  jimeng: {
    apiKey: process.env.ZY_JIMENG_API_KEY || '',
    baseUrl: process.env.JIMENG_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    model: process.env.JIMENG_MODEL || 'seedance-1-5-pro',
  },

  // COS 对象存储 (P1阶段启用)
  cos: {
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: process.env.COS_SECRET_KEY || '',
    bucket: process.env.COS_BUCKET || 'zy-team-hub-sg-1317346199',
    region: process.env.COS_REGION || 'ap-singapore',
  },

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'https://guanghuclip.cn,http://localhost:5173')
    .split(',')
    .map(s => s.trim()),
};
