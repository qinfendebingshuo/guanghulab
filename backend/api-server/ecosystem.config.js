/**
 * PM2 生态系统配置 · 光湖后端中间层
 *
 * 版权：国作登字-2026-A-00037559
 */

module.exports = {
  apps: [{
    name: 'guanghu-api',
    script: 'server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/guanghu-api/error.log',
    out_file: '/var/log/guanghu-api/out.log',
    merge_logs: true,
    max_memory_restart: '256M'
  }]
};
