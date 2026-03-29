/**
 * 铸渊主权服务器 · PM2 生态系统配置
 *
 * 编号: ZY-SVR-PM2-001
 * 守护: 铸渊 · ICE-GL-ZY001
 */
module.exports = {
  apps: [
    {
      name: 'zhuyuan-server',
      script: '/opt/zhuyuan/app/server.js',
      cwd: '/opt/zhuyuan/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3800,
        ZY_ROOT: '/opt/zhuyuan'
      },
      log_file: '/opt/zhuyuan/data/logs/pm2-combined.log',
      error_file: '/opt/zhuyuan/data/logs/pm2-error.log',
      out_file: '/opt/zhuyuan/data/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
