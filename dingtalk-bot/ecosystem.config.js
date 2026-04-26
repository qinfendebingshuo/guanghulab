// 部署根目录: 通过 DEPLOY_ROOT 环境变量统一配置
// 默认 /opt/guanghu (ZY-SVR-TPL-2026-0426-001 标准)
const path = require('path');
const DEPLOY_ROOT = process.env.DEPLOY_ROOT || '/opt/guanghu';

module.exports = {
  apps: [{
    name: 'dingtalk-stream',
    script: 'index-stream.js',
    cwd: path.join(DEPLOY_ROOT, 'dingtalk-bot'),
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
