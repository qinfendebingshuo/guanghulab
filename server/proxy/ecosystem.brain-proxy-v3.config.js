// ═══════════════════════════════════════════════
// 光湖语言世界 ∞+1 · PM2 大脑服务器代理配置
// 部署在 ZY-SVR-005 (43.156.237.110) · 大脑服务器
//
// ∞+1 版本在∞基础上新增:
//   - zy-bandwidth-pool: 带宽汇聚Agent (用户带宽共享加速)
//   - zy-swarm-defense: 蜂群防御Agent (融合/分裂·Moving Target Defense)
//   - zy-user-guardian: 用户守护Agent (每线守护·自毁机制)
//
// ∞ 版本模块:
//   - zy-auto-evolution: 自主进化引擎 (调度所有定时任务)
//   - zy-protocol-mirror: 协议镜像引擎 (Xray自动更新)
//
// V2进程 (ecosystem.brain-proxy.config.js) 继续运行
// ═══════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: 'zy-proxy-v3-sub',
      version: '∞+1',
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
      version: '∞+1',
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
      version: '∞+1',
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
    },
    {
      name: 'zy-auto-evolution',
      version: '∞+1',
      script: '/opt/zhuyuan-brain/proxy/service/auto-evolution.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy',
        ZY_PROXY_DATA_DIR: '/opt/zhuyuan-brain/proxy/data',
        ZY_PROXY_LOG_DIR: '/opt/zhuyuan-brain/proxy/logs'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/auto-evolution.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/auto-evolution-error.log',
      time: true
    },
    {
      name: 'zy-protocol-mirror',
      version: '∞+1',
      script: '/opt/zhuyuan-brain/proxy/service/protocol-mirror.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy',
        ZY_PROXY_DATA_DIR: '/opt/zhuyuan-brain/proxy/data',
        ZY_PROXY_LOG_DIR: '/opt/zhuyuan-brain/proxy/logs'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/protocol-mirror.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/protocol-mirror-error.log',
      time: true
    },
    // ∞+1 新增: 带宽汇聚Agent
    {
      name: 'zy-bandwidth-pool',
      version: '∞+1',
      script: '/opt/zhuyuan-brain/proxy/service/bandwidth-pool-agent.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/bandwidth-pool.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/bandwidth-pool-error.log',
      time: true
    },
    // ∞+1 新增: 蜂群防御Agent
    {
      name: 'zy-swarm-defense',
      version: '∞+1',
      script: '/opt/zhuyuan-brain/proxy/service/swarm-defense-agent.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/swarm-defense.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/swarm-defense-error.log',
      time: true
    },
    // ∞+1 新增: 用户守护Agent
    {
      name: 'zy-user-guardian',
      version: '∞+1',
      script: '/opt/zhuyuan-brain/proxy/service/user-guardian-agent.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/user-guardian.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/user-guardian-error.log',
      time: true
    }
  ]
};
