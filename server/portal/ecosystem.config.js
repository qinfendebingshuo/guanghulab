/*
 * pm2 ecosystem · 光湖 Portal · 国内域名机
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 单 instance, max_memory_restart=512M (2C2G 内存上限保护).
 * 日志走 /data/guanghulab/_logs/portal-*.log, 由 logrotate 切 (bootstrap 已配).
 */
module.exports = {
  apps: [
    {
      name: "guanghulab-portal",
      script: "./server.js",
      cwd: process.env.PORTAL_CWD || __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
        HOST: process.env.HOST || "127.0.0.1",
        PORTAL_DATA_DIR: process.env.PORTAL_DATA_DIR || "/data/guanghulab/portal/data"
      },
      out_file: "/data/guanghulab/_logs/portal-out.log",
      error_file: "/data/guanghulab/_logs/portal-err.log",
      merge_logs: true,
      time: true,
      kill_timeout: 5000
    }
  ]
};
