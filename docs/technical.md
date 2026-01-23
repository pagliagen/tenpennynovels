# TenpennyNovels - Technical Documentation

This document contains detailed technical information for developers and system administrators working with the TenpennyNovels platform.

## Table of Contents
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [Database Management](#database-management)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Development Environment
- **Operating System**: Linux (Debian/Ubuntu recommended), macOS, or Windows with WSL
- **Node.js**: v22.13.1 (see .nvmrc file)
- **npm**: v10.x or higher
- **MongoDB**: v6.x or higher
- **Redis**: v7.x or higher
- **Docker**: Latest version for containerized services

### Production Environment
- **CPU**: 4+ cores (8+ recommended for high load)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 50GB+ available space (SSD recommended)
- **Network**: Stable internet connection, 100Mbps+ recommended
- **OS**: Ubuntu 22.04 LTS or Debian 12

## Installation Guide

### Automated Installation (Recommended)

For Debian/Ubuntu systems, use the automated setup script:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/your-repo/tenpennynovels/main/setup.sh | bash

# Or download and review first
wget https://raw.githubusercontent.com/your-repo/tenpennynovels/main/setup.sh
chmod +x setup.sh
./setup.sh
```

### Manual Installation

#### 1. Install System Dependencies

**On Debian/Ubuntu:**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or install NVM for version management
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22.13.1
nvm use 22.13.1

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Redis
sudo apt-get install -y redis-server

# Install additional tools
sudo apt-get install -y git curl wget build-essential
```

**On macOS (using Homebrew):**
```bash
# Install dependencies
brew install node mongodb-community redis git
```

#### 2. Clone and Setup Project

```bash
# Clone the repository
git clone https://github.com/your-repo/tenpennynovels.git
cd tenpennynovels

# Use the correct Node.js version (if using NVM)
nvm use

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env
```

#### 3. Configure Environment Variables

Edit the `.env` file with your configuration:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/tenpennynovels
REDIS_URL=redis://localhost:6379

# Authentication
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
NEXTAUTH_URL=http://localhost:3000

# Application URLs (Development)
API_GATEWAY_URL=http://localhost:8000
LANDING_URL=http://localhost:4000
GAME_URL=http://localhost:4001
DOCS_URL=http://localhost:4002
FORUM_URL=http://localhost:4003
MANAGEMENT_URL=http://localhost:4004

# WebSocket Configuration
SOCKET_PORT=3005
SOCKET_CORS_ORIGIN=http://localhost:3001

# Production Settings (set NODE_ENV=production for production)
NODE_ENV=development
```

#### 4. Start Services

```bash
# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### 5. Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

#### 6. Start Development Environment

```bash
# Start all services and applications
npm run dev:all

# Or start backend services individually:
npm run dev:gateway        # API Gateway only
npm run dev:game           # Game backend only
npm run dev:management     # Management backend only
npm run dev:auth           # Authentication backend only

# Or start frontend applications individually:
npm run dev:landing        # Landing site only
npm run dev:game-frontend  # Game frontend only
npm run dev:docs           # Documents site only
npm run dev:forum          # Forum site only
npm run dev:management-frontend # Management frontend only

# Or start groups:
npm run dev:backend        # All backend services
npm run dev:frontend       # All frontend applications
```

## Configuration

### Application URLs (Development)

After starting the development environment:

- **API Gateway**: http://localhost:8000
- **Landing/Login**: http://localhost:4000
- **Game Interface**: http://localhost:4001
- **Documents**: http://localhost:4002
- **Forum**: http://localhost:4003
- **Management**: http://localhost:4004

### Backend Services (Direct Access - For Development Only)
- **Authentication Backend**: http://localhost:3000
- **Game Backend**: http://localhost:3001
- **Management Backend**: http://localhost:3002

### Port Configuration

**Frontend Applications:**
- Landing: 4000
- Game: 4001
- Documents: 4002
- Forum: 4003
- Management: 4004

**Backend Services:**
- API Gateway: 8000
- Authentication Backend: 3000
- Game Backend: 3001
- Management Backend: 3002
- WebSocket: 3005

Use `lsof -i :PORT` to check port usage.

## Production Deployment

### Environment Setup

1. **Server Preparation**:
```bash
# Create application user
sudo useradd -r -s /bin/false tenpennynovels
sudo mkdir -p /opt/tenpennynovels
sudo chown tenpennynovels:tenpennynovels /opt/tenpennynovels

# Clone application
sudo -u tenpennynovels git clone https://github.com/your-repo/tenpennynovels.git /opt/tenpennynovels
cd /opt/tenpennynovels
sudo -u tenpennynovels npm install
```

2. **Production Environment Variables**:
```bash
# Production .env configuration
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/tenpennynovels_prod
REDIS_URL=redis://localhost:6379

# Production URLs (adjust to your domain)
NEXTAUTH_URL=https://tenpennynovels.com
LANDING_URL=https://tenpennynovels.com
GAME_URL=https://game.tenpennynovels.com
DOCS_URL=https://documenti.tenpennynovels.com
FORUM_URL=https://forum.tenpennynovels.com
MANAGEMENT_URL=https://gestione.tenpennynovels.com

# Security (generate strong secrets)
NEXTAUTH_SECRET=your-production-secret-minimum-32-characters
JWT_SECRET=another-strong-secret-for-jwt-tokens

# SSL/HTTPS Configuration
SSL_CERT_PATH=/etc/letsencrypt/live/tenpennynovels.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/tenpennynovels.com/privkey.pem
```

3. **Build for Production**:
```bash
# Build all applications
npm run build

# Run production tests
npm run test
```

4. **SSH Key Authentication** (for deployment and log monitoring):
```bash
# Start SSH agent (keeps keys loaded in memory)
eval "$(ssh-agent -s)"

# Add your SSH key to the agent (avoids entering password every time)
ssh-add ~/.ssh/tenpennynovels_deploy

# Verify loaded keys
ssh-add -l

# Test SSH connection to production server
ssh ubuntu@your-server.com
```

> **Note**: These commands must be run in each new terminal session. Add them to your `~/.bashrc` or `~/.zshrc` to run automatically on shell startup.

5. **Process Management with PM2**:
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start services with PM2
pm2 start ecosystem.config.js

# Setup PM2 startup
sudo pm2 startup
pm2 save
```

### Nginx Configuration

Create `/etc/nginx/sites-available/tenpennynovels`:

```nginx
# Main landing site
server {
    listen 80;
    listen 443 ssl http2;
    server_name tenpennynovels.com;

    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

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
    }
}

