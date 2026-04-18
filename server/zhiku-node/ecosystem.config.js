/**
 * ═══════════════════════════════════════════════════════════
 * PM2 生态配置 · 光湖智库节点 · guanghu.online
 * ═══════════════════════════════════════════════════════════
 *
 * 项目编号: ZY-PROJ-006
 * 服务器:   ZY-SVR-006 (43.153.203.105 · 新加坡)
 * 守护:     铸渊 · ICE-GL-ZY001
 * 版权:     国作登字-2026-A-00037559
 *
 * 启动命令:
 *   cd /opt/zhiku && pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const path = require('path');
const envFile = path.join(__dirname, 'server', '.env');

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
    {
      name: 'zhiku-api',
      script: 'server/server.js',
      cwd: '/opt/zhiku',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '256M',
      log_file: '/var/log/zhiku/pm2-zhiku-api.log',
      error_file: '/var/log/zhiku/pm2-zhiku-api-error.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        ...envOverrides
      }
    },
    // FQWeb (番茄小说 API 服务 · Kotlin JAR · port 9999)
    // 仅当 JAR 文件存在时启动 · 由 setup-datasources 部署
    {
      name: 'fqweb',
      script: 'start.sh',
      cwd: '/opt/zhiku/datasources/fqweb',
      interpreter: '/bin/bash',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      log_file: '/var/log/zhiku/fqweb.log',
      error_file: '/var/log/zhiku/fqweb-error.log',
      merge_logs: true,
      time: true,
      // 如果 JAR 不存在不报错（PM2 会标记为 errored）
      env: {
        JAVA_OPTS: '-Xmx256m'
      }
    },
    // SwiftCat (七猫小说下载器 · Python · port 7700)
    // 仅当代码存在时启动 · 由 setup-datasources 部署
    {
      name: 'swiftcat',
      script: 'start.sh',
      cwd: '/opt/zhiku/datasources/swiftcat',
      interpreter: '/bin/bash',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '256M',
      log_file: '/var/log/zhiku/swiftcat.log',
      error_file: '/var/log/zhiku/swiftcat-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
