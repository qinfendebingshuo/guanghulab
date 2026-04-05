// ═══════════════════════════════════════════════
// 光湖语言世界 V3 · PM2 大脑服务器代理配置
// 部署在 ZY-SVR-005 (43.156.237.110) · 大脑服务器
//
// V3独立于V2运行，测试通过后切换Nginx即可
// V2进程 (ecosystem.brain-proxy.config.js) 继续运行
//
// 切换方式:
//   测试中: /api/proxy-v3/ → 3805
//   切换后: /api/proxy-v2/ → 3805 (Nginx改一行)
// ═══════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: 'zy-proxy-v3-sub',
      version: '3.0.0',
      script: '/opt/zhuyuan-brain/proxy/service/subscription-server-v3.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_PROXY_V3_PORT: 3805,
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '128M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/subscription-v3.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/subscription-v3-error.log',
      time: true
    },
    {
      name: 'zy-proxy-guardian',
      version: '3.0.0',
      script: '/opt/zhuyuan-brain/proxy/service/proxy-guardian.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_PROXY_DATA_DIR: '/opt/zhuyuan-brain/proxy/data',
        ZY_PROXY_LOG_DIR: '/opt/zhuyuan-brain/proxy/logs',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/guardian.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/guardian-error.log',
      time: true
    },
    {
      name: 'zy-reverse-boost',
      version: '3.0.0',
      script: '/opt/zhuyuan-brain/proxy/service/reverse-boost-agent.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/reverse-boost.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/reverse-boost-error.log',
      time: true
    }
  ]
};
