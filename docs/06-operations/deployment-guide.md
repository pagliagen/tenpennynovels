# Deployment Guide

**Navigation**: [Home](../INDEX.md) > [Operations](./README.md) > Deployment Guide

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Guida completa al deployment di TenpennyNovels in production con Docker.

---

## Overview

TenpennyNovels utilizza **Docker Compose** per orchestrare 7 servizi containerizzati in production. Questa guida copre setup, deployment, monitoring e troubleshooting.

---

## Architecture

### Services

```
Production Stack (Docker Compose):
├── MongoDB (7.0) - Port 27017
├── Redis (7.2-alpine) - Port 6379
├── Qdrant (1.17.0) - Port 6333
├── Embeddings Service (Flask) - Port 5001
├── Embeddings Worker (Node.js) - No exposed port
├── Unified Backend (Node.js 22) - Port 3001
└── API Gateway (Node.js 22) - Port 8000 (public entry)
```

### Network

```
Internet (HTTPS)
    ↓
Nginx Reverse Proxy (SSL/TLS termination)
    ↓
API Gateway (Port 8000) - Docker internal network
    ↓
Unified Backend (Port 3001) - Docker internal network
    ↓
MongoDB, Redis, Qdrant - Docker internal network
```

---

## Prerequisites

### Server Requirements

**Minimum (Development)**:
- 2 vCPU
- 4GB RAM
- 40GB SSD
- Ubuntu 20.04+ / Debian 11+

**Recommended (Production)**:
- 4 vCPU
- 8GB RAM
- 100GB SSD
- Ubuntu 22.04 LTS

### Software Requirements

```bash
# Docker
docker --version  # 24.0.0+

# Docker Compose
docker compose version  # 2.20.0+

# Node.js (for local builds)
node --version  # 22.13.1

# Git
git --version  # 2.30.0+
```

---

## Environment Setup

### 1. Clone Repository

```bash
# SSH (recommended for production)
git clone git@github.com:your-org/tenpennynovels.git
cd tenpennynovels

# HTTPS
git clone https://github.com/your-org/tenpennynovels.git
cd tenpennynovels
```

---

### 2. Configure Environment Variables

```bash
# Copy example
cp .env.example .env

# Edit production values
nano .env
```

**Critical Variables**:
```bash
# Environment
NODE_ENV=production

# Database
MONGODB_URI=mongodb://username:password@mongodb:27017/tenpennynovels?authSource=admin
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=<secure-password>

# Redis
REDIS_URL=redis://redis:6379

# JWT Secrets
JWT_SECRET=<generate-secure-secret>
JWT_REFRESH_SECRET=<generate-secure-secret>
CHARACTER_SESSION_MANAGER_SECRET=<generate-secure-secret>

# Qdrant
QDRANT_URL=http://qdrant:6333

# Embeddings
EMBEDDINGS_SERVICE_URL=http://embeddings-service:5001

# Frontend URLs (production domains)
LANDING_URL=https://tenpennynovels.com
GAME_URL=https://game.tenpennynovels.com
DOCUMENTS_URL=https://documenti.tenpennynovels.com
MANAGEMENT_URL=https://gestione.tenpennynovels.com

# Email (for production notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@tenpennynovels.com
SMTP_PASSWORD=<app-password>
EMAIL_FROM=TenpennyNovels <noreply@tenpennynovels.com>

# API Keys
BOT_API_KEY=<generate-secure-key>
ANTHROPIC_API_KEY=sk-ant-...  # If using BotAI

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...
```

**Generate Secrets**:
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Complete Reference**: [Environment Variables](../01-infrastructure/environment-variables.md)

---

## Deployment Steps

### Step 1: Build Docker Images

```bash
# Build all images
docker compose build

# Or build specific services
docker compose build unified-backend
docker compose build api-gateway
docker compose build embeddings-service
docker compose build embeddings-worker
```

**Production Optimization**:
```dockerfile
# Multi-stage build already configured
FROM node:22-alpine AS builder
# ... build steps ...

FROM node:22-alpine
# ... runtime only
```

---

### Step 2: Start Services

```bash
# Start all services (detached)
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps
```

