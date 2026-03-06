# DEPLOYMENT SSR + ANALISI CRITICA FRONTEND - TenPennyNovels

## Context

**DECISIONE ARCHITETTURALE**: L'utente ha deciso di deployare con **SSR su OVH VPS** invece di static export su Serverplan FTP.

### Deployment Architecture:
- **Server**: OVH VPS Ubuntu (misteryinvestigation.it)
- **Path**: `~/tenpennynovels` (`/home/ubuntu/tenpennynovels`)
- **Deploy Method**: rsync da locale a server
- **Process Manager**: PM2 per frontend + backend
- **Web Server**: nginx (NO Apache)
- **DNS**: Serverplan puntamenti DNS redirects to OVH nginx

### Analisi Frontend
Analisi **critica e non accondiscendente** dei problemi architetturali, di configurazione, e di standard nei frontend:
- `apps/game` - Frontend del gioco
- `apps/management` - Pannello admin

**NOTA**: NO Tailwind (l'utente non lo vuole)

---

## 📦 DEPLOYMENT SYSTEM - SSR SU OVH

### Overview

Sistema di deployment automatizzato che:
1. **Build locale** di tutti i frontend (Next.js standalone) e backend (TypeScript)
2. **Prepara cartella `.deploy/`** locale con struttura production
3. **rsync** verso `~/tenpennynovels` su OVH (cancella file obsoleti)
4. **PM2 restart** automatico di frontend + backend services
5. **Health check** per verificare successo deployment

---

### File da Creare/Modificare

#### 1. **Script Deploy Principale**: `scripts/deploy-ssr.sh`

```bash
#!/bin/bash
# ========================================
# TenPennyNovels SSR Deployment Script
# Deploy to OVH VPS with rsync + PM2
# ========================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load .env.deploy
if [ ! -f .env.deploy ]; then
    echo -e "${RED}❌ ERROR: .env.deploy not found!${NC}"
    echo "Copy .env.deploy.example to .env.deploy and configure it."
    exit 1
fi

source .env.deploy

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 TenPennyNovels SSR Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Target: ${YELLOW}${OVH_SSH_USER}@${OVH_SSH_HOST}:${OVH_DEPLOY_PATH}${NC}"
echo ""

# Step 1: Clean local .deploy directory
echo -e "${BLUE}[1/8]${NC} Cleaning local .deploy directory..."
rm -rf .deploy
mkdir -p .deploy

# Step 2: Build Frontends (Next.js standalone)
echo -e "${BLUE}[2/8]${NC} Building frontends..."

FRONTENDS=("landing" "game" "documents" "forum" "management" "tickets")

for app in "${FRONTENDS[@]}"; do
    echo -e "  ${YELLOW}→${NC} Building apps/${app}..."
    cd "apps/${app}"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install --production=false
    fi

    # Build with standalone output
    npm run build

    # Copy standalone output to .deploy
    mkdir -p "../../.deploy/apps/${app}"

    if [ -d ".next/standalone" ]; then
        # Next.js standalone mode
        cp -r .next/standalone "../../.deploy/apps/${app}/"
        cp -r .next/static "../../.deploy/apps/${app}/.next/"
        cp -r public "../../.deploy/apps/${app}/" 2>/dev/null || true
    else
        echo -e "${RED}    ❌ WARNING: No standalone output for ${app}${NC}"
    fi

    cd ../..
done

# Step 3: Build Backends (TypeScript)
echo -e "${BLUE}[3/8]${NC} Building backends..."

BACKENDS=("api-gateway" "unified-backend" "botai-backend" "embeddings-worker")

for service in "${BACKENDS[@]}"; do
    echo -e "  ${YELLOW}→${NC} Building services/${service}..."
    cd "services/${service}"

    if [ ! -d "node_modules" ]; then
        npm install --production=false
    fi

    # Build TypeScript
    npm run build

    # Copy to .deploy
    mkdir -p "../../.deploy/services/${service}"
    cp -r dist "../../.deploy/services/${service}/" 2>/dev/null || true
    cp -r node_modules "../../.deploy/services/${service}/" 2>/dev/null || true
    cp package.json "../../.deploy/services/${service}/"

    cd ../..
done

# Step 4: Copy embeddings-service (Python)
echo -e "${BLUE}[4/8]${NC} Copying embeddings-service..."
mkdir -p .deploy/services/embeddings-service
cp -r services/embeddings-service/* .deploy/services/embeddings-service/

# Step 5: Copy configuration files
echo -e "${BLUE}[5/8]${NC} Copying configuration files..."
cp ecosystem.config.js .deploy/
cp package.json .deploy/
cp -r docs .deploy/ 2>/dev/null || true

# Create logs directory
mkdir -p .deploy/logs

# Step 6: rsync to OVH
echo -e "${BLUE}[6/8]${NC} Syncing to OVH VPS..."
echo -e "  ${YELLOW}→${NC} rsync with options: ${RSYNC_OPTIONS}"

rsync ${RSYNC_OPTIONS} \
    --exclude='.deploy' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.env.local' \
    --exclude='logs/*' \
    .deploy/ "${OVH_SSH_USER}@${OVH_SSH_HOST}:${OVH_DEPLOY_PATH}/"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ rsync failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Files synced successfully${NC}"

# Step 7: Remote PM2 restart
echo -e "${BLUE}[7/8]${NC} Restarting PM2 services on OVH..."

ssh "${OVH_SSH_USER}@${OVH_SSH_HOST}" << 'ENDSSH'
cd ~/tenpennynovels

# Install dependencies on server if needed
echo "📦 Installing production dependencies..."
npm install --production

# Restart PM2 ecosystem
echo "🔄 Restarting PM2 services..."
pm2 restart ecosystem.config.js

# Save PM2 configuration
pm2 save

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "✅ PM2 services restarted"
ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Remote PM2 restart failed!${NC}"
    exit 1
fi

# Step 8: Health checks
echo -e "${BLUE}[8/8]${NC} Running health checks..."

sleep 5  # Wait for services to start

# Check frontend (game)
if curl -f -s -o /dev/null "${HEALTH_CHECK_GAME}" --max-time ${HEALTH_CHECK_TIMEOUT}; then
    echo -e "${GREEN}✅ Game frontend is UP${NC}"
else
    echo -e "${RED}❌ Game frontend is DOWN${NC}"
fi

# Check API Gateway
if curl -f -s -o /dev/null "${HEALTH_CHECK_API}" --max-time ${HEALTH_CHECK_TIMEOUT}; then
    echo -e "${GREEN}✅ API Gateway is UP${NC}"
else
    echo -e "${RED}❌ API Gateway is DOWN${NC}"
fi

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Frontend URLs:"
echo -e "  Landing:    ${YELLOW}https://tenpennynovels.com${NC}"
echo -e "  Game:       ${YELLOW}https://game.tenpennynovels.com${NC}"
echo -e "  Management: ${YELLOW}https://gestione.tenpennynovels.com${NC}"
echo ""
echo -e "API Gateway:  ${YELLOW}${HEALTH_CHECK_API}${NC}"
echo ""
echo -e "SSH into server: ${BLUE}ssh ${OVH_SSH_USER}@${OVH_SSH_HOST}${NC}"
echo -e "Check PM2 status: ${BLUE}pm2 status${NC}"
echo -e "View logs: ${BLUE}pm2 logs${NC}"
echo ""
```

**Permessi**:
```bash
chmod +x scripts/deploy-ssr.sh
```

---

#### 2. **PM2 Ecosystem Config**: `ecosystem.config.js`

```javascript
// PM2 Ecosystem Configuration for TenPennyNovels SSR Deployment
module.exports = {
  apps: [
    // ========================================
    // FRONTEND APPLICATIONS (Next.js Standalone)
    // ========================================

    {
      name: 'frontend-landing',
      cwd: '/home/ubuntu/tenpennynovels/apps/landing/.next/standalone',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/frontend-landing-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/frontend-landing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'frontend-game',
      cwd: '/home/ubuntu/tenpennynovels/apps/game/.next/standalone',
      script: 'server.js',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/frontend-game-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/frontend-game-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'frontend-documents',
      cwd: '/home/ubuntu/tenpennynovels/apps/documents/.next/standalone',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/frontend-documents-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/frontend-documents-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'frontend-forum',
      cwd: '/home/ubuntu/tenpennynovels/apps/forum/.next/standalone',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/frontend-forum-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/frontend-forum-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'frontend-management',
      cwd: '/home/ubuntu/tenpennynovels/apps/management/.next/standalone',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/frontend-management-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/frontend-management-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'frontend-tickets',
      cwd: '/home/ubuntu/tenpennynovels/apps/tickets/.next/standalone',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        HOSTNAME: '0.0.0.0'
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/frontend-tickets-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/frontend-tickets-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ========================================
    // BACKEND SERVICES
    // ========================================

    {
      name: 'api-gateway',
      cwd: '/home/ubuntu/tenpennynovels/services/api-gateway',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/api-gateway-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/api-gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'unified-backend',
      cwd: '/home/ubuntu/tenpennynovels/services/unified-backend',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/unified-backend-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/unified-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'botai-backend',
      cwd: '/home/ubuntu/tenpennynovels/services/botai-backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/botai-backend-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/botai-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // ========================================
    // EMBEDDINGS SERVICES
    // ========================================

    {
      name: 'embeddings-service',
      cwd: '/home/ubuntu/tenpennynovels/services/embeddings-service',
      script: 'venv/bin/python3',
      args: 'embeddings_service.py',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/embeddings-service-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/embeddings-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    {
      name: 'embeddings-worker',
      cwd: '/home/ubuntu/tenpennynovels/services/embeddings-worker',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/embeddings-worker-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/embeddings-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

---

#### 3. **Next.js Config Fix** (Tutti i Frontend)

**`apps/game/next.config.js`** (e stessa modifica per `management`, `landing`, `documents`, `forum`, `tickets`):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ========================================
  // SSR STANDALONE MODE (OVH DEPLOYMENT)
  // ========================================
  output: 'standalone',  // ✅ Abilita SSR con server Node.js

  // Image optimization ABILITATA
  images: {
    unoptimized: false,  // ✅ Next.js Image optimization
    domains: ['api.tenpennynovels.com', 'cdn.tenpennynovels.com'],
  },

  // Trailing slash per compatibilità
  trailingSlash: true,

  // ========================================
  // SECURITY HEADERS (Ora funzionano!)
  // ========================================
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: https://api.tenpennynovels.com;",
          },
        ],
      },
    ];
  },

  // ========================================
  // SASS CONFIGURATION
  // ========================================
  sassOptions: {
    includePaths: ['./src/styles', '../shared-ui/src/styles'],
    quietDeps: true,
    silenceDeprecations: ['legacy-js-api', 'import'],
  },

  // ========================================
  // WEBPACK CONFIGURATION
  // ========================================
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Ignore warnings
    config.ignoreWarnings = [
      { message: /Critical dependency: the request of a dependency is an expression/ },
      { message: /Support for defaultProps will be removed from memo components/ },
    ];

    return config;
  },
};

module.exports = nextConfig;
```

---

#### 4. **Nginx Configuration**: `/etc/nginx/sites-available/tenpennynovels`

```nginx
# ========================================
# TenPennyNovels Nginx Configuration
# Reverse proxy per frontend SSR + backend API
# ========================================

# Landing (tenpennynovels.com)
server {
    listen 80;
    listen [::]:80;
    server_name tenpennynovels.com www.tenpennynovels.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tenpennynovels.com www.tenpennynovels.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

    # Security headers (aggiuntivi a Next.js)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to Next.js frontend-landing (port 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static assets caching
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}

# Game (game.tenpennynovels.com)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name game.tenpennynovels.com;

    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000" always;

    # Proxy to Next.js frontend-game (port 3001)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /_next/static/ {
        proxy_pass http://localhost:3001;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}

# Documents (documenti.tenpennynovels.com)
server {
    listen 443 ssl http2;
    server_name documenti.tenpennynovels.com;
    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Forum (forum.tenpennynovels.com)
server {
    listen 443 ssl http2;
    server_name forum.tenpennynovels.com;
    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Management (gestione.tenpennynovels.com)
server {
    listen 443 ssl http2;
    server_name gestione.tenpennynovels.com;
    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Tickets (supporto.tenpennynovels.com)
server {
    listen 443 ssl http2;
    server_name supporto.tenpennynovels.com;
    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API Gateway (api.tenpennynovels.com)
server {
    listen 443 ssl http2;
    server_name api.tenpennynovels.com;
    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;

    location / {
        # Handle preflight
        if ($request_method = 'OPTIONS') {
            return 204;
        }

        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

#### 5. **Update `.env.deploy`**

Rimuovere sezioni FTP, aggiornare per SSR:

```bash
# ========================================
# TenPennyNovels SSR Deployment Configuration
# ========================================

# OVH VPS Connection
OVH_SSH_HOST=misteryinvestigation.it
OVH_SSH_PORT=22
OVH_SSH_USER=ubuntu
OVH_SSH_KEY_PATH=~/.ssh/tenpennynovels_deploy

# Backend Deployment Path on OVH
OVH_DEPLOY_PATH=/home/ubuntu/tenpennynovels

# Deployment Options
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true

# Build options
RUN_TESTS_BEFORE_DEPLOY=false
CREATE_BACKUP_BEFORE_DEPLOY=false

# Rsync options for deployment
RSYNC_OPTIONS="--archive --compress --verbose --delete --exclude=node_modules --exclude=.git --exclude=logs --exclude=.env --exclude=.env.local"

# Health check URLs (after deployment)
HEALTH_CHECK_API=https://api.tenpennynovels.com/health
HEALTH_CHECK_LANDING=https://tenpennynovels.com
HEALTH_CHECK_GAME=https://game.tenpennynovels.com
HEALTH_CHECK_TIMEOUT=30
```

---

#### 6. **Package.json Script Update**

Aggiungere script deploy:

```json
{
  "scripts": {
    "deploy": "./scripts/deploy-ssr.sh",
    "deploy:dry-run": "echo 'Dry run not implemented yet - use rsync --dry-run manually'"
  }
}
```

---

### Setup Instructions (Step-by-Step)

#### A. **Setup Locale (Development Machine)**

1. **Crea script deploy**:
   ```bash
   mkdir -p scripts
   # Copia script deploy-ssr.sh sopra in scripts/
   chmod +x scripts/deploy-ssr.sh
   ```

2. **Verifica .env.deploy**:
   ```bash
   # Già esiste, verifica che OVH_SSH_HOST e OVH_DEPLOY_PATH siano corretti
   cat .env.deploy
   ```

3. **Update all next.config.js**:
   ```bash
   # Modifica apps/game/next.config.js
   # Modifica apps/management/next.config.js
   # Modifica apps/landing/next.config.js
   # Modifica apps/documents/next.config.js
   # Modifica apps/forum/next.config.js
   # Modifica apps/tickets/next.config.js

   # Cambiare: output: 'export' → output: 'standalone'
   # Cambiare: images.unoptimized: true → false
   ```

4. **Crea ecosystem.config.js root**:
   ```bash
   # Copia ecosystem.config.js sopra nella root del progetto
   ```

---

#### B. **Setup Server OVH (Ubuntu)**

1. **SSH into server**:
   ```bash
   ssh ubuntu@misteryinvestigation.it
   # Password: Z2pAVdqUbFF7
   ```

2. **Verifica Node.js e PM2**:
   ```bash
   node --version  # Should be 22.x
   pm2 --version   # Should be installed

   # If PM2 not installed:
   npm install -g pm2
   ```

3. **Crea directory e logs**:
   ```bash
   cd ~/tenpennynovels
   mkdir -p logs

   # Verifica che .env.production esista con configurazioni corrette
   cat .env.production
   ```

4. **Install nginx** (se non già installato):
   ```bash
   sudo apt update
   sudo apt install -y nginx
   sudo systemctl enable nginx
   sudo systemctl start nginx
   ```

5. **Setup SSL (Let's Encrypt)**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx

   # Ottenere certificato per tutti i domini
   sudo certbot --nginx -d tenpennynovels.com \
                         -d www.tenpennynovels.com \
                         -d game.tenpennynovels.com \
                         -d documenti.tenpennynovels.com \
                         -d forum.tenpennynovels.com \
                         -d gestione.tenpennynovels.com \
                         -d supporto.tenpennynovels.com \
                         -d api.tenpennynovels.com

   # Certificato salvato in /etc/letsencrypt/live/tenpennynovels.com/
   ```

6. **Configurare nginx**:
   ```bash
   sudo nano /etc/nginx/sites-available/tenpennynovels
   # Incolla configurazione nginx sopra

   # Enable site
   sudo ln -s /etc/nginx/sites-available/tenpennynovels /etc/nginx/sites-enabled/

   # Test config
   sudo nginx -t

   # Reload nginx
   sudo systemctl reload nginx
   ```

7. **Configurare firewall**:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp  # SSH
   sudo ufw enable
   ```

---

#### C. **DNS Configuration (Serverplan)**

1. **Login Serverplan control panel**
2. **Modifica DNS records**:

   ```
   # A Records (puntano a OVH VPS IP)
   @ (root)              → A → <OVH_VPS_IP>
   www                   → A → <OVH_VPS_IP>
   game                  → A → <OVH_VPS_IP>
   documenti             → A → <OVH_VPS_IP>
   forum                 → A → <OVH_VPS_IP>
   gestione              → A → <OVH_VPS_IP>
   supporto              → A → <OVH_VPS_IP>
   api                   → A → <OVH_VPS_IP>
   ```

3. **Verifica propagazione DNS**:
   ```bash
   # Locale (dopo 5-10 minuti)
   dig game.tenpennynovels.com
   # Should show OVH IP
   ```

---

#### D. **First Deployment**

1. **Build e deploy**:
   ```bash
   # Locale
   npm run deploy
   ```

2. **Verifica su server**:
   ```bash
   # SSH OVH
   ssh ubuntu@misteryinvestigation.it

   cd ~/tenpennynovels
   pm2 status
   # Dovrebbe mostrare tutti i servizi online

   pm2 logs frontend-game --lines 20
   # Check per errori
   ```

3. **Test frontend**:
   ```bash
   # Browser
   https://game.tenpennynovels.com
   # Dovrebbe caricare il gioco
   ```

---

### Troubleshooting Common Issues

#### Issue 1: PM2 services not starting

```bash
# Check logs
pm2 logs frontend-game --lines 50

# Common fix: missing dependencies
cd ~/tenpennynovels/apps/game/.next/standalone
npm install --production

# Restart
pm2 restart frontend-game
```

#### Issue 2: Nginx 502 Bad Gateway

```bash
# Check PM2 services are running
pm2 status

# Check port is listening
sudo netstat -tulpn | grep 3001

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

#### Issue 3: SSL certificate issues

```bash
# Renew certificate
sudo certbot renew

# Check expiration
sudo certbot certificates
```

#### Issue 4: DNS not resolving

```bash
# Check DNS propagation
dig game.tenpennynovels.com

# Flush local DNS cache (macOS)
sudo dscacheutil -flushcache

# Test with curl
curl -I https://game.tenpennynovels.com
```

---

## 🔴 PROBLEMI CRITICI FRONTEND (Analisi Critica)

### 0. **apps/management: 70% PAGINE NON USANO COMPONENTI RIUTILIZZABILI** ⚠️ **NUOVO**

**Gravità**: **CRITICO - WORST PROBLEM**

L'utente ha creato componenti riutilizzabili per standardizzare layout management:
- `ConfigurableDataTable` - Tabella configurabile con sorting, filtering, pagination
- `SidePanel` - Panel laterale per edit/detail
- `ColumnVisibilityToggle` - Toggle visibilità colonne

**Stato Attuale**:
- ✅ **11 pagine (31%)** usano i componenti: users, characters, tickets, skills, occupations, locations/gestisci
- ❌ **25 pagine (69%)** NON li usano e reinventano la ruota

**I 3 WORST OFFENDERS**:
```
items.tsx         1,134 lines  ← Custom table, NO ConfigurableDataTable
housing.tsx       1,008 lines  ← Custom table, NO ConfigurableDataTable
economy.tsx         803 lines  ← Custom tabs, NO ConfigurableDataTable
```

**Altre pagine che violano**:
- corporations.tsx
- social-classes.tsx
- relationships.tsx
- chat-monitoring.tsx
- documents.tsx
- locations.tsx (main)
- forum.tsx
- messaging.tsx
- membership-requests.tsx
- system/* (audit-logs, broadcast, configurations, maintenance, character-creation-config)

**Impatto**:
1. **Duplicazione codice**: Ogni pagina ha propria implementazione table/forms
2. **Inconsistenza UX**: Experience diversa tra users (con ConfigurableDataTable) e items (custom)
3. **Bug propagation**: Fix devono essere applicati a 25 file separatamente
4. **Maintenance nightmare**: Impossibile aggiungere feature globali (es. export CSV)
5. **Technical debt**: 70% del codice ignora architettura esistente

**Esempio Confronto**:

```typescript
// ✅ CORRETTO - user-list.tsx (335 lines)
<ConfigurableDataTable
  tableName="user-list"
  data={users}
  loading={loading}
  onAction={handleAction}
  pagination={pagination}
/>

// ❌ SBAGLIATO - items.tsx (1,134 lines)
<table className={styles.itemsTable}>
  <thead>
    <tr>
      {/* 50+ lines of custom header */}
    </tr>
  </thead>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        {/* 100+ lines of custom cells */}
      </tr>
    ))}
  </tbody>
