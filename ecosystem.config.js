// 部署根目录: 通过 DEPLOY_ROOT 环境变量统一配置
// 默认 /opt/guanghu (ZY-SVR-TPL-2026-0426-001 标准)
// 兼容旧路径: 若 DEPLOY_ROOT 未设置, 自动检测仓库相对位置
const path = require('path');
const DEPLOY_ROOT = process.env.DEPLOY_ROOT || '/opt/guanghu';

module.exports = {
  apps: [{
    name: 'dingtalk-bot',
    script: 'index.js',
    cwd: path.join(DEPLOY_ROOT, 'dingtalk-bot'),
    node_args: '--preserve-symlinks',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.DINGTALK_BOT_PORT || 3005
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
