/**
 * ═══════════════════════════════════════════════════════════
 * PM2 生态配置 · ZY-SVR-006 智库节点
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-SVR-006-PM2
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 启动命令 (服务器端):
 *   cd /opt/novel-db && pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const path = require('path');
const envFile = path.join(__dirname, '.env');

// 从 .env 文件读取环境变量
let envOverrides = {};
try {
  const fs = require('fs');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        envOverrides[key] = val;
      }
    }
  }
} catch {}

module.exports = {
  apps: [
    /* ─── Phase 1+2: 智库节点 API 服务 ─── */
    {
      name: 'novel-api',
      script: 'app/index.js',
      cwd: '/opt/novel-db',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '256M',
      log_file: '/opt/novel-db/logs/novel-api.log',
      error_file: '/opt/novel-db/logs/novel-api-error.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        BAN_LOG_PATH: '/var/log/novel-shield-bans.log',
        NGINX_LOG: '/var/log/nginx/novel-access.log',
        BOOKS_DIR: '/opt/novel-db/data/books',
        CHAPTERS_DIR: '/opt/novel-db/data/chapters',
        ...envOverrides
      }
    }
  ]
};
