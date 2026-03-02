# Environment Variables

**Navigation**: [Home](../INDEX.md) > [Infrastructure](./README.md) > Environment Variables

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Complete reference per tutte le environment variables di TenpennyNovels.

---

## Overview

TenpennyNovels utilizza un sistema di environment variables centralizzato per configurazione cross-service. Tutte le variabili sono definite in `.env` alla root del progetto e condivise tra frontend e backend services.

**File Structure**:
```
tenpennynovels/
├── .env                    # Main environment file (NEVER commit!)
├── .env.example            # Template con valori di default
└── services/
    ├── unified-backend/
    │   └── .env.local      # Override locali (optional)
    └── api-gateway/
        └── .env.local      # Override locali (optional)
```

**Loading Priority** (highest to lowest):
1. Service-specific `.env.local` (overrides)
2. Global `.env` (main config)
3. Default values in code

---

## Core Infrastructure

### Node Environment

```bash
NODE_ENV=development  # development | production | test
```

**Usage**: Abilita/disabilita features based on environment
- `development`: Hot-reload, verbose logs, mock email
- `production`: Minified assets, error tracking, real SMTP
- `test`: Test database, mock services

---

### Database Configuration

#### MongoDB Connection

```bash
# Application URI (used by backends)
MONGODB_URI=mongodb://username:password@mongodb:27017/tenpennynovels?authSource=admin

# Infrastructure (Docker Compose init)
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=<secure-password-here>
MONGO_INITDB_DATABASE=tenpennynovels
MONGODB_INFRA_HOST=tenpennynovels-mongodb
MONGODB_INFRA_PORT=27017

# Application User (created by init-mongo.js)
MONGODB_APP_USERNAME=tenpennyuser
MONGODB_APP_PASSWORD=<app-password-here>
MONGODB_APP_DATABASE=tenpennynovels
```

**Special Characters in Password**:
```bash
# URL encoding required
! = %21    @ = %40    # = %23    $ = %24
% = %25    ^ = %5E    & = %26    * = %2A
```

**Example with special chars**:
```bash
# Password: P@ssw0rd!123
MONGODB_URI=mongodb://admin:P%40ssw0rd%21123@mongodb:27017/tenpennynovels?authSource=admin
```

**Generate Secure Password**:
```bash
openssl rand -base64 32
```

---

#### Redis Connection

```bash
# Application URL
REDIS_URL=redis://redis:6379

# Infrastructure (Docker)
REDIS_INFRA_PASSWORD=<redis-password-here>
REDIS_INFRA_HOST=tenpennynovels-redis
REDIS_INFRA_PORT=6379

# Individual components (legacy, prefer REDIS_URL)
REDIS_HOST=redis
REDIS_PORT=6379
```

**Production**: Sempre abilitare password con `requirepass` in `redis.conf`

---

#### Qdrant Vector Database

```bash
QDRANT_URL=http://qdrant:6333
```

**Ports**:
- `6333`: HTTP API (main)
- `6334`: gRPC (optional)

---

### Embeddings Service

```bash
# Service URL (internal Docker network)
EMBEDDINGS_SERVICE_URL=http://embeddings-service:5001

# Model Configuration
EMBEDDINGS_MODEL=paraphrase-multilingual-MiniLM-L12-v2
EMBEDDINGS_SERVICE_HOST=0.0.0.0
EMBEDDINGS_SERVICE_PORT=5001
EMBEDDINGS_LOG_LEVEL=INFO  # DEBUG | INFO | WARNING | ERROR
```

**Model Details**:
- **Name**: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
- **Dimension**: 384D
- **Languages**: Multilingual (EN, IT, FR, DE, ES, etc.)
- **Performance**: ~50ms per embedding (cached)

---

## Authentication & Security

### JWT Secrets

```bash
# User authentication token
JWT_SECRET=<generate-secure-secret-32-chars-minimum>
JWT_REFRESH_SECRET=<generate-secure-secret-32-chars-minimum>
JWT_EXPIRES_IN=24h

# Character session manager (character context token)
CHARACTER_SESSION_MANAGER_SECRET=<generate-secure-secret>
```

**Generate Secrets**:
```bash
# Method 1: Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 2: OpenSSL
openssl rand -hex 32

# Method 3: pwgen
pwgen -s 64 1
```

**Token Lifetime**:
- `JWT_EXPIRES_IN`: User auth token (default: 24h)
- Refresh token: 30 days (hardcoded in auth service)
- Character context: 24h (hardcoded in character session manager)

