module.exports = {
  apps: [
    {
      name: 'telegram-autoreplier',
      script: 'build/main.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 3,
      restart_delay: 1000,
      env: {
        NODE_ENV: 'production',
      }
    }
  ]
}
