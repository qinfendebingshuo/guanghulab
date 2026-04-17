/**
 * GLADA · PM2 生态系统配置 · ecosystem.config.js
 *
 * 使用：pm2 start glada/ecosystem.config.js
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

module.exports = {
  apps: [{
    name: 'glada-agent',
    script: 'service.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3900,
      GLADA_PORT: 3900,
      GLADA_POLL_INTERVAL: 30000,
      GLADA_MODEL: 'deepseek-chat',
      GLADA_STOP_ON_FAILURE: 'true'
    },
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/glada/error.log',
    out_file: '/var/log/glada/out.log',
    merge_logs: true,
    // 重启策略
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    restart_delay: 5000
  }]
};