---

### NextAuth (Frontend)

```bash
NEXTAUTH_SECRET=<your-super-secret-nextauth-key-minimum-32-characters>
NEXTAUTH_URL=http://localhost:4000
```

**Production**: Usa dominio pubblico (e.g., `https://tenpennynovels.com`)

---

## Game Configuration

### Character Creation Rules (Call of Cthulhu)

```bash
# Stat Points Distribution
CHARACTER_STAT_TOTAL_POINTS=400        # Total points to distribute
CHARACTER_MAX_STATS_ABOVE_80=2         # Max stats that can exceed 80

# Skill Caps
CHARACTER_SKILL_CAP=75                 # Max skill value during creation
CHARACTER_FINAL_SKILL_CAP=80           # Max after occupation bonuses

# Occupation Bonuses
NEXT_PUBLIC_OCCUPATION_REQUIRED_SKILL_MINIMUM=40  # Min for required skills
NEXT_PUBLIC_OCCUPATION_BONUS_SKILL_POINTS=30      # Bonus points to distribute
```

**Automatic Minimums** (free points):
```bash
CHARACTER_MIN_DEX=30     # Dexterity
CHARACTER_MIN_CON=30     # Constitution
CHARACTER_MIN_STR=20     # Strength
CHARACTER_MIN_SIZ=20     # Size
CHARACTER_MIN_EDU=15     # Education
CHARACTER_MIN_INT=15     # Intelligence
CHARACTER_MIN_POW=15     # Power
CHARACTER_MIN_CHA=15     # Charisma
```

**Total Free Points**: 160 (30+30+20+20+15+15+15+15)
**Points to Distribute**: 240 (400 - 160)

**Details**: [Character System](../03-game-systems/character-system.md)

---

### Experience System

```bash
# Daily Experience Points
DAILY_XP_AMOUNT=10                     # XP awarded daily at midnight
DAILY_XP_HOUR=0                        # Hour (0-23) for XP distribution
DAILY_XP_MINUTE=0                      # Minute (0-59)

# Skill Point Costs
SKILL_POINT_COST_BASE=5                # Base cost per skill increase
SKILL_POINT_COST_MULTIPLIER=1.5        # Multiplier for higher levels
```

**Cron Schedule**: `0 0 * * *` (daily at midnight UTC)

**Details**: [Experience Points](../03-game-systems/experience-points.md)

---

### Housing System

```bash
# Rent Collection
RENT_COLLECTION_HOUR=6                 # Hour (0-23) for rent collection
RENT_COLLECTION_MINUTE=0               # Minute (0-59)
RENT_GRACE_PERIOD_DAYS=3               # Grace period before marking overdue

# Eviction
EVICTION_DAYS_OVERDUE=14               # Days overdue before eviction
EVICTION_NOTIFICATION_DAYS=7           # Days before eviction to notify
```

**Cron Schedule**: `0 6 * * *` (daily at 6am UTC)

**Details**: [Housing System](../03-game-systems/housing-system.md)

---

## Frontend Application URLs

### Development (localhost)

```bash
# Landing Page (Login, Registration)
LANDING_URL=http://localhost:4000
FRONTEND_URL=http://localhost:4000
BASE_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:4000

# Game Application (Main Gameplay)
GAME_URL=http://localhost:4001

# Documents Browser
DOCUMENTS_URL=http://localhost:4002
DOCS_URL=http://localhost:4002

# Forum (Future)
FORUM_URL=http://localhost:4003

# Management Panel (Admin)
MANAGEMENT_URL=http://localhost:4004

# Tickets (Future)
TICKETS_URL=http://localhost:4005
```

---

### Production Domains

```bash
# Public URLs
LANDING_URL=https://tenpennynovels.com
GAME_URL=https://game.tenpennynovels.com
DOCUMENTS_URL=https://documenti.tenpennynovels.com
MANAGEMENT_URL=https://gestione.tenpennynovels.com
```

**DNS Configuration**:
- `tenpennynovels.com` → Landing (Vercel/Nginx)
- `game.tenpennynovels.com` → Game App (Vercel/Nginx)
- `documenti.tenpennynovels.com` → Documents App (Vercel/Nginx)
- `gestione.tenpennynovels.com` → Management Panel (Vercel/Nginx)

---

## Backend Service URLs

### Internal (Docker Network)

