# Deployment Scripts

Script utility per deployment e setup di TenPennyNovels.

---

## 📜 Scripts

### install-all.sh

**Purpose**: Installa tutte le dipendenze (root + apps + services)

**Usage**:
```bash
./deploy/scripts/install-all.sh
```

**What it does**:
1. Install root dependencies (`npm install`)
2. Install frontend app dependencies (landing, game, documents, management)
3. Install backend service dependencies (api-gateway, unified-backend, embeddings-worker)

**Duration**: ~5-10 minuti (primo install) | ~1-2 min (successivi con cache)

**Used by**: GitHub Actions workflow (`.github/workflows/deploy.yml`)

---

### copy-env-files.sh

**Purpose**: Copia `.env` templates a destinazioni corrette come `.env.production`

**Usage**:
```bash
./deploy/scripts/copy-env-files.sh
```

**What it does**:
1. Copia `deploy/env-templates/*.env` → `apps/*/.env.production`
2. Copia `deploy/env-templates/*.env` → `services/*/.env.production`
3. Backup file esistenti (`.backup.YYYYMMDD_HHMMSS`)
4. Set secure permissions (`chmod 600`)

**Targets**:
- `apps/landing/.env.production`
- `apps/game/.env.production`
- `apps/documents/.env.production`
- `apps/management/.env.production`
- `services/api-gateway/.env.production`
- `services/unified-backend/.env.production`
- `services/embeddings-worker/.env.production`

**⚠️ IMPORTANT**: Edit `.env.production` files AFTER running this script to add real secrets!

---

## 🚫 Deprecated Scripts

Questi script sono stati deprecati e spostati in `DEPRECATED/`:

- ~~`setup-nginx.sh`~~ - Non necessario, nginx-configs sono già pronti
- ~~`setup-pm2.sh`~~ - Istruzioni già in docs/05-pm2-configuration.md
- ~~`build-all.sh`~~ - GitHub Actions fa già questo automaticamente
- ~~`setup-env.sh`~~ - Ridondante con copy-env-files.sh

---

## 📖 Documentation

- [Install Dependencies Guide](../docs/01-ubuntu-from-zero.md#step-16-installa-dipendenze)
- [GitHub Actions Workflow](../docs/02-github-setup.md)