</table>
{/* 200+ lines di custom pagination */}
```

**Fix Necessario**: Migrare tutte le 25 pagine a ConfigurableDataTable + SidePanel.

**Priority**: **P0 - BLOCCA TUTTO IL RESTO**. Non ha senso fixare `any` types o aggiungere test se 70% del codice usa architettura sbagliata.

---

#### Migration Strategy: ConfigurableDataTable

**Pattern da Seguire** (da user-list.tsx - 335 lines):

```typescript
// 1. Component structure (100 lines)
export default function ItemsPage({ authContext }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>(null);

  // Use hook for table config
  const { config, columnVisibility, toggleColumnVisibility } = useTableConfig('items');

  return (
    <ManagementLayout authContext={authContext}>
      <ConfigurableDataTable
        tableName="items"
        data={items}
        loading={loading}
        onAction={handleAction}
        onBulkAction={handleBulkAction}
        pagination={pagination}
        externalConfig={{
          config,
          visibleColumns: config.columns.filter(col =>
            columnVisibility[col.key] ?? col.defaultVisible
          )
        }}
      />

      {activeSidePanel && (
        <SidePanel
          isOpen={true}
          config={config.sidePanels[activeSidePanel]}
          data={currentItem}
          onClose={() => setActiveSidePanel(null)}
          onAction={handleSidePanelAction}
        />
      )}
    </ManagementLayout>
  );
}
```

**2. Table Config JSON** (`src/config/tables/items-table.json`):

```json
{
  "table": {
    "name": "items",
    "title": "Gestione Oggetti",
    "pagination": {
      "enabled": true,
      "defaultPageSize": 25
    },
    "sorting": {
      "enabled": true,
      "defaultSort": { "field": "name", "order": "asc" }
    },
    "filtering": {
      "enabled": true
    }
  },
  "columns": [
    {
      "key": "name",
      "label": "Nome",
      "type": "text",
      "sortable": true,
      "defaultVisible": true,
      "alwaysVisible": true
    },
    {
      "key": "category",
      "label": "Categoria",
      "type": "badge",
      "sortable": true,
      "defaultVisible": true
    },
    {
      "key": "value",
      "label": "Valore",
      "type": "number",
      "format": "currency",
      "sortable": true,
      "defaultVisible": true
    }
  ],
  "actions": [
    {
      "key": "edit",
      "label": "Modifica",
      "icon": "edit",
      "confirmation": false
    },
    {
      "key": "delete",
      "label": "Elimina",
      "icon": "trash",
      "confirmation": true,
      "confirmationMessage": "Sei sicuro di voler eliminare questo oggetto?"
    }
  ],
  "sidePanels": {
    "edit": {
      "title": "Modifica {{name}}",
      "width": "medium",
      "fields": [
        {
          "key": "name",
          "label": "Nome",
          "type": "text",
          "required": true
        },
        {
          "key": "category",
          "label": "Categoria",
          "type": "select",
          "options": ["Weapon", "Armor", "Tool", "Consumable"]
        }
      ],
      "actions": [
        { "key": "save", "label": "Salva", "variant": "primary" },
        { "key": "cancel", "label": "Annulla", "variant": "secondary" }
      ]
    }
  }
}
```

**Benefits della Migrazione**:

| Metrica | Prima (Custom) | Dopo (ConfigurableDataTable) | Risparmio |
|---------|---------------|------------------------------|-----------|
| **Linee codice** | 1,134 (items.tsx) | 150 (component) + 100 (config) = 250 | **-78%** |
| **Duplicazione** | 25 pagine × 800 lines avg = 20,000 | 25 × 250 = 6,250 | **-69%** |
| **Manutenzione** | 25 file da modificare | 1 component + 25 config | **96% easier** |
| **Test coverage** | Impossibile (25 files) | Test 1 component = 100% | **∞ better** |
| **Feature add** | 25 file edits | 1 component edit | **96% faster** |

**Migration Checklist per Pagina**:
- [ ] Creare config JSON (`src/config/tables/[page]-table.json`)
- [ ] Sostituire custom `<table>` con `<ConfigurableDataTable>`
- [ ] Sostituire custom modal/drawer con `<SidePanel>`
- [ ] Usare `useTableConfig()` hook
- [ ] Rimuovere custom pagination/sorting/filtering code
- [ ] Test: Verificare che table funzioni identicamente
- [ ] Rimuovere vecchio codice custom (delete 800-1,100 linee)

**Effort Estimate per Pagina**:
- Simple page (< 500 lines): 2-3 ore
- Medium page (500-800 lines): 4-6 ore
- Complex page (> 800 lines): 1 giorno

**Total Migration Effort**:
- 3 complex pages (items, housing, economy): 3 giorni
- 10 medium pages: 5 giorni
- 12 simple pages: 3 giorni
- **Total: 11 giorni lavorativi (2-3 settimane)**

---

### 1. **apps/management: ZERO TEST COVERAGE**

**Gravità**: CRITICO

Il pannello di amministrazione gestisce:
- Permessi utente (security-critical)
- Approvazioni personaggi (validation)
- Transazioni economiche (financial data)
- Moderazione contenuti

**11,604 linee di codice** senza **nemmeno un test**.

```
apps/management/
├── pages/ (27 files, 11,604 TOTAL LINES)
├── components/ (39 files)
└── NO test files, NO jest config, NO testing library
```

**Impatto**: Qualsiasi refactoring è a rischio catastrofico. Bug in produzione garantiti.

**Fix Minimo**: Jest + React Testing Library + coverage minimo 20% su pagine critiche (users, characters, economy).

---

### 2. **Entrambi: Build Configuration ROTTA per Produzione**

**Gravità**: CRITICO

```javascript
// next.config.js (ENTRAMBI I FRONTEND)
module.exports = {
  output: 'export',                  // ❌ Static export = no server runtime
  images: { unoptimized: true },     // ❌ NO image optimization
  trailingSlash: true,               // ❌ Non-standard routing

  async headers() {
    return [{                        // ❌ IGNORED WITH STATIC EXPORT
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' }
      ]
    }]
  }
}
```

**Problemi**:
1. **Static export disabilita**:
   - Server-side rendering (SSR)
   - API routes (completamente inutilizzabili)
   - Redirect server-side
   - Headers di sicurezza (X-Frame-Options, CSP)
   - Incremental Static Regeneration (ISR)

2. **Image optimization DISABILITATA**:
   - `unoptimized: true` = tutte le immagini caricate a dimensione originale
   - Nessun WebP conversion
   - Nessun lazy loading automatico
   - Nessuna compressione

3. **Headers configurati ma IGNORATI**:
   - Commenti nel codice dicono "Kept here for documentation purposes"
   - **FUORVIANTE per gli sviluppatori** - pensano che funzioni, ma non funziona

**Fix Necessario**:
- Decidere: serve SSR o no?
  - Se NO: Rimuovere headers config, documentare che vanno configurati su nginx/apache
  - Se SÌ: Cambiare `output: 'standalone'` e abilitare server runtime
- Abilitare image optimization: rimuovere `unoptimized: true`
- Configurare CDN per immagini (`loader` in next/image)

---

### 3. **apps/management: 307 Violazioni `any` - TypeScript INUTILE**

**Gravità**: CRITICO

```typescript
// lib/api.ts (935 linee)
export interface ApiResponse<T = any> { }           // Default any
export const userAPI = {
  getUser: (userId: string): Promise<ApiResponse<any>>,
  updateCharacter: (characterId: string, data: any) // ❌ Dati non validati
}

