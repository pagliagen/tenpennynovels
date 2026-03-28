# 04 - CI/CD & GitHub Actions

Pattern di deployment automatico con GitHub Actions per TenpennyNovels.

---

## GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

### Branch Strategy (DUAL-BRANCH PRODUCTION DEPLOY)

**CRITICAL**: Configurazione INTENZIONALE - entrambi i branch deployano in production.

```yaml
on:
  pull_request:
    branches: [master, develop]  # Build check only
  push:
    branches: [master, develop]  # Build + deploy to production
  workflow_dispatch:             # Manual trigger
```

**Behavior**:
- **Pull Requests** su master/develop → Solo `build-check` job (NO deploy)
- **Push** su master/develop → `build-check` + `deploy` job → **PRODUCTION**
- **Manual dispatch** → Deploy immediato

### Why Both Branches Deploy to Production

**Reason**: Branch `develop` serve come **backup deployment path**.

**Use Cases**:
- Hotfix urgente su develop mentre master ha WIP
- Rollback rapido a versione stabile su develop
- Testing pre-merge in ambiente production-like

**Trade-offs**:
- ✅ Flessibilità: due entry point per production
- ✅ Backup: se master ha issue, develop può deployare
- ⚠️ Rischio: push accidentale su develop va in production
- ⚠️ Coordination: team deve sapere quale branch è "current"

### Environment Configuration

```yaml
# deploy job
environment:
  name: production              # ✅ BOTH branches deploy here
  url: https://tenpennynovels.com
```

**NO staging environment** - deployment strategy è:
1. Develop localmente
2. Push su develop → production deploy (backup path)
3. Merge develop → master → production deploy (main path)

---

## Deployment Pipeline

### Jobs Overview

```
build-check (runs on PR + push)
    ↓ (only on push/dispatch)
deploy
    ├── Checkout & rsync files
    ├── Install dependencies (smart hash check)
    ├── Build frontend apps
    ├── Build backend services
    ├── Cleanup dev dependencies
    ├── Setup Python (embeddings worker)
    ├── Restart PM2 services
    ├── Verify PM2 status
    └── Health checks
```

### Build Check Job

Runs on: Pull requests + pushes (both master/develop)

```yaml
build-check:
  runs-on: ubuntu-latest
  steps:
    - Checkout code
    - Setup Node.js (from .nvmrc)
    - Install all dependencies
    - Build all frontend apps
    - Build all backend services
```

**Purpose**: Fail fast if code doesn't build (before deploy)

### Deploy Job

Runs on: Push + workflow_dispatch (NOT pull requests)

**Condition**:
```yaml
if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'
```

**Concurrency Control**:
```yaml
concurrency:
  group: production-deploy
  cancel-in-progress: false  # Don't cancel running deploys
```

---

## Smart Dependency Installation

**Pattern**: Hash-based change detection (skip install if unchanged)

```bash
# Generate hash of all package.json + package-lock.json
NEW_HASH=$(find . -maxdepth 3 -name 'package.json' -o -name 'package-lock.json' \
  | sort | xargs cat | sha256sum | cut -d' ' -f1)

if [ "$NEW_HASH" != "$OLD_HASH" ]; then
  echo "📦 Dependency files changed — installing..."
  # Install all apps/services
  echo "$NEW_HASH" > .deps-hash
else
  echo "⏭️  Skipping dependency installation (no changes)"
fi
```

**Benefits**:
- ✅ Fast deploys when only code changes (no dependency churn)
- ✅ Reliable: reinstall when package.json/lock changes
- ✅ Cached hash persists across deploys

---

## Build Strategy

### Frontend Build

```bash
npm run build:frontend:all
```

Builds all Next.js apps (landing, game, documents, management).

**Timeout**: 10 minutes

### Backend Build

**CRITICAL Pattern**: Install devDependencies BEFORE build (tsc needs them)

```bash
# Reinstall with devDependencies (needed for tsc)
for service in services/api-gateway services/unified-backend services/embeddings-worker; do
  (cd "$service" && npm install)
done

# Build
npm run build:backend:all
```

**Why reinstall?**: Previous step may have run `npm prune --production` in earlier deploy.

**Cleanup After Build**:
```bash
npm prune --production  # Remove devDependencies after build
```

---

## Python Setup (Embeddings Worker)

**Step**: Install Python dependencies + pre-download HuggingFace models

```bash
cd ~/tenpennynovels/services/embeddings-worker/python

# Create venv
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip3 install -r requirements.txt

# Pre-download models (embedding + moderation)
python3 setup-models.py
```

**Models Downloaded**:
- `paraphrase-multilingual-MiniLM-L12-v2` (embedding, 384D)
- Moderation model (toxicity detection)

**Fallback**: If download fails (rate limit), models download on first use.

---

## PM2 Restart

```bash
pm2 startOrRestart ecosystem.config.js --update-env --env production
```

**Pattern**: `startOrRestart` (NOT `restart`)
- Starts if not running
- Restarts if already running
- Updates environment variables

**Why `--update-env --env production`**:
- Reloads .env.production
- Updates process.env for all services

---

## Health Checks

**Runs**: After PM2 restart (unless `skip_health_check` input = true)

### Wait Period

```bash
sleep 15  # Give services time to bind and connect to MongoDB/Redis
```

