// PM2 Ecosystem Configuration for TenPennyNovels
// VPS: OVH Ubuntu (51.83.47.109)
// Usage: pm2 startOrRestart ecosystem.config.js --update-env --env production

module.exports = {
  apps: [
    // ===== FRONTEND APPLICATIONS (Next.js SSR) =====

    {
      name: 'tenpennynovels-landing',
      cwd: './apps/landing',
      script: './node_modules/.bin/next',
      args: 'start -p 4000',
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },

    {
      name: 'tenpennynovels-game',
      cwd: './apps/game',
      script: './node_modules/.bin/next',
      args: 'start -p 4001',
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4001,
      },
    },

    {
      name: 'tenpennynovels-documenti',
      cwd: './apps/documents',
      script: './node_modules/.bin/next',
      args: 'start -p 4002',
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4002,
      },
    },

    {
      name: 'tenpennynovels-gestione',
      cwd: './apps/management',
      script: './node_modules/.bin/next',
      args: 'start -p 4003',
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4003,
      },
    },

    // ===== BACKEND SERVICES =====

    {
      name: 'tenpennynovels-api-gateway',
      cwd: './services/api-gateway',
      script: 'bootstrap.js',
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        CDN_STORAGE_PATH: '/home/ubuntu/tenpennynovels/cdn-storage',
        // AI_GATEWAY_WEBHOOK_SECRET: caricato da services/api-gateway/.env via bootstrap.js
        // (rimosso da qui: era un segreto committato in git — RUOTARLO).
      },
    },

    {
      // FORK mode required: cluster mode crashes with Redis adapter for Socket.IO
      name: 'tenpennynovels-unified-backend',
      cwd: './services/unified-backend',
      script: 'bootstrap.js',
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        CDN_STORAGE_PATH: '/home/ubuntu/tenpennynovels/cdn-storage',
      },
    },

    {
      name: 'tenpennynovels-embeddings-service',
      cwd: './services/embeddings-worker/python',
      script: 'venv/bin/python3',
      args: '-u embedding_server.py',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env_production: {
        PORT: 5001,
      },
    },

    {
      name: 'tenpennynovels-embeddings-worker',
      cwd: './services/embeddings-worker',
      script: 'dist/index.js',
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PYTHON_PATH: 'python/venv/bin/python3',
        HTTP_BIND_HOST: '127.0.0.1',
      },
    },
  ],
};
