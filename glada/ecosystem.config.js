/**
 * GLADA · PM2 生态系统配置 · ecosystem.config.js
 *
 * 使用：pm2 start glada/ecosystem.config.js
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

const fs = require('fs');
const path = require('path');

/**
 * 加载 .env 文件（复用 cn-llm-relay 的成熟模式）
 * 优先级：.env.glada → 仓库根 .env → 服务器部署 .env.app
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
          env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
        }
      }
    }
  } catch (e) {
    console.error(`[GLADA-PM2] 加载环境变量失败: ${e.message}`);
  }
  return env;
}

// 环境变量加载链（后面的覆盖前面的）
const envChain = [
  path.join(__dirname, '..', '.env'),           // 仓库根 .env
  path.join(__dirname, '..', '.env.app'),        // 服务器部署 .env.app
  path.join(__dirname, '.env.glada'),            // GLADA 专属 .env
];

let mergedEnv = {};
for (const envFile of envChain) {
  Object.assign(mergedEnv, loadEnvFile(envFile));
}

module.exports = {
  apps: [{
    name: 'glada-agent',
    script: 'service.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3900,
      GLADA_PORT: 3900,
      GLADA_POLL_INTERVAL: 30000,
      GLADA_MODEL: 'deepseek-chat',
      GLADA_STOP_ON_FAILURE: 'true',
      // 从 .env 文件链加载 LLM 密钥（部署时由 workflow 写入）
      ...mergedEnv
    },
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/glada/error.log',
    out_file: '/var/log/glada/out.log',
    merge_logs: true,
    // 重启策略
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    restart_delay: 5000
  }]
};