### Checks

1. **API Gateway**: `https://api.tenpennynovels.com/health`
   - Single attempt, 10s timeout
   - HTTP 200 = success

2. **WebSocket (unified-backend)**: `https://ws.tenpennynovels.com/health`
   - **5 retry attempts** (WebSocket slower to start)
   - 5s between retries
   - HTTP 200 = success

**Why retry WebSocket?**: MongoDB/Redis connection can take time.

**Failure**: Exit code 1 → GitHub Actions marks deploy as failed.

---

## Manual Deployment

### Via GitHub UI

1. Go to Actions tab
2. Select "Deploy to OVH VPS" workflow
3. Click "Run workflow"
4. Select branch (master or develop)
5. Optional: Check "Skip health checks" (for emergencies)

### Via SSH (Emergency)

```bash
ssh -p <port> <user>@<host>
cd ~/tenpennynovels

# Pull latest
git checkout master  # or develop
git pull origin master

# Install deps (if needed)
./deploy/scripts/install-all.sh

# Build
npm run build:frontend:all
npm run build:backend:all

# Restart
pm2 startOrRestart ecosystem.config.js --update-env --env production

# Verify
pm2 status
curl https://api.tenpennynovels.com/health
curl https://ws.tenpennynovels.com/health
```

---

## Landing Sitemap Lastmod Stamp

**Step**: Stamp commit date for sitemap generation

```bash
git log -1 --format=%cs > apps/landing/public/landing-sitemap-lastmod.txt
```

**Purpose**: SitemapService reads this file for `<lastmod>` dates in sitemap.xml

**Format**: `YYYY-MM-DD` (ISO date)

**Why**: Landing app sitemap needs deploy date, not file modification date.

---

## Deployment Summary

**Success Output** (GitHub Actions summary):
```markdown
## 🚀 Deployment Successful!

- **Branch**: master/develop
- **Commit**: <sha>
- **Deployed by**: <actor>
- **Environment**: Production (OVH VPS)

### Services Deployed
- Landing App: https://tenpennynovels.com
- Game App: https://game.tenpennynovels.com
- Documents App: https://documenti.tenpennynovels.com
- Management App: https://gestione.tenpennynovels.com
- API Gateway: https://api.tenpennynovels.com
- WebSocket Server: https://ws.tenpennynovels.com
```

**Failure Output**:
```markdown
## ❌ Deployment Failed!

### Next Steps
1. Check logs above for error details
2. SSH into server to investigate
3. Check PM2 status: `pm2 status`
4. Check PM2 logs: `pm2 logs --lines 50`
5. If needed, revert to previous commit and re-deploy
```

---

## Rollback Strategy

### Via GitHub Actions

1. Identify last working commit: `git log --oneline`
2. Revert commit: `git revert <sha>` OR `git reset --hard <sha> && git push --force`
3. Push triggers automatic redeploy

### Via SSH (Faster)

```bash
# Find last working commit
git log --oneline -10

# Hard reset (⚠️ destructive)
git reset --hard <sha>

# Rebuild + restart
npm run build:frontend:all
npm run build:backend:all
pm2 restart all

# Verify
pm2 status
curl https://api.tenpennynovels.com/health
```

---

## Secrets Required

GitHub repository secrets:

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | OVH VPS hostname/IP |
| `SSH_PORT` | SSH port |
| `SSH_USERNAME` | SSH username |
| `SSH_PRIVATE_KEY` | SSH private key (RSA/Ed25519) |
| `HUGGINGFACE_TOKEN` | HuggingFace API token (model downloads) |

---

## Monitoring Deployment

### During Deploy

Watch GitHub Actions UI:
- Real-time logs for each step
- Progress indicators
- Error highlighting

### After Deploy

```bash
# SSH into server
ssh -p <port> <user>@<host>

# Check PM2 status
pm2 status

# Check recent logs
pm2 logs --lines 50

# Check specific service
pm2 logs tenpennynovels-api-gateway --lines 100

# Check resource usage
pm2 monit
```

---

## Common Issues

### Issue: Health Check Timeout

**Symptoms**: `❌ ws.tenpennynovels.com FAILED after 5 attempts`

**Causes**:
- MongoDB connection slow
- Redis connection slow
- Memory exhaustion (check `pm2 monit`)

**Solution**:
```bash
pm2 logs tenpennynovels-unified-backend --lines 100
# Check for connection errors
```

### Issue: Build Timeout

**Symptoms**: GitHub Actions step exceeds 10m timeout

**Causes**:
- VPS under load
- npm install downloading large packages

**Solution**:
1. Increase `command_timeout: 15m`
2. Or run build manually via SSH

### Issue: Dependencies Not Installed

**Symptoms**: `Cannot find module 'express'`

**Causes**:
- Hash check skipped install
- Corrupted node_modules

**Solution**:
```bash
# Force reinstall
rm .deps-hash
# Next deploy will reinstall
```

---

## Cross-References

- **Git workflow**: [03-git-workflow.md](./03-git-workflow.md)
- **Docker deployment**: [docker-deployment.md](./docker-deployment.md)
- **PM2 patterns**: [services/README.md](./services/README.md)
- **Node environment**: [02-node-environment.md](./02-node-environment.md)
