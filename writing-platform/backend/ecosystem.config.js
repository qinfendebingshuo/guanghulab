module.exports = {
  apps: [{
    name: 'writing-platform',
    script: 'dist/server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3100,
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/writing-platform/error.log',
    out_file: '/var/log/writing-platform/out.log',
    merge_logs: true,
    max_memory_restart: '256M',
  }],
};
