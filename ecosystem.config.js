// ecosystem.config.js
// PM2 进程管理配置

module.exports = {
  apps: [
    {
      name: 'guanghulab',
      script: 'src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_test: {
        NODE_ENV: 'test',
        PORT: 3001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
    },
    {
      name: 'api-proxy',
      script: 'backend-integration/api-proxy.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PROXY_PORT: 3721,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/api-proxy-error.log',
      out_file: 'logs/api-proxy-out.log',
    },
    {
      name: 'persona-studio',
      script: 'persona-studio/backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PS_PORT: 3002,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/persona-studio-error.log',
      out_file: 'logs/persona-studio-out.log',
    },
  ],
};
