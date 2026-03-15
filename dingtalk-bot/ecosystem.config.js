module.exports = {
  apps : [{
    name: 'dingtalk-bot',
    script: 'index.js',
    cwd: '/opt/guanghulab-dingtalk/dingtalk-bot',
    node_args: '--preserve-symlinks',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
