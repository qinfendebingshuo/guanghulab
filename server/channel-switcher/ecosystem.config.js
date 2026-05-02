// PM2 生态配置 · channel-switcher (母编号 × 子编号 切换器 · Phase 1 只读)
// 部署位置: /opt/guanghu/channel-switcher/ecosystem.config.js
// 进程名:   channel-switcher
// 端口:     39000 (仅 127.0.0.1, 由 Nginx 反代 /__switch)

'use strict';

module.exports = {
  apps: [
    {
      name: 'channel-switcher',
      script: 'server.js',
      cwd: process.env.CHANNEL_SWITCHER_CWD || '/opt/guanghu/channel-switcher',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '128M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        CHANNEL_SWITCHER_BIND: '127.0.0.1',
        CHANNEL_SWITCHER_PORT: 39000,
        CHANNEL_SWITCHER_SERVER_ID: process.env.CHANNEL_SWITCHER_SERVER_ID || 'ZY-SVR-006',
        FUNCTION_MANIFEST_PATH:
          process.env.FUNCTION_MANIFEST_PATH || '/opt/guanghu/_manifest/function-manifest.json'
      },
      out_file: '/var/log/channel-switcher/out.log',
      error_file: '/var/log/channel-switcher/err.log',
      merge_logs: true,
      time: true
    }
  ]
};
