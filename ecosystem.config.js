// ecosystem.config.js
// PM2 进程管理配置
//
// 注意：进程名必须与 deploy-to-server.yml 中的 --name 参数保持一致。
// 当前活跃服务（2026-03 更新）：
//   guanghulab        → HLI 中间层          → 端口 3001（/api/v1/）
//   guanghulab-proxy  → AI Chat API 代理    → 端口 3721
//   guanghulab-backend → Express 后端 API   → 端口 3000（/webhook/feishu）
//   guanghulab-ws     → Status Board WS     → 端口 8080
//   persona-studio    → Persona Studio API  → 端口 3002（/api/ps/）

module.exports = {
  apps: [
    {
      name: 'guanghulab',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/hli-error.log',
      out_file: 'logs/hli-out.log',
    },
    {
      name: 'guanghulab-proxy',
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
      name: 'guanghulab-backend',
      script: 'backend/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/backend-error.log',
      out_file: 'logs/backend-out.log',
    },
    {
      name: 'guanghulab-ws',
      script: 'status-board/mock-ws-server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/ws-error.log',
      out_file: 'logs/ws-out.log',
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