// components/ConfigurableDataTable.tsx
externalConfig?: {
  customRenderers?: Record<string, (value: any, item: any) => React.ReactNode>;
}
```

**Impatto**:
- TypeScript strict mode è abilitato ma **completamente bypassato**
- Nessuna type safety su API responses
- Nessuna validazione input form
- Runtime errors garantiti

**Fix Necessario**:
- Creare types per TUTTE le API responses
- Sostituire ogni `any` con type appropriato
- Aggiungere Zod per validation runtime
- Setup ESLint rule: `"@typescript-eslint/no-explicit-any": "error"`

---

### 4. **apps/management: Monoliti da 800-1,134 Linee**

**Gravità**: ALTO

```
pages/
├── items.tsx         1,134 LINES  (UI + logic + API + state)
├── housing.tsx       1,008 LINES
├── economy.tsx         803 LINES
├── characters.tsx      700+ LINES
```

**Pattern Anti-Design**:
```typescript
// pages/economy.tsx - TUTTO in un file
export default function EconomyPage() {
  // 20+ useState hooks
  const [activeTab, setActiveTab] = useState(...);
  const [transactions, setTransactions] = useState(...);
  const [filters, setFilters] = useState(...);

  // Business logic inline
  const fetchTransactions = async () => { /* raw fetch */ };
  const handleGrantSubmit = async () => { /* API call */ };

  // Validation logic inline
  const validateForm = () => { ... };

  // 750 LINES OF JSX
  return ( ... );
}
```

**Problemi**:
- Zero separazione UI/Logic/Data
- Impossibile testare singole funzionalità
- Impossibile riutilizzare componenti
- Git diff ingestibili
- Performance: tutto si re-renderizza insieme

**Fix Necessario**:
- Estrarre hooks custom per ogni logica di business
- Creare componenti presentazionali separati
- Service layer per API calls
- Target: max 300 linee per pagina

---

### 5. **apps/game: Context API Abuse - 5 Provider Nested**

**Gravità**: ALTO

```tsx
// apps/game/src/pages/_app.tsx
<GameProvider>
  <NotificationSettingsProvider>
    <NotificationProvider>
      <CharacterSheetsProvider>
        <WebSocketProvider>
          <Component {...pageProps} />
