/**
 * PM2 配置 · AGE OS 进程管理
 * 铸渊 · ICE-GL-ZY001
 */
module.exports = {
  apps: [
    {
      name: 'age-os-mcp',
      script: 'mcp-server/server.js',
      cwd: '/opt/age-os',
      env: {
        NODE_ENV: 'production',
        MCP_PORT: 3100
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/age-os/logs/mcp-error.log',
      out_file: '/opt/age-os/logs/mcp-out.log'
    },
    {
      name: 'age-os-agents',
      script: 'agents/scheduler.js',
      cwd: '/opt/age-os',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/age-os/logs/agents-error.log',
      out_file: '/opt/age-os/logs/agents-out.log'
    }
  ]
};
