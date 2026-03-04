# TenpennyNovels - Production Deployment Guide

Complete guide for deploying TenpennyNovels on Ubuntu VPS with GitHub Actions automation.

## 📁 Directory Structure

- **[primo-rilascio-manuale/](./primo-rilascio-manuale/)** - Setup iniziale server (solo prima volta)
  - SSH keys setup
  - Nginx configuration
  - PM2 setup
  - Environment variables templates

- **[scripts/](./scripts/)** - Script di deploy automatico (usati da GitHub Actions)
  - install-all.sh - Installa tutte le dipendenze
  - build-all.sh - Build completo
  - rebuild-frontend.sh - Rebuild solo frontend

- **[utility/](./utility/)** - Script manuali occasionali (fix speciali)
  - fix-websocket-env.sh - Fix WebSocket URLs
  - link-env.sh - Symlink env files (dev only)

- **CDN_SETUP.md** - Guida setup CDN service

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [GitHub Actions Automation](#github-actions-automation)
4. [Manual Deployment](#manual-deployment)
5. [Troubleshooting](#troubleshooting)
6. [Maintenance](#maintenance)

---

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ (VPS at 51.83.47.109)
- **Node.js**: v22.13.1 (use nvm)
- **Python**: 3.8+ with pip
- **PM2**: Process manager for Node.js
- **Nginx**: Web server and reverse proxy
- **Certbot**: Let's Encrypt SSL certificates

### External Dependencies

These must be installed and running on the VPS:

- ✅ **MongoDB** (v4.4+)
- ✅ **Redis** (v6.0+)
- ✅ **Qdrant** (v1.0+) for vector search

### DNS Configuration

All subdomains must point to VPS IP (51.83.47.109):

- `tenpennynovels.com` → 51.83.47.109
- `game.tenpennynovels.com` → 51.83.47.109
- `documenti.tenpennynovels.com` → 51.83.47.109
- `gestione.tenpennynovels.com` → 51.83.47.109
- `api.tenpennynovels.com` → 51.83.47.109 (already configured)
- `ws.tenpennynovels.com` → 51.83.47.109 (already configured)

---

## Quick Start

For experienced users who know the setup:

```bash
cd ~/tenpennynovels

# 1. Setup environment variables (automatic)
chmod +x deploy/*.sh
./deploy/setup-env.sh

# 2. Build all services
./deploy/build-all.sh

# 3. Setup Nginx
./deploy/setup-nginx.sh

# 4. Generate SSL certificates
sudo certbot --nginx -d tenpennynovels.com
sudo certbot --nginx -d game.tenpennynovels.com
sudo certbot --nginx -d documenti.tenpennynovels.com
sudo certbot --nginx -d gestione.tenpennynovels.com

# 5. Start PM2
./deploy/setup-pm2.sh

# 6. Verify
pm2 status
pm2 logs
```

---

## Step-by-Step Deployment

### Step 1: Clone Repository

```bash
cd ~
git clone [your-repo-url] tenpennynovels
cd tenpennynovels
```

### Step 2: Install Node.js (v22.13.1)

```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install and use Node 22.13.1
nvm install 22.13.1
nvm use 22.13.1
nvm alias default 22.13.1

# Verify
node --version  # Should show: v22.13.1
```

### Step 3: Install PM2 Globally

```bash
npm install -g pm2

# Verify
pm2 --version
```

### Step 4: Configure Environment Variables

Use the automatic setup script to copy all environment files from templates:

```bash
cd ~/tenpennynovels
chmod +x deploy/*.sh
./deploy/setup-env.sh
```

This script automatically copies all `.env` templates to their correct destinations:
- `deploy/env-templates/api-gateway.env` → `services/api-gateway/.env.production`
- `deploy/env-templates/unified-backend.env` → `services/unified-backend/.env.production`
- `deploy/env-templates/botai-backend.env` → `services/botai-backend/.env.production`
- `deploy/env-templates/embeddings-service.env` → `services/embeddings-service/.env`
- `deploy/env-templates/embeddings-worker.env` → `services/embeddings-worker/.env.production`
- `deploy/env-templates/landing.env` → `apps/landing/.env.production`
- `deploy/env-templates/game.env` → `apps/game/.env.production`
- `deploy/env-templates/documents.env` → `apps/documents/.env.production`
- `deploy/env-templates/management.env` → `apps/management/.env.production`

**Expected output:**
```
✅ Copied api-gateway.env → services/api-gateway/.env.production
✅ Copied unified-backend.env → services/unified-backend/.env.production
✅ Copied botai-backend.env → services/botai-backend/.env.production
✅ Copied embeddings-service.env → services/embeddings-service/.env
✅ Copied embeddings-worker.env → services/embeddings-worker/.env.production
✅ Copied landing.env → apps/landing/.env.production
✅ Copied game.env → apps/game/.env.production
✅ Copied documents.env → apps/documents/.env.production
✅ Copied management.env → apps/management/.env.production
```

**⚠️ IMPORTANT:** Before pushing to Git, make sure you've configured all secrets in the template files (`deploy/env-templates/*.env`):
- JWT secrets (generate with `openssl rand -hex 64`)
- Anthropic API key
- Bot API key (generate with `openssl rand -hex 32`)
- SMTP credentials
- MongoDB URI (if authentication is enabled)

### Step 5: Build All Services

This will:
- Install dependencies for all services and apps
- Build TypeScript → JavaScript for backend services
- Build Next.js apps for production
- Setup Python venv for embeddings-service

```bash
cd ~/tenpennynovels
chmod +x deploy/*.sh
./deploy/build-all.sh
```

**Expected output:**
```
✅ api-gateway built successfully
✅ unified-backend built successfully
✅ botai-backend built successfully
✅ embeddings-worker built successfully
✅ embeddings-service setup successfully
✅ landing built successfully
✅ game built successfully
✅ documents built successfully
✅ management built successfully
```

### Step 6: Setup Nginx

This script will:
1. Generate Nginx configuration files for all frontend subdomains
2. Copy them to `/etc/nginx/sites-enabled/` with sudo
3. Test Nginx configuration
4. Reload Nginx

```bash
./deploy/setup-nginx.sh
```

**Expected output:**
```
✅ All Nginx configurations generated
✅ tenpennynovels-landing installed
✅ tenpennynovels-game installed
✅ tenpennynovels-documenti installed
✅ tenpennynovels-gestione installed
✅ Nginx configuration test passed
✅ Nginx reloaded successfully
```

### Step 7: Generate SSL Certificates

Use Certbot to generate Let's Encrypt SSL certificates for each subdomain:

```bash
sudo certbot --nginx -d tenpennynovels.com
sudo certbot --nginx -d game.tenpennynovels.com
sudo certbot --nginx -d documenti.tenpennynovels.com
sudo certbot --nginx -d gestione.tenpennynovels.com
```

**Note**: You may be prompted to:
- Enter your email address
- Agree to Terms of Service
- Choose whether to redirect HTTP to HTTPS (select YES)

### Step 8: Start PM2 Services

This script will:
1. Verify MongoDB, Redis, and Qdrant are running
2. Start all 9 services (5 backend + 4 frontend) with PM2
3. Save PM2 configuration
4. Setup PM2 to auto-start on server reboot

```bash
./deploy/setup-pm2.sh
```

**Expected output:**
```
✅ MongoDB is running
✅ Redis is running
✅ Qdrant is running
✅ Logs directory created
✅ All services started
✅ PM2 configuration saved
✅ PM2 startup script configured
```

### Step 9: Verify Deployment

Check all services are running:

```bash
pm2 status
```

**Expected output:**
```
┌─────┬────────────────────────────────┬─────────┬──────┬─────┬──────────┐
│ id  │ name                           │ status  │ cpu  │ mem │ uptime   │
├─────┼────────────────────────────────┼─────────┼──────┼─────┼──────────┤
│ 0   │ tenpennynovels-api-gateway     │ online  │ 0%   │ 45M │ 10s      │
│ 1   │ tenpennynovels-unified-backend │ online  │ 0%   │ 98M │ 10s      │
│ 2   │ tenpennynovels-botai-backend   │ online  │ 0%   │ 78M │ 10s      │
│ 3   │ tenpennynovels-embeddings-...  │ online  │ 0%   │ 1.2G│ 10s      │
│ 4   │ tenpennynovels-embeddings-...  │ online  │ 0%   │ 45M │ 10s      │
│ 5   │ tenpennynovels-landing         │ online  │ 0%   │ 120M│ 10s      │
│ 6   │ tenpennynovels-game            │ online  │ 0%   │ 130M│ 10s      │
│ 7   │ tenpennynovels-documents       │ online  │ 0%   │ 110M│ 10s      │
│ 8   │ tenpennynovels-management      │ online  │ 0%   │ 115M│ 10s      │
└─────┴────────────────────────────────┴─────────┴──────┴─────┴──────────┘
```

Test endpoints:

```bash
# API Gateway health check
curl https://api.tenpennynovels.com/health

# Frontend pages (open in browser)
https://tenpennynovels.com
https://game.tenpennynovels.com
https://documenti.tenpennynovels.com
https://gestione.tenpennynovels.com
```

---

## Environment Variables

### Backend Services

#### api-gateway
- `NODE_ENV`: production
- `PORT`: 8000
- `GAME_BACKEND_URL`: http://127.0.0.1:3001

#### unified-backend
- `NODE_ENV`: production
- `PORT`: 3001 (bind to 127.0.0.1 only!)
- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string
- `QDRANT_URL`: http://127.0.0.1:6333
- `JWT_SECRET`: ⚠️ **MUST CHANGE**
- `JWT_REFRESH_SECRET`: ⚠️ **MUST CHANGE**
- `EMBEDDINGS_SERVICE_URL`: http://127.0.0.1:5001
- `SMTP_*`: Email configuration

#### botai-backend
- `NODE_ENV`: production
- `PORT`: 8080
- `MONGODB_URI`: MongoDB connection string
- `ANTHROPIC_API_KEY`: ⚠️ **MUST CHANGE**
- `GAME_BACKEND_BOT_API_KEY`: ⚠️ **MUST CHANGE**

#### embeddings-service
- `EMBEDDINGS_SERVICE_HOST`: 127.0.0.1
- `EMBEDDINGS_SERVICE_PORT`: 5001
- `EMBEDDINGS_MODEL`: paraphrase-multilingual-MiniLM-L12-v2

#### embeddings-worker
- `NODE_ENV`: production
- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string
- `QDRANT_URL`: http://127.0.0.1:6333
- `EMBEDDINGS_SERVICE_URL`: http://127.0.0.1:5001

### Frontend Apps

All frontend apps need:
- `NODE_ENV`: production
- `NEXT_PUBLIC_API_URL`: https://api.tenpennynovels.com
- `NEXT_PUBLIC_WS_URL`: https://ws.tenpennynovels.com (game and management only)

---

## Security Checklist

Before going to production, verify these critical security settings:

### 1. ✅ Localhost Binding

**unified-backend MUST bind to 127.0.0.1** to prevent direct external access.

Verify in `services/unified-backend/src/server.ts`:

```typescript
// ✅ CORRECT (localhost only)
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});

// ❌ WRONG (exposed to internet)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 2. ✅ Firewall Configuration

Only these ports should be accessible from internet:

```bash
sudo ufw status

# Should show:
80/tcp    ALLOW       Anywhere  # HTTP
443/tcp   ALLOW       Anywhere  # HTTPS
22/tcp    ALLOW       Anywhere  # SSH
```

Internal ports (3001, 8080, 5001) should NOT be listed.

### 3. ✅ JWT Secrets

Verify JWT secrets are NOT the default values:

```bash
grep "CHANGE_ME" services/unified-backend/.env.production
```

Should return NO results. If it returns matches, you forgot to change secrets!

### 4. ✅ CORS Origins

Verify `unified-backend/.env.production` has specific origins:

```bash
# ✅ CORRECT
ALLOWED_ORIGINS=https://tenpennynovels.com,https://game.tenpennynovels.com,...

# ❌ WRONG
CORS_ORIGIN=*
```

### 5. ✅ MongoDB Authentication

If MongoDB is production-ready, it should require authentication:

```bash
# Check if auth is enabled
mongo --eval "db.adminCommand('getCmdLineOpts')" | grep -i auth
```

### 6. ✅ SSL Certificates

All subdomains must have valid SSL certificates:

```bash
sudo certbot certificates
```

Should list all 4 frontend domains + api.tenpennynovels.com + ws.tenpennynovels.com.

---

## Troubleshooting

### Services Won't Start

**Problem**: PM2 shows services as "errored" or "stopped"

```bash
# Check logs for specific service
pm2 logs tenpennynovels-unified-backend --lines 50

# Common issues:
# - Missing .env.production file
# - Wrong Node version (must be 22.13.1)
# - MongoDB/Redis/Qdrant not running
# - Port already in use
```

### MongoDB Connection Failed

**Problem**: `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`

```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Enable MongoDB to start on boot
sudo systemctl enable mongod
```

### Redis Connection Failed

**Problem**: `Error: Redis connection to 127.0.0.1:6379 failed`

```bash
# Check if Redis is running
sudo systemctl status redis

# Start Redis
sudo systemctl start redis

# Enable Redis to start on boot
sudo systemctl enable redis
```

### Qdrant Not Running

**Problem**: Embeddings features not working

```bash
# Check Qdrant status
curl http://127.0.0.1:6333/health

# If not running, start Qdrant (depends on your installation method)
# Docker:
docker start qdrant

# Systemd:
sudo systemctl start qdrant
```

### Nginx 502 Bad Gateway

**Problem**: Frontend subdomain shows "502 Bad Gateway"

```bash
# 1. Check if PM2 service is running
pm2 status

# 2. Check if port is listening
sudo netstat -tulpn | grep :4000  # (or 4001, 4003, 4004)

# 3. Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# 4. Restart specific service
pm2 restart tenpennynovels-landing
```

### Next.js Build Failed

**Problem**: `Error: Cannot find module 'next'`

```bash
# Rebuild specific app
cd apps/landing
npm install
npm run build

# Then restart PM2
pm2 restart tenpennynovels-landing
```

### Python Embeddings Service Crashes

**Problem**: embeddings-service keeps restarting

```bash
# Check Python dependencies
cd services/embeddings-service
source venv/bin/activate
pip list

# Reinstall dependencies
pip install -r requirements.txt
deactivate

# Restart service
pm2 restart tenpennynovels-embeddings-service
```

### Port Already In Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::8000`

```bash
# Find process using the port
sudo lsof -i :8000

# Kill the process (if it's not PM2)
sudo kill -9 [PID]

# Or restart the PM2 service
pm2 restart tenpennynovels-api-gateway
```

### SSL Certificate Errors

**Problem**: Certbot fails to generate certificates

```bash
# 1. Check DNS is resolving correctly
nslookup tenpennynovels.com

# 2. Check if port 80 is accessible
sudo netstat -tulpn | grep :80

# 3. Check Nginx is running
sudo systemctl status nginx

# 4. Try manual certificate generation
sudo certbot certonly --nginx -d tenpennynovels.com
```

---

## Maintenance

### View Logs

```bash
# All services
pm2 logs

# Specific service
pm2 logs tenpennynovels-unified-backend

# Last 100 lines
pm2 logs tenpennynovels-api-gateway --lines 100

# Stream logs in real-time
pm2 logs --raw

# Error logs only
pm2 logs --err
```

### Restart Services

```bash
# Restart all
pm2 restart all

# Restart specific service
pm2 restart tenpennynovels-game

# Restart multiple services
pm2 restart tenpennynovels-api-gateway tenpennynovels-unified-backend

# Graceful reload (zero-downtime for cluster mode)
pm2 reload all
```

### Stop Services

```bash
# Stop all
pm2 stop all

# Stop specific service
pm2 stop tenpennynovels-botai-backend

# Delete service (stops and removes from PM2)
pm2 delete tenpennynovels-embeddings-worker
```

### Update Code and Redeploy

```bash
cd ~/tenpennynovels

# 1. Pull latest code
git pull origin main

# 2. Rebuild all services
./deploy/build-all.sh

# 3. Restart PM2
pm2 restart all

# 4. Verify
pm2 status
pm2 logs --lines 20
```

### Monitor Resource Usage

```bash
# Real-time monitoring (interactive)
pm2 monit

# Show memory/CPU usage
pm2 list

# Show detailed info for a service
pm2 describe tenpennynovels-unified-backend
```

### Database Backup

```bash
# Backup MongoDB
mongodump --db tenpennynovels-prod --out ~/backups/mongodb-$(date +%Y%m%d)

# Backup Redis (if persistence is enabled)
redis-cli SAVE
cp /var/lib/redis/dump.rdb ~/backups/redis-$(date +%Y%m%d).rdb

# Backup Qdrant
# (Depends on your Qdrant installation - usually in /var/lib/qdrant)
```

### Log Rotation

PM2 logs can grow large. Configure log rotation:

```bash
pm2 install pm2-logrotate

# Configure rotation (optional)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### PM2 Dashboard (Optional)

For web-based monitoring:

```bash
# Install PM2 Plus (optional paid service)
pm2 link [secret-key] [public-key]

# Or use free open-source alternative
npm install -g pm2-gui
pm2-gui start
```

### SSL Certificate Renewal

Certbot auto-renewal should be configured by default. Verify:

```bash
# Check auto-renewal timer
sudo systemctl status certbot.timer

# Test renewal (dry-run)
sudo certbot renew --dry-run

# Force renewal (if needed)
sudo certbot renew
```

---

## Useful Commands Reference

```bash
# PM2 Commands
pm2 status                              # Show all processes
pm2 logs [app-name]                     # View logs
pm2 restart [app-name]                  # Restart service
pm2 reload all                          # Zero-downtime reload
pm2 stop all                            # Stop all services
pm2 delete [app-name]                   # Remove service
pm2 monit                               # Real-time monitoring
pm2 save                                # Save current process list
pm2 resurrect                           # Restore saved processes
pm2 startup                             # Generate startup script

# Nginx Commands
sudo nginx -t                           # Test configuration
sudo systemctl reload nginx             # Reload configuration
sudo systemctl restart nginx            # Restart Nginx
sudo systemctl status nginx             # Check status
sudo tail -f /var/log/nginx/error.log   # View error logs

# System Services
sudo systemctl status mongod            # MongoDB status
sudo systemctl status redis             # Redis status
sudo systemctl start [service]          # Start service
sudo systemctl stop [service]           # Stop service
sudo systemctl enable [service]         # Enable on boot
sudo systemctl disable [service]        # Disable on boot

# Network Debugging
sudo netstat -tulpn                     # Show listening ports
sudo lsof -i :[port]                    # Show process on port
curl -I https://api.tenpennynovels.com  # Test HTTP endpoint
nslookup game.tenpennynovels.com        # Check DNS resolution
ping 51.83.47.109                       # Test VPS connectivity

# Process Management
ps aux | grep node                      # Find Node processes
kill -9 [PID]                           # Force kill process
top                                     # System resource monitor
htop                                    # Better resource monitor
```

---

## Support

For issues, check:
1. PM2 logs: `pm2 logs [service-name]`
2. Nginx logs: `/var/log/nginx/error.log`
3. System logs: `journalctl -u [service-name]`
4. GitHub issues: [your-repo-url]/issues

---

**Last Updated**: 2026-02-28
**Version**: 1.0.0
