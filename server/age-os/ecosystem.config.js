/**
 * PM2 配置 · AGE OS 进程管理
 * 铸渊 · ICE-GL-ZY001
 */
const path = require('path');
const fs = require('fs');

// 读取 .env.mcp 环境变量
function loadEnvFile(envPath) {
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[PM2] .env.mcp 读取错误: ${err.message}`);
    }
  }
  return env;
}

const envFromFile = loadEnvFile(path.join(__dirname, '.env.mcp'));

module.exports = {
  apps: [
    {
      name: 'age-os-mcp',
      script: 'mcp-server/server.js',
      cwd: '/opt/age-os',
      env: {
        NODE_ENV: 'production',
        MCP_PORT: 3100,
        MCP_BIND_HOST: '127.0.0.1',
        ...envFromFile
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/age-os/logs/mcp-error.log',
      out_file: '/opt/age-os/logs/mcp-out.log',
      merge_logs: true,
      // 重启策略：指数退避 + 限制重启次数，防止崩溃→重启死循环
      exp_backoff_restart_delay: 100,
      max_restarts: 15,
      restart_delay: 3000
    },
    {
      name: 'age-os-agents',
      script: 'agents/scheduler.js',
      cwd: '/opt/age-os',
      env: {
        NODE_ENV: 'production',
        ...envFromFile
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/age-os/logs/agents-error.log',
      out_file: '/opt/age-os/logs/agents-out.log',
      merge_logs: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 15,
      restart_delay: 3000
    }
  ]
};