```

**Problemi**:
1. **Performance**: Ogni provider wrappa l'intera app
   - Qualsiasi update in un context ri-renderizza tutta la app
   - Nessun lazy loading possibile

2. **Tight Coupling**:
   - WebSocketContext duplica state da GameContext
   - Commenti nel codice rivelano bug passati: "✅ REMOVED: currentLocationId"
   - Sync manuale tra context

3. **Props Drilling + Context Mixing**:
   ```tsx
   // GameLayout.tsx
   const { gameData } = useGame();           // Context
   const { currentLocationId } = useWebSocket(); // Context
   // Ma ANCHE props: gameData={gameData}
   ```

**Fix Necessario**:
- Consolidare in 2-3 context MAX
- Usare Context solo per dati truly global (auth, theme)
- Migrare a Zustand/Jotai per state non-React
- Pattern: Context = infrastructure, hooks = business logic

---

## 🟠 PROBLEMI HIGH PRIORITY

### 6. **Entrambi: API Layer FRAGILE - Zero Error Handling**

**apps/game/src/lib/gameApi.ts**:
```typescript
export const GameApiService = {
  async getLocations() {
    const response = await fetch(`${API_BASE}/game/locations`);
    return response.json(); // ❌ NO error check
  }
}
```

**apps/management/src/lib/api.ts** (935 linee):
```typescript
const response = await fetch(url, config);
const data = await response.json();
// ❌ NO retry logic
// ❌ NO timeout handling
// ❌ NO request deduplication
// ❌ NO error interceptors
return data;
```

**Mancanze Critiche**:
- Nessun retry su network failure
- Nessun timeout (infinite wait)
- Nessun error boundary globale
- Nessun circuit breaker pattern
- Nessuna deduplication (stessa richiesta = multipli fetch)
- Nessuna cache strategy (se non manuale in game)

**Fix Necessario**:
- Migrare a **TanStack Query (React Query)**
  - Retry automatico
  - Cache + stale-while-revalidate
  - Request deduplication
  - Error handling centralized

- Oppure: Wrapper custom con axios
  - Interceptors per auth errors
  - Retry exponential backoff
  - Timeout 30s default
  - Logging centralizzato

---

### 7. **apps/management: NO Form Validation Library**

**Gravità**: ALTO

20+ form in tutto il pannello admin, **ZERO validation library**.

```typescript
// Pattern ripetuto 20+ volte
const [formData, setFormData] = useState({ name: '', value: 0 });
const handleSubmit = () => {
  if (!formData.name) { alert('Nome required'); return; }
  if (formData.value < 0) { alert('Value must be positive'); return; }
  // ... 10 more manual checks
}
```

**Problemi**:
- Validation logic scattered across pages
- Inconsistent error messages
- No schema reuse
- No type inference da schema
- Manual casting ovunque

**Fix Necessario**:
- **Zod** per schema validation + type inference
  ```typescript
  const schema = z.object({
    name: z.string().min(1),
    value: z.number().positive()
  });
  type FormData = z.infer<typeof schema>;
  ```

- **React Hook Form** per form state + validation
  ```typescript
  const { register, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(schema)
  });
  ```

---

### 8. **apps/game: UtilityPanel.tsx - 1,044 Linee Single Component**

**Gravità**: ALTO

```typescript
// src/components/utility/UtilityPanel.tsx - 1,044 LINES
export default function UtilityPanel() {
  // Gestisce 5 funzionalità diverse:
  // 1. Ticket system (list + form + thread view)
  // 2. Change password
  // 3. Audio settings
  // 4. Character settings
  // 5. Account deletion

  // 20+ useState hooks
  // 500+ lines di JSX
  // 200+ lines di event handlers
}
```

**Problemi**:
- Violazione SRP (Single Responsibility Principle)
- Carica TUTTO anche se utente vede solo 1 tab
- Impossibile testare singole features
- Git conflicts garantiti con multi-developer

**Fix Necessario**:
- Split in 5 componenti separati:
  ```
  UtilityPanel/
  ├── index.tsx              (100 lines - tabs navigation)
  ├── TicketSystem.tsx       (300 lines)
  ├── PasswordChange.tsx     (100 lines)
  ├── AudioSettings.tsx      (100 lines)
  ├── CharacterSettings.tsx  (200 lines)
  └── AccountDeletion.tsx    (100 lines)
  ```

- Lazy loading per tabs non visibili:
  ```tsx
  const TicketSystem = dynamic(() => import('./TicketSystem'));
  ```

---

### 9. **Entrambi: Dependencies Mismatch & Minimal**

**apps/game**: 24 dependencies
**apps/management**: 7 dependencies (71% MENO!)

**apps/management manca**:
- ❌ Form validation (Zod/Yup)
- ❌ HTTP client (axios/ky)
- ❌ Date utilities (date-fns/dayjs)
- ❌ Utility library (lodash-es)
- ❌ Testing libraries
- ❌ Prettier

**apps/game manca**:
- ❌ Testing libraries (Jest configurato ma non usato)
- ❌ Form validation
- ❌ Bundle analyzer

**Shared Issues**:
- **React 19.2.4** - bleeding edge (Feb 2025)
  - Ecosystem lag: molte librerie non ancora compatibili
  - Rischio instabilità
  - **Downgrade consigliato a React 18** se non si usano features React 19

- **Socket.io-client 4.8.3** - versione locked
  - Nessuna garanzia compatibilità con backend

**Fix Necessario**:
- Allineare dependencies tra game e management
- Aggiungere librerie essenziali mancanti
- Considerare downgrade React 19 → 18 per stabilità

---

### 10. **Entrambi: Cache Strategy INESISTENTE (Management) / MANUALE (Game)**

**apps/management**: ZERO caching
```typescript
// Ogni volta che apri la pagina:
useEffect(() => {
  fetchUsers();      // API call
  fetchCharacters(); // API call
  fetchLocations();  // API call
}, []); // On mount - SEMPRE
```

**apps/game**: Cache manuale custom
```typescript
// src/utils/cache.ts
class CacheManager {
  static set<T>(key: string, data: T, ttl: number) {
    localStorage.setItem(key, JSON.stringify({ data, expire }));
    // ❌ No namespace - collision risk
    // ❌ No size limit - localStorage può riempirsi
    // ❌ Manual invalidation - risk of stale data
  }
}
```

**Problemi**:
- Management: API calls ripetuti inutilmente
- Game: Cache custom buggy e non testato
- Entrambi: Nessuna deduplication (doppia richiesta simultanea = 2 API calls)
- Entrambi: Nessuna invalidation strategy

**Fix Necessario**:
- **TanStack Query** in entrambi:
  ```typescript
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000 // 5 min cache
  });
  ```

- Rimuovere `CacheManager` custom da game
- Setup cache invalidation su mutations

---

## 🟡 PROBLEMI MEDIUM PRIORITY

### 11. **Entrambi: Code Quality Tools MINIMAL**

**Mancanze**:
- ❌ NO Prettier (formatting inconsistente)
- ❌ NO pre-commit hooks (husky/lint-staged)
- ❌ NO import sorting (eslint-plugin-import)
- ❌ NO unused variable detection
- ❌ NO CI/CD linting pipeline

**ESLint Configurato MA**:
- `apps/game`: Nessun `.eslintrc.json` custom
- `apps/management`: Nessun `.eslintrc.json` custom
- Entrambi: Solo `eslint-config-next` default

**Fix Necessario**:
1. **Setup Prettier**:
   ```json
   {
     "semi": true,
     "singleQuote": true,
     "printWidth": 100
   }
   ```

2. **Setup Husky + lint-staged**:
   ```json
   {
     "*.{ts,tsx}": [
       "eslint --fix",
       "prettier --write"
     ]
   }
   ```

3. **ESLint Rules Custom**:
   ```json
   {
     "rules": {
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/no-unused-vars": "error",
       "import/order": ["error", { "groups": ["builtin", "external", "internal"] }]
     }
   }
   ```

---

### 12. **apps/management: WebSocket Infrastructure INUTILIZZATA**

**lib/websocket.ts** (completamente implementato):
```typescript
export class AdminWebSocketService {
  // ✅ Singleton pattern
  // ✅ Reconnection logic
  // ✅ Event typing
  // ✅ useAdminWebSocket hook
  // ❌ MA: NEVER USED in nessuna pagina!
}
```

**Impatto**:
- Dead code (400+ linee)
- Confusione per developer ("perché c'è ma non si usa?")
- Potenziale per real-time updates non sfruttato

**Fix Necessario**:
- **Opzione A**: Implementare real-time updates (character approvals, user status)
- **Opzione B**: Rimuovere tutto il codice WebSocket se non serve

---

### 13. **apps/game: GameLayout.tsx - Mixed Patterns**

```tsx
// GameLayout.tsx (533 lines)
export default function GameLayout({ gameData }: Props) {
  // Props drilling
  const { gameData: contextGameData } = useGame(); // Context

  // Mix di state locale + context + props
  const [localState, setLocalState] = useState();
  const { wsMethod } = useWebSocket();

  // Passa gameData come prop AI figli
  return <Component gameData={gameData} />;
}
```

**Problemi**:
- Confusione: props vs context?
- Doppio source of truth (`gameData` prop + context)
- Componente fa troppo: layout + state management + navigation

**Fix Necessario**:
- Decidere: Context OR Props (non entrambi)
- Separare layout component da state container
- Estrarre navigation logic in hook

---

### 14. **apps/game: Cache Namespace Collision**

```typescript
// cache.ts
static set<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(item)); // ❌ No prefix
}

