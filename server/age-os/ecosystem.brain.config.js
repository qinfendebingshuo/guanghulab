/**
 * PM2 配置 · 大脑服务器进程管理
 * 铸渊 · ICE-GL-ZY001
 * 
 * 运行在 ZY-SVR-005 (43.156.237.110) · 大脑服务器
 * 进程：MCP Server (port 3100) + Agent Scheduler
 */
module.exports = {
  apps: [
    {
      name: 'age-os-mcp',
      script: 'mcp-server/server.js',
      cwd: '/opt/zhuyuan-brain',
      env: {
        NODE_ENV: 'production',
        MCP_PORT: 3100,
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'age_os_brain',
        DB_USER: 'zhuyuan'
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/zhuyuan-brain/logs/mcp-error.log',
      out_file: '/opt/zhuyuan-brain/logs/mcp-out.log',
      merge_logs: true
    },
    {
      name: 'age-os-agents',
      script: 'agents/scheduler.js',
      cwd: '/opt/zhuyuan-brain',
      env: {
        NODE_ENV: 'production',
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_NAME: 'age_os_brain',
        DB_USER: 'zhuyuan'
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/opt/zhuyuan-brain/logs/agents-error.log',
      out_file: '/opt/zhuyuan-brain/logs/agents-out.log',
      merge_logs: true
    }
  ]
};
