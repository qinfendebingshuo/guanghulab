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

  // ── 国内大模型 (4个官方API) ──────────────────────────
  llm: {
    qianwen: {
      apiKey: process.env.ZY_QIANWEN_API_KEY || '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: process.env.QIANWEN_MODEL || 'qwen-plus',
    },
    deepseek: {
      apiKey: process.env.ZY_DEEPSEEK_API_KEY || '',
      baseUrl: 'https://api.deepseek.com/v1',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    },
    kimi: {
      apiKey: process.env.ZY_KIMI_API_KEY || '',
      baseUrl: 'https://api.moonshot.cn/v1',
      model: process.env.KIMI_MODEL || 'moonshot-v1-8k',
    },
    zhipu: {
      apiKey: process.env.ZY_QINGYAN_API_KEY || '',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: process.env.ZHIPU_MODEL || 'glm-4-flash',
    },
  },

  // ── Notion 数据库桥接 ──────────────────────────────
  notion: {
    token: process.env.ZY_NOTION_TOKEN || '',
    // 常用数据库ID（可在.env中配置，人格体可直接引用）
    databases: {
      ...(process.env.ZY_NOTION_SYSLOG_DB ? { '系统日志': process.env.ZY_NOTION_SYSLOG_DB } : {}),
      ...(process.env.ZY_NOTION_TICKET_DB ? { '工单': process.env.ZY_NOTION_TICKET_DB } : {}),
      ...(process.env.ZY_NOTION_CHANGELOG_DB ? { '变更日志': process.env.ZY_NOTION_CHANGELOG_DB } : {}),
    },
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