// Usage: CacheManager.set('game_locations', data)
```

**Problema**: Se altro codice (analytics, tracking) usa `game_*` keys → collision

**Fix**:
```typescript
const APP_PREFIX = 'tenpenny_game_';
localStorage.setItem(APP_PREFIX + key, ...);
```

---

### 15. **Entrambi: Performance - No Code Splitting**

**apps/game**:
- UtilityPanel (1,044 lines) caricato sempre
- No `dynamic()` imports per modals/panels
- GameLayout è 533 lines - dovrebbe essere split

**apps/management**:
- ConfigurableDataTable caricato in 10+ pagine
- Tabelle con 50+ righe senza virtualizzazione
- Nessun lazy loading

**Fix Necessario**:
```tsx
// Dynamic imports per componenti pesanti
const UtilityPanel = dynamic(() => import('./UtilityPanel'), {
  loading: () => <Spinner />,
  ssr: false
});

// Virtualizzazione tabelle
import { useVirtualizer } from '@tanstack/react-virtual';
```

---

## 🔵 NICE TO HAVE (Ma Consigliati)

### 16. **Entrambi: No Bundle Analyzer**

Impossibile sapere:
- Dimensione bundle per route
- Duplicazione dipendenze
- Tree-shaking effectiveness

**Fix**:
```bash
npm i -D @next/bundle-analyzer
```

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
});
module.exports = withBundleAnalyzer({ ... });
```

