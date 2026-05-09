/*
 * pm2 ecosystem · 光湖 Secrets Vault · 国内域名机
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 单 instance, max_memory_restart=128M (2C2G 内存上限保护).
 * 监听 127.0.0.1:8080 — 永不公网, 走 nginx /admin/ 反代.
 */
module.exports = {
  apps: [
    {
      name: "guanghulab-vault",
      script: "./server.js",
      cwd: process.env.VAULT_CWD || __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "128M",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: process.env.VAULT_PORT || "8080",
        HOST: process.env.VAULT_HOST || "127.0.0.1",
        VAULT_DIR: process.env.VAULT_DIR || "/data/guanghulab/secrets-vault",
        PORTAL_DATA_DIR: process.env.PORTAL_DATA_DIR || "/data/guanghulab/portal/data"
      },
      out_file: "/data/guanghulab/_logs/vault-out.log",
      error_file: "/data/guanghulab/_logs/vault-err.log",
      merge_logs: true,
      time: true,
      kill_timeout: 5000
    }
  ]
};
