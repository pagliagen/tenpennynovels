# Deploy Scripts - Automazione Rilascio

Questa cartella contiene gli script usati dal workflow GitHub Actions e per operazioni manuali di deploy.

## 🤖 Script Automatici (usati da GitHub Actions)

### `install-all.sh`
Installa tutte le dipendenze npm in:
- Root monorepo
- Tutti i frontend apps (apps/*)
- Tutti i backend services (services/*)

**Usato da**:
- `.github/workflows/deploy.yml` (build-check job)
- SSH remote script (deploy job, se package-lock.json cambiato)

**Esecuzione**:
```bash
./deploy/scripts/install-all.sh
```

---

---

## 📝 Note

- `scripts/` contiene SOLO script usati da GitHub Actions automaticamente
- Per script manuali → Vedi [../utility/](../utility/)
- Per script setup iniziale → Vedi [../primo-rilascio-manuale/](../primo-rilascio-manuale/)

---

## 📦 Workflow GitHub Actions

Il workflow `.github/workflows/deploy.yml` usa questi script in questa sequenza:

### Build Check Job (PR + Push)
1. Checkout code
2. Setup Node.js 22.13.1
3. **Run `install-all.sh`** ← Script automatico
4. Build all frontend
5. Build all backend

### Deploy Job (Push to master only)
1. Checkout code
2. rsync deploy (file changes only)
3. SSH remote:
   - **Run `install-all.sh`** (se package-lock.json cambiato) ← Script automatico
   - Build all frontend
   - Build all backend
   - PM2 restart all
4. Health checks

---

## 🚀 Comandi Rapidi

### Deploy Completo Manuale
```bash
# Sul server OVH
cd ~/tenpennynovels
./deploy/scripts/install-all.sh
./deploy/scripts/build-all.sh
pm2 restart all
```

### Rebuild Solo Frontend
```bash
# Sul server OVH
cd ~/tenpennynovels
./deploy/scripts/rebuild-frontend.sh
pm2 restart tenpennynovels-landing tenpennynovels-game tenpennynovels-documenti tenpennynovels-gestione
```

### Rebuild Solo Backend
```bash
# Sul server OVH
cd ~/tenpennynovels
npm run build:backend:all
pm2 restart tenpennynovels-api-gateway tenpennynovels-unified-backend
```

---

## 🔍 Debugging

### Script fallisce con "command not found"
```bash
# Verifica permessi esecuzione
chmod +x deploy/scripts/*.sh

# Verifica Node version
node -v  # Deve essere 22.13.1
nvm use  # Se hai nvm installato
```

### Build fallisce con "MODULE_NOT_FOUND"
```bash
# Reinstalla dipendenze
./deploy/scripts/install-all.sh
```

### PM2 services crashano dopo restart
```bash
# Verifica logs
pm2 logs --lines 50

# Verifica .env.production files
ls -la apps/*/  .env.production
ls -la services/*/.env.production
```

---

## 📝 Note

- Tutti gli script assumono di essere eseguiti dalla **root del progetto**
- Gli script sono **idempotent** - possono essere eseguiti più volte senza problemi
- Scripts con `set -e` terminano al primo errore
- Production usa `npm install --production` (no devDependencies)

---

**Vedi anche**: [../primo-rilascio-manuale/](../primo-rilascio-manuale/) per setup iniziale server