---

### 17. **Entrambi: No Environment Variables Validation**

`.env` files esistono ma zero validation:

```typescript
// Current:
const API_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'fallback';

// Better (con Zod):
const envSchema = z.object({
  NEXT_PUBLIC_API_GATEWAY_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url()
});

const env = envSchema.parse(process.env);
```

---

### 18. **apps/game: No Error Boundaries**

Nessun error boundary component - se c'è crash React → white screen

**Fix**:
```tsx
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component { ... }

// _app.tsx
<ErrorBoundary>
  <Component {...pageProps} />
</ErrorBoundary>
```

---

### 19. **~~Tailwind CSS~~ - RIMOSSO**

**DECISION**: L'utente NON vuole Tailwind. Mantenere SCSS modules.

**Raccomandazione**: Continuare con SCSS, ma creare design tokens centralizzati in `shared-ui/src/styles/_tokens.scss` per:
- Color palette
- Spacing scale
- Typography scale
- Border radius
- Breakpoints

---

### 20. **apps/management: Name Collision - Due `useAuth()` Hooks**

```typescript
// contexts/AuthContext.tsx
export function useAuth(): AuthContextType { ... }

// lib/auth.ts
export function useAuth(): AuthHookReturn { ... }
```

**Rischio**: Import sbagliato = runtime error