# Game application
server {
    listen 80;
    listen 443 ssl http2;
    server_name game.tenpennynovels.com;

    ssl_certificate /etc/letsencrypt/live/tenpennynovels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tenpennynovels.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Add similar blocks for documenti.tenpennynovels.com, forum.tenpennynovels.com, gestione.tenpennynovels.com
```

Enable the configuration:
```bash
sudo ln -s /etc/nginx/sites-available/tenpennynovels /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificates
sudo certbot --nginx -d tenpennynovels.com -d game.tenpennynovels.com -d documenti.tenpennynovels.com -d forum.tenpennynovels.com -d gestione.tenpennynovels.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Database Management

### Seeding Data

```bash
# Local Development
npm run seed                      # Run all seeders
npm run seed:locations            # Seed locations only
npm run seed:occupations          # Seed occupations only
npm run seed:force                # Force re-seed (truncates existing data)

# Remote Database Seeding (Production/OVH)
npm run seed:remote               # Seed all data on remote server
npm run seed:remote:occupations   # Seed occupations only on remote
npm run seed:remote:force         # Force re-seed on remote (DESTRUCTIVE)
npm run seed:remote:occupations:force # Force re-seed occupations on remote
```

### Backup and Restore

```bash
# Backup database
mongodump --db tenpennynovels_prod --out /backup/mongodb/$(date +%Y%m%d)

# Restore database
mongorestore --db tenpennynovels_prod /backup/mongodb/20241127/tenpennynovels_prod

# Database health check
npm run db:health
```

### Database Maintenance

```bash
# Run database migrations
npm run db:migrate

# Reset database (DESTRUCTIVE)
npm run db:reset
```

## Monitoring and Maintenance

### Log Management

Application logs are stored in:
- **Game Backend**: `services/game-backend/logs/`
- **Management Backend**: `services/management-backend/logs/`

### Performance Monitoring

Monitor key metrics:
- **WebSocket Connections**: Active player count
- **Redis Memory Usage**: Cache and event queue size
- **MongoDB Performance**: Query execution times
- **Memory Usage**: Node.js heap size

## Troubleshooting

### Common Issues

**MongoDB Connection Issues:**
```bash
# Check MongoDB status
sudo systemctl status mongod

# View MongoDB logs
sudo journalctl -u mongod

# Restart MongoDB
sudo systemctl restart mongod
```

**Redis Connection Issues:**
```bash
# Check Redis status
sudo systemctl status redis-server

# Test Redis connection
redis-cli ping

# Restart Redis
sudo systemctl restart redis-server
```

**Port Conflicts:**

If you encounter port conflicts, use `lsof -i :PORT` to identify which process is using the port:

```bash
# Check specific port
lsof -i :3001

# Kill process using port
kill -9 <PID>
```

**Node.js Version Issues:**
```bash
# Check current Node.js version
node --version

# Use correct version with NVM
nvm use 22.13.1

# Install specific version if not available
nvm install 22.13.1
```

**Build Failures:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild specific workspace
npm run build --workspace=@tenpennynovels/game-backend
```

**WebSocket Connection Issues:**
```bash
# Check WebSocket service status
pm2 list

# Restart WebSocket service
pm2 restart socket-service

# Check WebSocket logs
pm2 logs socket-service
```

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/your-repo/tenpennynovels/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/tenpennynovels/discussions)
- **Documentation**: See [Development Guide](setup/development-guide.md) for detailed architecture documentation

## Development Commands Reference

```bash
# Development - All services
npm run dev:all          # Start all services and frontends
npm run dev:backend      # All backend services only
npm run dev:frontend     # All frontend applications only

# Development - Backend services individually
npm run dev:gateway      # API Gateway only
npm run dev:game         # Game backend only
npm run dev:management   # Management backend only
npm run dev:auth         # Authentication backend only

# Development - Frontend applications individually
npm run dev:landing      # Landing site only
npm run dev:game-frontend # Game frontend only
npm run dev:docs         # Documents site only
npm run dev:forum        # Forum site only
npm run dev:management-frontend # Management frontend only

# Building
npm run build            # Build all applications
npm run build:backend    # Build all backend services
npm run build:frontend   # Build all frontend applications
npm run build:game       # Build game backend
npm run build:management # Build management backend
npm run build:auth       # Build authentication backend
npm run build:gateway    # Build API gateway

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed initial data (local)
npm run db:reset         # Reset database (DESTRUCTIVE)

# Testing
npm run test             # Run all tests
npm run test:backend     # Backend tests only
npm run test:frontend    # Frontend tests only
npm run test:integration # Integration tests
```

---

For architecture documentation and development guidelines, see [Development Guide](setup/development-guide.md).

For complete API documentation, see [API Documentation](api-docs.md).
