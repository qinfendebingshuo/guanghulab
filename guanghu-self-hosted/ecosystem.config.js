/**
 * 光湖网站 · PM2进程管理配置
 * GH-INT-001 · 统一启动所有服务
 *
 * 使用方式:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 logs
 *   pm2 stop all
 */
module.exports = {
  apps: [
    // ==================== 1. Next.js 前端 ====================
    {
      name: 'guanghu-web',
      cwd: './guanghu-web',
      script: 'npm',
      args: 'start',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: '/api',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:8765/ws',
        API_UPSTREAM_URL: 'http://localhost:8000',
        CORS_ORIGIN: 'http://localhost:3000',
      },
      env_development: {
        PORT: 3000,
        NODE_ENV: 'development',
      },
      max_memory_restart: '512M',
      instances: 1,
      exec_mode: 'fork',
    },

    // ==================== 2. 后端API (GH-API-001) ====================
    {
      name: 'guanghu-api',
      cwd: './py-api',
      script: 'uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000',
      interpreter: 'python3',
      env: {
        API_PORT: 8000,
        DATABASE_URL: 'postgresql://guanghu:guanghu_dev@localhost:5432/guanghu_db',
        LOG_LEVEL: 'info',
      },
      max_memory_restart: '256M',
      instances: 1,
      exec_mode: 'fork',
    },

    // ==================== 3. 聊天WebSocket (GH-CHAT-001) ====================
    {
      name: 'guanghu-chat',
      cwd: './web-chat',
      script: 'uvicorn',
      args: 'ws_server:app --host 0.0.0.0 --port 8765',
      interpreter: 'python3',
      env: {
        GH_CHAT_HOST: '0.0.0.0',
        GH_CHAT_PORT: 8765,
        GH_CHAT_CORS_ORIGINS: 'http://localhost:3000',
      },
      max_memory_restart: '128M',
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