**Fix**: Rename uno dei due:
```typescript
// lib/auth.ts
export function useAuthRequest(): AuthHookReturn { ... }
```

---

## 📊 SCORECARD FINALE

| Criterio | apps/game | apps/management |
|----------|-----------|-----------------|
| **Testing** | 🔴 0% coverage (jest config exists) | 🔴 0% coverage (no setup) |
| **Type Safety** | 🟠 Strict mode ma 30+ `any` | 🔴 307 `any` violations |
| **Build Config** | 🔴 Static export broken | 🔴 Static export broken |
| **Dependencies** | 🟡 24 deps, React 19 risk | 🔴 7 deps, missing essentials |
| **State Management** | 🔴 5 nested contexts | 🟠 Context + props drilling |
| **API Layer** | 🟠 No retry, manual cache | 🔴 No error handling |
| **Code Quality** | 🟡 ESLint only | 🟡 ESLint only |
| **Performance** | 🟠 Image unoptimized | 🟠 Image unoptimized |
| **Component Size** | 🔴 1,044 lines (UtilityPanel) | 🔴 1,134 lines (items.tsx) |
| **Architecture** | 🟡 Good structure, weak patterns | 🔴 Monolithic pages |

**Overall Grade**:
- **apps/game**: 🟠 **D+** (Structurally sound, operationally weak)
- **apps/management**: 🔴 **F** (Functional but fragile, massive tech debt)

---

## 🎯 PRIORITY ROADMAP

### PHASE 1: BLOCKERS (1-2 settimane)

**apps/management** (più critico):
1. ✅ Setup Jest + React Testing Library
2. ✅ Type safety: Fix 307 `any` violations
3. ✅ Split 4 largest pages into components
4. ✅ Add Zod + React Hook Form
5. ✅ Implement proper API error handling

**apps/game**:
1. ✅ Fix build config (decide SSR strategy)
2. ✅ Consolidate contexts (5 → 2-3)
3. ✅ Split UtilityPanel (1,044 → 5 components)
4. ✅ Replace manual cache with TanStack Query

### PHASE 2: HIGH PRIORITY (2-3 settimane)

**Entrambi**:
1. ✅ Migrate to TanStack Query (cache + error handling)
2. ✅ Enable image optimization
3. ✅ Add Prettier + pre-commit hooks
4. ✅ Setup ESLint strict rules + `no-explicit-any`
5. ✅ Add error boundaries
6. ✅ Setup bundle analyzer

### PHASE 3: MEDIUM PRIORITY (4-6 settimane)

**Entrambi**:
1. ✅ Implement code splitting (dynamic imports)
2. ✅ Add table virtualization
3. ✅ Environment validation (Zod)
4. ✅ Setup CI/CD linting + testing
5. ✅ Migrate to React 18 (da React 19 bleeding edge)

### PHASE 4: NICE TO HAVE (Ongoing)

1. ✅ Storybook for component development
2. ✅ E2E testing (Playwright)
3. ✅ Performance monitoring (Web Vitals)
4. ✅ Accessibility audit (WCAG)
5. ✅ Create centralized SCSS design tokens system

---

## 📁 FILE CRITICI DA MODIFICARE

### Deployment (Priority 1):
- `scripts/deploy-ssr.sh` - Deploy script
- `ecosystem.config.js` - PM2 config root
- `apps/*/next.config.js` (6 files) - SSR standalone mode
- `/etc/nginx/sites-available/tenpennynovels` - Nginx config (server)

### apps/management - P0 Architectural Migration (Priority 2):
**25 pagine da migrare a ConfigurableDataTable**:
- `src/pages/items.tsx` (1,134 lines) - Migrate to ConfigurableDataTable
- `src/pages/housing.tsx` (1,008 lines) - Migrate to ConfigurableDataTable
- `src/pages/economy.tsx` (803 lines) - Migrate to ConfigurableDataTable
- `src/pages/corporations.tsx` - Migrate to ConfigurableDataTable
- `src/pages/social-classes.tsx` - Migrate to ConfigurableDataTable
- `src/pages/relationships.tsx` - Migrate to ConfigurableDataTable
- `src/pages/chat-monitoring.tsx` - Migrate to ConfigurableDataTable
- `src/pages/documents.tsx` - Migrate to ConfigurableDataTable
- `src/pages/locations.tsx` - Migrate to ConfigurableDataTable (keep tree button)
- `src/pages/forum.tsx` - Migrate to ConfigurableDataTable
- `src/pages/messaging.tsx` - Migrate to ConfigurableDataTable
- `src/pages/membership-requests.tsx` - Migrate to ConfigurableDataTable
- `src/pages/system/*.tsx` (5 files) - Migrate to ConfigurableDataTable

**Config JSON files to create**:
- `src/config/tables/items-table.json`
- `src/config/tables/housing-table.json`
- `src/config/tables/economy-table.json`
- (+ 22 more config files)

### Configurazione (Entrambi):
- `next.config.js` - Fix static export + image optimization
- `tsconfig.json` - Verify strict mode enforcement
- `package.json` - Add missing dependencies
- `.eslintrc.json` - Create custom rules
- `.prettierrc` - Create formatting config

### apps/game:
- `src/pages/_app.tsx` - Reduce context nesting
- `src/contexts/GameContext.tsx` - Consolidate with WebSocketContext
- `src/contexts/WebSocketContext.tsx` - Remove duplicate state
- `src/components/utility/UtilityPanel.tsx` - Split in 5 components
- `src/lib/gameApi.ts` - Migrate to TanStack Query
- `src/utils/cache.ts` - Remove (replaced by React Query)

### apps/management:
- `src/pages/items.tsx` - Split (1,134 lines → 300)
- `src/pages/housing.tsx` - Split (1,008 lines → 300)
- `src/pages/economy.tsx` - Split (803 lines → 300)
- `src/lib/api.ts` - Add error handling + types (935 lines)
- `src/lib/auth.ts` - Rename `useAuth` → `useAuthRequest`
- `src/lib/websocket.ts` - Implement OR remove (dead code)

---

## 🚫 ANTI-PATTERNS DA EVITARE NEL REFACTORING

1. ❌ **Non aggiungere astrazioni premature** - fix problems diretti, non creare framework custom
2. ❌ **Non migrare tutto in una volta** - refactor incrementale per ridurre risk
3. ❌ **Non ignorare test** - ogni refactoring DEVE avere test coverage
4. ❌ **Non duplicare logica** - se estrai componenti, estrai anche hooks
5. ❌ **Non lasciare dead code** - rimuovi codice obsoleto durante refactor

---

## ✅ VERIFICA FINALE

Dopo ogni fase, verificare:

