/**
 * GMP-Agent 配置加载器
 * 零硬编码 · 环境变量驱动 · 合理默认值
 */

const path = require('path');

function loadConfig() {
  const baseDir = process.env.GMP_BASE_DIR || process.cwd();

  return {
    // 服务配置
    port: parseInt(process.env.GMP_PORT || '4000', 10),
    version: process.env.GMP_VERSION || '0.1.0',

    // 目录配置
    baseDir: baseDir,
    modulesDir: process.env.GMP_MODULES_DIR || path.join(baseDir, 'modules'),
    logsDir: process.env.GMP_LOGS_DIR || path.join(baseDir, 'logs'),
    tempDir: process.env.GMP_TEMP_DIR || path.join(baseDir, 'tmp'),

    // GitHub配置
    defaultRepoUrl: process.env.GMP_REPO_URL || 'https://github.com/qinfendebingshuo/guanghulab.git',
    targetBranch: process.env.GMP_TARGET_BRANCH || 'main',
    webhookSecret: process.env.GMP_WEBHOOK_SECRET || '',

    // 安全配置
    apiKey: process.env.GMP_API_KEY || '',
    allowedOrigins: (process.env.GMP_ALLOWED_ORIGINS || '*').split(','),

    // 超时配置 (毫秒)
    cloneTimeout: parseInt(process.env.GMP_CLONE_TIMEOUT || '120000', 10),
    installTimeout: parseInt(process.env.GMP_INSTALL_TIMEOUT || '180000', 10),
    selfCheckTimeout: parseInt(process.env.GMP_SELFCHECK_TIMEOUT || '60000', 10)
  };
}

module.exports = { loadConfig };
