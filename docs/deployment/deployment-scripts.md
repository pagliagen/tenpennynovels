# TenpennyNovels - Automated Deployment Scripts

This document explains how to use the automated deployment system for TenpennyNovels production environment.

## 📋 Overview

The deployment system consists of:
- **Backend deployment** to OVH VPS (via SSH/rsync)
- **Frontend deployment** to Serverplan (via FTP)
- **Automated service restart** with PM2
- **Health checks** and verification
- **Backup creation** before deployment

## 🔧 Prerequisites

### 1. Install Required Tools

**macOS:**
```bash
brew install lftp rsync
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y lftp rsync
```

**Windows:**
- Use WSL (Windows Subsystem for Linux) or Git Bash
- Install lftp and rsync via WSL package manager

### 2. Configure SSH Key (Recommended)

Generate SSH key for passwordless deployment:

```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/tenpennynovels_deploy -C "deploy@tenpennynovels"

# Copy public key to OVH server
ssh-copy-id -i ~/.ssh/tenpennynovels_deploy.pub ubuntu@your-ovh-ip

# Test SSH connection
ssh -i ~/.ssh/tenpennynovels_deploy ubuntu@your-ovh-ip "echo 'SSH connection successful'"
```

### 3. Configure Deployment Credentials

Edit the [.env.deploy](.env.deploy) file with your production credentials:

```bash
# Copy example and edit
cp .env.deploy .env.deploy.local
nano .env.deploy

# Required variables to configure:
# - OVH_SSH_HOST (your OVH VPS IP or hostname)
# - OVH_SSH_KEY_PATH (path to your SSH private key)
# - FTP_HOST (Serverplan FTP hostname)
# - FTP_USER (Serverplan FTP username)
# - FTP_PASSWORD (Serverplan FTP password)
# - FTP_PATH_* (FTP paths for each frontend app)
```

**IMPORTANT:** Never commit `.env.deploy` to version control. It's already in `.gitignore`.

## 🚀 Deployment Scripts

### 1. Full Deployment (Backend + Frontend)

Deploy everything to production:

```bash
./scripts/deploy.sh
```

This will:
1. ✅ Build backend services locally
2. ✅ Sync code to OVH VPS via rsync
3. ✅ Install dependencies on OVH
4. ✅ Restart PM2 services
5. ✅ Build frontend applications locally
6. ✅ Upload static files to Serverplan via FTP
7. ✅ Run health checks
8. ✅ Create backup (if enabled)

### 2. Backend-Only Deployment

Deploy only backend services to OVH VPS:

```bash
./scripts/deploy-backend.sh
```

Useful when you only changed backend code (API, services, database logic).

### 3. Frontend-Only Deployment

Deploy only frontend applications to Serverplan:

```bash
./scripts/deploy-frontend.sh
```

Useful when you only changed frontend code (UI, components, styles).

### 4. Dry Run (Test Without Changes)

Test the deployment process without making any actual changes:

```bash
./scripts/deploy.sh --dry-run
./scripts/deploy-backend.sh --dry-run
./scripts/deploy-frontend.sh --dry-run
```

This will:
- ✅ Verify credentials and connectivity
- ✅ Show what would be deployed
- ❌ NOT make any changes to production
- ❌ NOT restart services
- ❌ NOT upload files

## 🏥 Health Check Script

Check the status of all production services:

```bash
# Quick health check
./scripts/health-check.sh

# Detailed check (includes PM2 status, memory, CPU)
./scripts/health-check.sh --detailed

# Continuous monitoring (checks every 30s)
./scripts/health-check.sh --continuous
```

The health check verifies:
- ✅ Backend API Gateway responds
- ✅ All PM2 services are online (detailed mode)
- ✅ MongoDB and Redis are running (detailed mode)
- ✅ Frontend applications are accessible
- ✅ Response times (detailed mode)

## 📊 Deployment Workflow Examples

### Example 1: Full Production Release

```bash
# 1. Test locally first
npm run dev:all
npm run test

# 2. Test deployment without changes
./scripts/deploy.sh --dry-run

# 3. Deploy to production
./scripts/deploy.sh

# 4. Verify deployment
./scripts/health-check.sh --detailed

# 5. Monitor logs
ssh ubuntu@your-ovh-ip
pm2 logs
```

### Example 2: Quick Backend Hotfix

```bash
# 1. Make your backend changes
# 2. Test locally
npm run dev:backend

# 3. Deploy only backend
./scripts/deploy-backend.sh

# 4. Check backend status
./scripts/health-check.sh
```

### Example 3: Frontend UI Update

```bash
# 1. Make your frontend changes
# 2. Test locally
npm run dev:frontend

# 3. Deploy only frontend
./scripts/deploy-frontend.sh

# 4. Verify frontend is accessible
curl -I https://tenpennynovels.com
curl -I https://game.tenpennynovels.com
```