1. **Tests passano**: `npm test` senza errori
2. **Build riesce**: `npm run build` completo
3. **Type check**: `npm run type-check` zero errors
4. **Lint pulito**: `npm run lint` zero warnings
5. **Bundle size**: Confronta con baseline (no regressioni)

---

## 🔥 CONCLUSIONE BRUTALMENTE ONESTA

**apps/game**: Struttura decente, implementazione mediocre. Funziona ma è fragile. Con 2-3 settimane di refactoring diventa production-ready. **Grade: D+**

**apps/management**: **DISASTRO ARCHITETTURALE PEGGIORE DEL PREVISTO**.
- 70% delle pagine (25/36) **ignorano completamente** i componenti riutilizzabili già creati (ConfigurableDataTable, SidePanel)
- 11,604 linee senza test che gestiscono dati critici
- 8,000+ linee di codice duplicato che dovrebbero essere 2,000 linee di config JSON
- È un incidente in attesa di accadere + technical debt al quadrato
- **Grade: F- (worse than F)**

**Entrambi**: Build configuration ROTTA per produzione. Static export con headers ignorati e image optimization disabilitata è inaccettabile.

**Verdict AGGIORNATO**:
- Il progetto funziona ma **NON è assolutamente production-ready**
- Technical debt è **PEGGIORE** di quanto sembrava inizialmente
- **70% del management frontend usa architettura sbagliata**
- Budget **8-10 settimane** (aumentato da 6-8) per portare a standard industriale
- **Priority assoluta**: Migrare 25 pagine a ConfigurableDataTable PRIMA di qualsiasi altro refactoring

---

## 📋 SOMMARIO ESECUTIVO

### Deployment SSR - Action Items Immediate

**File da Creare**:
1. ✅ `scripts/deploy-ssr.sh` - Script deploy automatizzato
2. ✅ `ecosystem.config.js` - PM2 configuration root
3. ✅ `/etc/nginx/sites-available/tenpennynovels` - Nginx config su server

**File da Modificare**:
1. ✅ `apps/*/next.config.js` (6 files) - Cambiare `output: 'export'` → `'standalone'`
2. ✅ `.env.deploy` - Aggiornare per rimuovere FTP, tenere solo rsync
3. ✅ `package.json` root - Aggiungere script `deploy`

**Setup Server OVH**:
1. ✅ Install nginx + certbot
2. ✅ Ottenere SSL certificate Let's Encrypt (tutti i domini)
3. ✅ Configurare nginx reverse proxy
4. ✅ Verificare PM2 installed e funzionante
5. ✅ Setup firewall (80, 443, 22)

**DNS Serverplan**:
1. ✅ Cambiare tutti gli A record per puntare a OVH VPS IP
2. ✅ Attendere propagazione DNS (5-30 minuti)

**First Deployment**:
1. ✅ Run `npm run deploy` da locale
2. ✅ Verificare PM2 status su server: `pm2 status`
3. ✅ Test frontend: `https://game.tenpennynovels.com`
4. ✅ Check logs: `pm2 logs`

---

### Frontend Refactoring - Priority Actions

**P0 - ARCHITECTURAL FIX (Week 1-3)** ⚠️ **BLOCCA TUTTO**:
1. ✅ **apps/management: Migrate 25 pages to ConfigurableDataTable**
   - Items.tsx (1,134 lines) → ConfigurableDataTable + config JSON
   - Housing.tsx (1,008 lines) → ConfigurableDataTable + config JSON
   - Economy.tsx (803 lines) → ConfigurableDataTable + config JSON
   - Corporations, social-classes, relationships, etc. (22 pages)
   - **Rationale**: 70% delle pagine ignorano componenti riutilizzabili esistenti
   - **Benefit**: Riduzione 8,000+ linee di codice duplicato → 2,000 linee config
   - **Must complete BEFORE** any other refactoring (no point fixing wrong architecture)

**CRITICAL (Week 4-5)**:
1. ✅ apps/management: Setup Jest + 20% test coverage
2. ✅ apps/management: Fix 307 `any` violations
3. ✅ apps/management: Add Zod + React Hook Form
4. ✅ apps/game: Consolidate 5 contexts → 2-3
5. ✅ apps/game: Split UtilityPanel.tsx (1,044 lines → 5 components)

**HIGH (Week 3-4)**:
1. ✅ Entrambi: Migrate to TanStack Query (API + cache)
2. ✅ Entrambi: Add Prettier + pre-commit hooks
3. ✅ Entrambi: ESLint strict rules (`no-explicit-any: error`)
4. ✅ Entrambi: Add error boundaries
5. ✅ Entrambi: Setup bundle analyzer

**MEDIUM (Week 5-6)**:
1. ✅ Implement code splitting (dynamic imports)
2. ✅ Add table virtualization (management)
3. ✅ Environment validation (Zod)
4. ✅ Setup CI/CD linting + testing
5. ✅ Consider React 19 → 18 downgrade (stability)

---

### Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| **SSR Deployment Setup** | 1-2 days | ⚠️ CRITICAL |
| **⚠️ Migrate 25 pages to ConfigurableDataTable** | 2-3 weeks | 🔴 P0 - BLOCCA TUTTO |
| **Management Other Refactoring** | 1-2 weeks | 🔴 HIGH |
| **Game Refactoring** | 1-2 weeks | 🟠 MEDIUM |
| **Testing Setup** | 1 week | 🔴 HIGH |
| **Performance Optimization** | 1 week | 🟡 MEDIUM |
| **CI/CD + Tooling** | 3-4 days | 🟡 MEDIUM |

**Total Budget**: 8-10 settimane per production-ready (aggiornato per migration)

---

### Risks & Blockers

1. **DNS Propagation**: Può richiedere fino a 48h (generalmente 5-30min)
2. **SSL Certificate**: Richiede DNS già propagato
3. **PM2 Memory**: Monitorare consumo RAM con 14+ processi
4. **Migration Downtime**: Prima volta serve 30min-1h (build + setup)
5. **React 19 Ecosystem**: Alcuni package non ancora compatibili

---

### Success Criteria

**Deployment**:
- ✅ Tutti i frontend accessibili via HTTPS
- ✅ Headers di sicurezza applicati (X-Frame-Options, CSP)
- ✅ Image optimization funzionante
- ✅ PM2 auto-restart configurato
- ✅ SSL A+ rating (SSLLabs test)

**Code Quality**:
- ✅ Zero `any` types in production code
- ✅ Test coverage > 20% su frontend critici
- ✅ ESLint + Prettier + pre-commit hooks attivi
- ✅ Bundle size < 500KB per route
- ✅ Lighthouse score > 80 (Performance, Accessibility, Best Practices)

**Architecture**:
- ✅ Max 3 context providers per app
- ✅ Max 300 linee per componente pagina
- ✅ TanStack Query per API calls + cache
- ✅ Proper error boundaries in place
- ✅ Type-safe API layer

---

## 🚀 NEXT STEPS

1. **Review Plan**: Utente approva architettura + priorità
2. **Setup Deployment**: Creare script + config files
3. **Test Locally**: Build standalone + verify funzionamento
4. **Deploy to OVH**: First deployment + nginx setup
5. **Start Refactoring**: Tackle critical issues (testing, types, splitting)

**Estimated Start-to-Production**: 2-3 giorni (deployment) + 6-8 settimane (refactoring completo)