**Expected Output**:
```
NAME                              STATUS    PORTS
tenpennynovels-mongodb            Up        0.0.0.0:27017->27017/tcp
tenpennynovels-redis              Up        0.0.0.0:6379->6379/tcp
tenpennynovels-qdrant             Up        0.0.0.0:6333->6333/tcp
tenpennynovels-embeddings-service Up        0.0.0.0:5001->5001/tcp
tenpennynovels-embeddings-worker  Up
tenpennynovels-unified-backend    Up        0.0.0.0:3001->3001/tcp
tenpennynovels-api-gateway        Up        0.0.0.0:8000->8000/tcp
```

---

### Step 3: Verify Health

```bash
# API Gateway
curl http://localhost:8000/health
# Expected: {"status":"ok"}

# Unified Backend
curl http://localhost:3001/health
# Expected: {"status":"ok","mongodb":"connected","redis":"connected"}

# Embeddings Service
curl http://localhost:5001/health
# Expected: {"status":"healthy","model":"...","dimension":384}

# Qdrant
curl http://localhost:6333/healthz
# Expected: {"status":"ok"}
```

**Automated Health Check**:
```bash
# Use provided script
./scripts/health-check.sh

# Or via npm
npm run docker:check
```

---

## Frontend Deployment

### Build Static Exports

```bash
# Build all frontend apps
npm run frontend:build

# Or individually
cd apps/landing && npm run build && npm run export
cd apps/game && npm run build && npm run export
cd apps/documents && npm run build && npm run export
cd apps/management && npm run build && npm run export
```

**Output**: Static HTML/CSS/JS in each app's `out/` directory.

---

### Deploy to Static Hosting

**Options**:
1. **Nginx** (self-hosted)
2. **Vercel** (recommended for Next.js)
3. **Netlify**
4. **Cloudflare Pages**
5. **AWS S3 + CloudFront**

**Nginx Example**:
```nginx
# /etc/nginx/sites-available/tenpennynovels

# Landing
server {
    listen 80;
    server_name tenpennynovels.com;
    root /var/www/tenpennynovels/landing/out;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Game
server {
    listen 80;
    server_name game.tenpennynovels.com;
    root /var/www/tenpennynovels/game/out;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# ... repeat for other apps
```

**Upload Static Files**:
```bash
# Rsync to server
rsync -avz --delete apps/landing/out/ user@server:/var/www/tenpennynovels/landing/out/
rsync -avz --delete apps/game/out/ user@server:/var/www/tenpennynovels/game/out/
# ... repeat for other apps

# Reload Nginx
ssh user@server "sudo nginx -t && sudo systemctl reload nginx"
```

---

## SSL/TLS Setup

### Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d tenpennynovels.com -d www.tenpennynovels.com
sudo certbot --nginx -d game.tenpennynovels.com
sudo certbot --nginx -d documenti.tenpennynovels.com
sudo certbot --nginx -d gestione.tenpennynovels.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

---

## Production Optimizations

### Docker Compose Production Override

**Create**: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  unified-backend:
    restart: always
    environment:
      NODE_ENV: production
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  api-gateway:
    restart: always
    environment:
      NODE_ENV: production
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  mongodb:
    restart: always
    command: mongod --auth --bind_ip_all
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
      - ./backups:/backups  # Backup mount

  redis:
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
```

**Deploy**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

### Resource Limits

**Add to `docker-compose.prod.yml`**:

```yaml
services:
  unified-backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

  mongodb:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

---

## Monitoring

### Health Checks

**Docker Compose Built-in**:
```yaml
services:
  unified-backend:
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', ...)"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

---

### Logging

**View Logs**:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f unified-backend

# Last 100 lines
docker compose logs --tail=100 unified-backend

# Since timestamp
docker compose logs --since 2026-03-01T10:00:00 unified-backend
```

**Log Rotation** (already configured in production override):
- Max size: 10MB per file
- Max files: 3 (30MB total per service)

---

### Metrics (Optional)

**Prometheus + Grafana Stack**:

```yaml
# Add to docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: <secure-password>
```

---

## Backup Strategy

### MongoDB Backup