```bash
# API Gateway (Public Entry Point)
API_GATEWAY_URL=http://api-gateway:8000

# Unified Backend
UNIFIED_BACKEND_URL=http://unified-backend:3001

# Legacy aliases (all point to unified-backend now)
AUTH_BACKEND_URL=http://unified-backend:3001
GAME_BACKEND_URL=http://unified-backend:3001
MANAGEMENT_BACKEND_URL=http://unified-backend:3001
DOCUMENTS_BACKEND_URL=http://unified-backend:3001
TICKETS_BACKEND_URL=http://unified-backend:3001
FORUM_BACKEND_URL=http://unified-backend:3001

# BotAI Backend (disabled temporarily)
# BOTAI_BACKEND_URL=http://botai-backend:8080
```

---

### External (Host Access)

```bash
# Development
API_GATEWAY_URL=http://localhost:8000

# Production (behind Nginx reverse proxy)
API_GATEWAY_URL=https://api.tenpennynovels.com
```

---

## WebSocket Configuration

```bash
# WebSocket Server
SOCKET_PORT=3001                       # Socket.IO on unified-backend
WEBSOCKET_URL=http://localhost:3001

# CORS Origins
SOCKET_CORS_ORIGIN=http://localhost:4000,http://localhost:4001
```

**Production**: Separare origins con virgola
```bash
SOCKET_CORS_ORIGIN=https://tenpennynovels.com,https://game.tenpennynovels.com
```

**Details**: [WebSocket Patterns](../05-frontend/websocket-patterns.md)

---

## Email Configuration

### Development (Mock)

```bash
EMAIL_MOCK=true
EMAIL_FROM=noreply@tenpennynovels.test
```

**Behavior**: Email logs to console invece di inviare

---

### Production (SMTP)

```bash
EMAIL_MOCK=false
EMAIL_FROM=TenpennyNovels <noreply@tenpennynovels.com>

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587                          # 587 (TLS) | 465 (SSL)
SMTP_USER=noreply@tenpennynovels.com
SMTP_PASSWORD=<app-password>          # Gmail: use App Password, not account password
SMTP_SECURE=false                      # true for port 465, false for 587
```

**Gmail App Password**:
1. Enable 2FA su account Gmail
2. Vai a https://myaccount.google.com/apppasswords
3. Genera "App Password" per "Mail"
4. Usa password generata in `SMTP_PASSWORD`

---

## BotAI Configuration (Disabled)

```bash
# BotAI Backend (temporarily disabled)
# BOT_API_KEY=<generate-secure-key>
# ANTHROPIC_API_KEY=sk-ant-...
# BOT_AI_MODEL=claude-3-5-sonnet-20241022
# BOT_AI_MAX_TOKENS=2000
# BOT_AI_TEMPERATURE=0.9

# System Bot User
# SYSTEM_BOT_USER_ID=<mongodb-objectid-of-bot-user>
```

**Future**: Riabilitare quando botai-backend migrato a unified-backend paths

**Details**: [BotAI Backend](../02-backend/botai-backend.md)

---

## Development Settings

```bash
# Hot Reload
HOT_RELOAD=true

# Debug Mode
DEBUG_MODE=true

# Verbose Logging
LOG_LEVEL=debug  # debug | info | warn | error
```

---

## Production Settings

```bash
# SSL/TLS Certificates (Nginx)
SSL_CERT_PATH=/etc/letsencrypt/live/tenpennynovels.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/tenpennynovels.com/privkey.pem

# Trust Proxy (API Gateway)
TRUST_PROXY=true

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...
```

---

## Port Mapping Reference

### Frontend Ports (400x)

| Service | Port | URL |
|---------|------|-----|
| Landing | 4000 | http://localhost:4000 |
| Game | 4001 | http://localhost:4001 |
| Documents | 4002 | http://localhost:4002 |
| Forum | 4003 | http://localhost:4003 |
| Management | 4004 | http://localhost:4004 |
| Tickets | 4005 | http://localhost:4005 |

---

### Backend Ports (300x)

| Service | Port | URL |
|---------|------|-----|
| Unified Backend | 3001 | http://localhost:3001 |
| Management Backend | 3002 | http://localhost:3002 (legacy) |

---

### Infrastructure Ports

| Service | Port | URL |
|---------|------|-----|
| API Gateway | 8000 | http://localhost:8000 |
| MongoDB | 27017 | mongodb://localhost:27017 |
| Redis | 6379 | redis://localhost:6379 |
| Qdrant | 6333 | http://localhost:6333 |
| Embeddings Service | 5001 | http://localhost:5001 |
| Mongo Express | 8083 | http://localhost:8083 |
| Redis Commander | 8081 | http://localhost:8081 |

