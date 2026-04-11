/**
 * 铸渊主权服务器 · PM2 生态系统配置
 *
 * 编号: ZY-SVR-PM2-002
 * 架构: 双域名 · 主站(3800) + 预览站(3801)
 * 守护: 铸渊 · ICE-GL-ZY001
 */
const fs = require('fs');
const path = require('path');

/**
 * 加载 .env 文件为对象
 */
function loadEnvFile(filePath) {
  const env = {};
  try {
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim();
          env[key] = val;
        }
      }
    }
  } catch (e) {
    console.error(`加载环境变量文件失败: ${filePath} - ${e.message}`);
  }
  return env;
}

// 加载主应用环境变量（包含LLM API密钥）
const appEnv = loadEnvFile(path.join(__dirname, '.env.app'));

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
        ZY_ROOT: '/opt/zhuyuan',
        ZY_SITE_MODE: 'production',
        ...appEnv
      },
      log_file: '/opt/zhuyuan/data/logs/pm2-combined.log',
      error_file: '/opt/zhuyuan/data/logs/pm2-error.log',
      out_file: '/opt/zhuyuan/data/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'zhuyuan-preview',
      script: '/opt/zhuyuan/app/server.js',
      cwd: '/opt/zhuyuan/app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3801,
        ZY_ROOT: '/opt/zhuyuan',
        ZY_SITE_MODE: 'preview',
        ...appEnv
      },
      log_file: '/opt/zhuyuan/data/logs/pm2-preview-combined.log',
      error_file: '/opt/zhuyuan/data/logs/pm2-preview-error.log',
      out_file: '/opt/zhuyuan/data/logs/pm2-preview-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
