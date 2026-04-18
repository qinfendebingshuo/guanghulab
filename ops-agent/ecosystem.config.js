/**
 * ═══════════════════════════════════════════════════════════
 * 🛡️ 铸渊运维守卫 · PM2 生态系统配置
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-OPS-001
 * 端口: 3950
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 使用: pm2 start ops-agent/ecosystem.config.js
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
          let val = trimmed.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      }
    }
  } catch (e) {
    console.error(`[OPS-PM2] 加载环境变量失败: ${e.message}`);
  }
  return env;
}

// 环境变量加载链（后面的覆盖前面的）
const envChain = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.app'),
  '/opt/zhuyuan/app/.env.app',
  path.join(__dirname, '.env.ops-agent'),
];

let mergedEnv = {};
for (const envFile of envChain) {
  Object.assign(mergedEnv, loadEnvFile(envFile));
}

module.exports = {
  apps: [{
    name: 'ops-agent',
    script: 'index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '128M',
    env: {
      NODE_ENV: 'production',
      OPS_AGENT_PORT: 3950,
      OPS_CHECK_INTERVAL_FAST: 300000,
      OPS_CHECK_INTERVAL_DEEP: 3600000,
      OPS_MAX_REPAIR_RETRIES: 3,
      ...mergedEnv
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/opt/zhuyuan/data/logs/ops-agent-error.log',
    out_file: '/opt/zhuyuan/data/logs/ops-agent-out.log',
    merge_logs: true,
    exp_backoff_restart_delay: 100,
    max_restarts: 15,
    restart_delay: 3000
  }]
};
