// 光湖网站 · PM2 统一进程管理
// GH-INT-001

module.exports = {
  apps: [
    {
      name: 'guanghu-web',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
    {
      name: 'guanghu-api',
      cwd: './api',
      script: 'uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000',
      interpreter: 'python3',
      env: {
        API_PORT: 8000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
    },
    {
      name: 'guanghu-ws',
      cwd: './ws',
      script: 'server.py',
      interpreter: 'python3',
      env: {
        WS_PORT: 8765,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '128M',
    },
  ],
};
