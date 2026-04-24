// PM2 配置 — 光湖短视频工作台
module.exports = {
  apps: [{
    name: 'guanghuclip-api',
    script: './backend/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3910
    },
    error_file: '/opt/guanghuclip/logs/error.log',
    out_file: '/opt/guanghuclip/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M'
  }]
};