## 📝 Deployment Logs

All deployments are logged for audit trail:

```
logs/deployment/
├── deploy_20250108_143022.log
├── deploy_20250108_152145.log
└── deploy_20250108_163330.log
```

View recent deployment log:
```bash
ls -lt logs/deployment/ | head -5
tail -f logs/deployment/deploy_*.log
```

## 🔄 Backup and Rollback

### Automatic Backups

If `CREATE_BACKUP_BEFORE_DEPLOY=true` in `.env.deploy`, the system automatically creates backups:

```
.deploy-backup/
└── 20250108_143022/
    └── backend_backup.tar.gz
```

### Manual Rollback

If deployment fails, restore from backup:

```bash
# SSH into OVH
ssh ubuntu@your-ovh-ip

# Stop services
pm2 stop all

# Restore from backup (adjust timestamp)
cd /home/ubuntu/tenpennynovels
tar -xzf /path/to/backend_backup.tar.gz

# Restart services
pm2 restart all

# Verify
pm2 status
```

## 🛡️ Security Best Practices

1. **SSH Key Authentication**
   - ✅ Always use SSH keys instead of passwords
   - ✅ Use different keys for different environments
   - ✅ Set appropriate permissions: `chmod 600 ~/.ssh/tenpennynovels_deploy`

2. **Credentials Management**
   - ✅ Never commit `.env.deploy` to Git
   - ✅ Use strong passwords for FTP
   - ✅ Rotate credentials periodically
   - ✅ Store backups securely

3. **Deployment Safety**
   - ✅ Always test with `--dry-run` first
   - ✅ Review deployment logs
   - ✅ Enable backups before deployment
   - ✅ Monitor services after deployment

## 🔧 Troubleshooting

### SSH Connection Failed

```bash
# Test SSH connection
ssh -vvv -i ~/.ssh/tenpennynovels_deploy ubuntu@your-ovh-ip

# Common issues:
# - Wrong SSH key path in .env.deploy
# - SSH key not added to server (use ssh-copy-id)
# - Firewall blocking port 22
# - Wrong username or hostname
```

### FTP Upload Failed

```bash
# Test FTP connection manually
lftp -u your-ftp-user,your-ftp-password ftp.serverplan.com -e "pwd; ls; quit"

# Common issues:
# - Wrong FTP credentials in .env.deploy
# - Wrong FTP paths (check Serverplan directory structure)
# - Passive mode issues (set FTP_PASSIVE_MODE=true/false)
# - Firewall blocking FTP port
```

### PM2 Services Not Starting

```bash
# SSH into OVH
ssh ubuntu@your-ovh-ip

# Check PM2 status
pm2 status
pm2 logs --lines 50

# Manually restart services
pm2 restart all

# Check for errors
pm2 logs api-gateway --lines 20
pm2 logs auth-backend --lines 20
pm2 logs game-backend --lines 20
pm2 logs management-backend --lines 20
```

### Health Checks Failing

```bash
# Run detailed health check
./scripts/health-check.sh --detailed

# Check individual services
curl -v https://api.tenpennynovels.com/health
curl -I https://tenpennynovels.com

# SSH into server and check logs
ssh ubuntu@your-ovh-ip
pm2 logs
sudo systemctl status mongod
sudo systemctl status redis-server
```

### Build Failed

```bash
# Clean build and try again
npm run clean
npm install
npm run build:backend
npm run build:frontend

# Check for TypeScript errors
npx tsc --noEmit

# Check for missing dependencies
npm audit
```

## 📚 Additional Resources

- [Complete Deployment Guide](./deployment.md) - Full OVH setup instructions
- [Architecture Documentation](docs/architecture/backend-architecture.md)
- [Development Guide](docs/setup/development-guide.md)

## 🆘 Getting Help

If you encounter issues:

1. Check deployment logs: `logs/deployment/`
2. Run health check: `./scripts/health-check.sh --detailed`
3. Review this documentation
4. Check [deployment.md](./deployment.md) for server setup
5. SSH into OVH and check PM2 logs: `pm2 logs`

## 📋 Quick Reference

```bash
# Full deployment
./scripts/deploy.sh

# Backend only
./scripts/deploy-backend.sh

# Frontend only
./scripts/deploy-frontend.sh

# Dry run (test)
./scripts/deploy.sh --dry-run

# Health check
./scripts/health-check.sh
./scripts/health-check.sh --detailed
./scripts/health-check.sh --continuous

# View logs
tail -f logs/deployment/deploy_*.log
ssh ubuntu@your-ovh-ip pm2 logs

# Manual restart on OVH
ssh ubuntu@your-ovh-ip
pm2 restart all
pm2 status
```

---

**Happy Deploying! 🚀**