---

## Security Best Practices

### 1. Generate Strong Secrets

```bash
# 32-byte hex (64 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output example:
# 10bd0952daa072fa3a53c5b7284b91bc8ed84e0b64e582cd215778d7e0fc5b1c
```

---

### 2. Never Commit .env

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore
```

**Already in .gitignore**: ✅ Verified

---

### 3. Use Different Credentials Per Environment

```bash
# Development
JWT_SECRET=dev_secret_not_secure

# Production
JWT_SECRET=10bd0952daa072fa3a53c5b7284b91bc...
```

---

### 4. Rotate Credentials Regularly

**Schedule**:
- **JWT Secrets**: Ogni 90 giorni
- **Database Passwords**: Ogni 180 giorni
- **API Keys**: Ogni 365 giorni

**Process**:
1. Generate new secret
2. Add both old + new to backend (dual-key validation)
3. Deploy backend
4. Update .env with new secret
5. Wait 24h (JWT expiration)
6. Remove old secret from backend

---

### 5. URL Encode Special Characters

```bash
# Password: P@ssw0rd!#$
# Encoded:  P%40ssw0rd%21%23%24

MONGODB_URI=mongodb://admin:P%40ssw0rd%21%23%24@mongodb:27017/...
```

---

## Environment Validation

### Startup Checks (Unified Backend)

Il backend valida environment variables all'avvio:

```typescript
// Required variables
const required = [
  'MONGODB_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

// Validate
required.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

**Error Example**:
```
❌ Missing required environment variable: JWT_SECRET
Process exited with code 1
```

---

### Runtime Validation

```bash
# Check MongoDB connection
curl http://localhost:3001/health

# Expected response
{
  "status": "ok",
  "mongodb": "connected",
  "redis": "connected",
  "timestamp": "2026-03-01T10:00:00.000Z"
}
```

---

## Template (.env.example)

**Location**: `/tenpennynovels/.env.example`

**Usage**:
```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

**Template Structure**:
```bash
# =============================================================================
# CORE INFRASTRUCTURE
# =============================================================================
NODE_ENV=development

# Database
MONGODB_URI=mongodb://admin:admin123@mongodb:27017/tenpennynovels?authSource=admin
REDIS_URL=redis://redis:6379

# Secrets (CHANGE IN PRODUCTION!)
JWT_SECRET=dev_secret_change_in_production
JWT_REFRESH_SECRET=dev_refresh_secret_change_in_production
NEXTAUTH_SECRET=your-super-secret-nextauth-key-minimum-32-characters

# =============================================================================
# GAME CONFIGURATION
# =============================================================================
CHARACTER_STAT_TOTAL_POINTS=400
CHARACTER_SKILL_CAP=75

# ... (rest of template)
```

**Full Template**: See `/tenpennynovels/.env.example`

---

## Troubleshooting

### Missing Environment Variable

**Symptom**: `Error: Missing required environment variable: JWT_SECRET`

**Solution**:
1. Check `.env` exists: `ls -la .env`
2. Check variable presente: `grep JWT_SECRET .env`
3. Check no trailing spaces: `cat -A .env | grep JWT_SECRET`
4. Reload environment: `source .env` (bash) or restart service

---

### Special Characters in Password

**Symptom**: `MongoServerError: Authentication failed`

**Solution**: URL encode password
```bash
# Original: P@ssw0rd!
# Encoded:  P%40ssw0rd%21

MONGODB_URI=mongodb://admin:P%40ssw0rd%21@mongodb:27017/...
```

---

### Wrong MongoDB Database

**Symptom**: Collections non trovate

**Check**:
```bash
# In connection string
MONGODB_URI=mongodb://...@mongodb:27017/tenpennynovels?authSource=admin
                                          ^^^^^^^^^^^^^ Must match MONGO_INITDB_DATABASE
```

---

## Related Documentation

- [Docker Compose](./docker-compose.md) - Service configuration
- [Deployment Guide](../06-operations/deployment-guide.md) - Production setup
- [Character System](../03-game-systems/character-system.md) - Character creation rules
- [Housing System](../03-game-systems/housing-system.md) - Housing configuration
- [BotAI Backend](../02-backend/botai-backend.md) - AI service config

---

## Quick Reference

**Generate Secret**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
**Copy Template**: `cp .env.example .env`
**Validate**: `curl http://localhost:3001/health`
**Security**: Never commit `.env`, rotate secrets every 90 days, URL-encode special chars