**Automated Daily Backup**:

```bash
#!/bin/bash
# scripts/backup-mongodb.sh

BACKUP_DIR="/backups/mongodb/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

docker exec tenpennynovels-mongodb mongodump \
  --username=admin \
  --password=$MONGO_ROOT_PASSWORD \
  --authenticationDatabase=admin \
  --db=tenpennynovels \
  --out=$BACKUP_DIR

# Compress
tar -czf "${BACKUP_DIR}.tar.gz" -C /backups/mongodb $(basename $BACKUP_DIR)
rm -rf $BACKUP_DIR

# Keep last 7 days
find /backups/mongodb -name "*.tar.gz" -mtime +7 -delete
```

**Cron** (daily at 2am):
```bash
0 2 * * * /path/to/scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

**Details**: [Backup & Restore](./backup-restore.md)

---

### Restore

```bash
# Extract backup
tar -xzf /backups/mongodb/20260301.tar.gz -C /tmp

# Restore to MongoDB
docker exec -i tenpennynovels-mongodb mongorestore \
  --username=admin \
  --password=$MONGO_ROOT_PASSWORD \
  --authenticationDatabase=admin \
  --db=tenpennynovels \
  --drop \
  /tmp/20260301/tenpennynovels
```

---

## Update & Maintenance

### Update Application Code

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose build

# Recreate containers
docker compose up -d --force-recreate

# Verify health
./scripts/health-check.sh
```

---

### Update Docker Images

```bash
# Pull latest base images
docker compose pull

# Rebuild
docker compose build --no-cache

# Restart
docker compose up -d
```

---

### Database Migrations

**Run Migrations**:
```bash
# If using migration framework
docker exec tenpennynovels-unified-backend npm run migrate:up

# Or manual scripts
docker exec -i tenpennynovels-mongodb mongosh \
  --username admin --password $MONGO_ROOT_PASSWORD \
  --authenticationDatabase admin \
  tenpennynovels < migrations/001_add_bot_id_field.js
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs unified-backend

# Check dependencies
docker compose ps

# Restart service
docker compose restart unified-backend
```

**Common Issues**: [Docker Troubleshooting](./docker-troubleshooting.md)

---

### Database Connection Issues

```bash
# Test MongoDB connection
docker exec tenpennynovels-mongodb mongosh \
  --username admin --password $MONGO_ROOT_PASSWORD \
  --authenticationDatabase admin \
  --eval "db.adminCommand('ping')"

# Test from backend
docker exec tenpennynovels-unified-backend node -e "
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected');
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
"
```

---

### High Memory Usage

```bash
# Check resource usage
docker stats

# Restart specific service
docker compose restart unified-backend
```

---

## Rollback Strategy

### Quick Rollback

```bash
# Tag current version before update
docker tag tenpennynovels/unified-backend:latest tenpennynovels/unified-backend:backup-$(date +%Y%m%d)

# If update fails, rollback
docker tag tenpennynovels/unified-backend:backup-20260301 tenpennynovels/unified-backend:latest
docker compose up -d --force-recreate
```

---

### Git Rollback

```bash
# Revert to previous commit
git reset --hard HEAD~1

# Rebuild and deploy
docker compose build
docker compose up -d --force-recreate
```

---

## Security Checklist

- [ ] All secrets in `.env` (not committed to Git)
- [ ] MongoDB authentication enabled (`--auth`)
- [ ] Redis password set (`requirepass`)
- [ ] JWT secrets rotated regularly
- [ ] SSL/TLS certificates valid and auto-renewing
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] Docker socket not exposed
- [ ] Logs rotated and monitored
- [ ] Backups tested monthly
- [ ] Dependency updates scheduled
- [ ] Security headers enabled (Helmet.js in API Gateway)

---

## Related Documentation

- [Infrastructure](../01-infrastructure/README.md) - Service architecture
- [Docker Compose](../01-infrastructure/docker-compose.md) - Service configuration
- [Docker Troubleshooting](./docker-troubleshooting.md) - Common issues
- [Monitoring](./monitoring.md) - Logs and metrics
- [Backup & Restore](./backup-restore.md) - Database backup
