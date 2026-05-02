// PM2 生态配置 · FTCHAT (光湖微调模型内测)
// 部署位置: /opt/guanghu/ftchat/ecosystem.config.js
// 进程名:   ftchat-api
// 端口:     3010 (内部, Nginx 反代)

'use strict';

module.exports = {
  apps: [
    {
      name: 'ftchat-api',
      script: 'src/index.js',
      cwd: process.env.FTCHAT_DEPLOY_ROOT || '/opt/guanghu/ftchat',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
        FTCHAT_DATA_DIR: (process.env.FTCHAT_DEPLOY_ROOT || '/opt/guanghu/ftchat') + '/data'
      },
      out_file: '/var/log/ftchat/out.log',
      error_file: '/var/log/ftchat/err.log',
      merge_logs: true,
      time: true
    }
  ]
};
