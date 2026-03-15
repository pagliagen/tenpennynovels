# GitHub Actions Setup

**Navigation**: [Deploy Hub](./README.md) > GitHub Setup

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-15

Guida completa per configurare GitHub Actions per il deploy automatico di TenPennyNovels su VPS.

---

## Overview

Il sistema di deploy usa GitHub Actions per automatizzare il deployment su VPS OVH ogni volta che fai push sul branch `master`.

```mermaid
flowchart LR
    Dev[Developer Push] --> GH[GitHub Actions]
    GH --> Build[Build Check]
    Build --> Rsync[rsync to VPS]
    Rsync --> Install[Install Deps]
    Install --> BuildVPS[Build on VPS]
    BuildVPS --> PM2[PM2 Restart]
    PM2 --> Health[Health Checks]
    Health --> Success[Deploy Success]
```

---

## Workflow File

Il workflow è definito in `.github/workflows/deploy.yml`:

```yaml
name: Deploy to OVH VPS

on:
  pull_request:
    branches: [master]
  push:
    branches: [master]
  workflow_dispatch:
    inputs:
      skip_health_check:
        description: 'Skip health checks after deploy'
        required: false
        default: false
        type: boolean
```

**Trigger**:
- **Push to master**: Deploy automatico
- **Pull Request to master**: Solo build check (NO deploy)
- **Manual dispatch**: Deploy manuale da GitHub UI

---

## GitHub Secrets Configuration

GitHub Actions richiede 4 secrets per connettersi al VPS via SSH.

### Dove Configurare i Secrets

1. Vai su GitHub repository: `https://github.com/YOUR_USERNAME/tenpennynovels`
2. Clicca **Settings** (tab in alto)
3. Nel menu laterale: **Secrets and variables** → **Actions**
4. Clicca **New repository secret**

---

## Secret 1: SSH_HOST

**Descrizione**: Indirizzo IP o hostname del VPS

**Valore**: IP pubblico del VPS (esempio: `51.83.47.109`)

**Come Trovare**:
```bash
# Se sei già connesso al VPS:
curl ifconfig.me

# Oppure controlla email di provisioning VPS
# Oppure dashboard provider (OVH, DigitalOcean, etc.)
```

**Configurazione GitHub**:
- Name: `SSH_HOST`
- Secret: `51.83.47.109` (esempio)

---

## Secret 2: SSH_PORT

**Descrizione**: Porta SSH del VPS

**Valore**: `22` (default SSH port)

**Nota**: Se hai modificato la porta SSH in `/etc/ssh/sshd_config`, usa quella porta.

**Configurazione GitHub**:
- Name: `SSH_PORT`
- Secret: `22`

---

## Secret 3: SSH_USERNAME

**Descrizione**: Username dell'utente deploy sul VPS

**Valore**: `deploy` (utente creato in [ubuntu-from-zero.md](./ubuntu-from-zero.md) STEP 3)

**Configurazione GitHub**:
- Name: `SSH_USERNAME`
- Secret: `deploy`

---

## Secret 4: SSH_PRIVATE_KEY

**Descrizione**: Chiave SSH privata per autenticazione

**CRITICO**: Questa è la chiave privata generata in [ubuntu-from-zero.md](./ubuntu-from-zero.md) STEP 4.

### Genera Nuova Chiave SSH (se non l'hai già)

```bash
# Sul tuo computer locale (NON sul server!)
ssh-keygen -t ed25519 -C "github-actions@tenpennynovels" -f ~/.ssh/tenpennynovels_github_actions

# Quando chiede passphrase: lascia vuoto (premi Enter 2 volte)
# Questo genera:
#   ~/.ssh/tenpennynovels_github_actions       (chiave privata)
#   ~/.ssh/tenpennynovels_github_actions.pub   (chiave pubblica)
```

### Installa Chiave Pubblica sul VPS

```bash
# Sul tuo computer locale, copia chiave pubblica
cat ~/.ssh/tenpennynovels_github_actions.pub

# Output: ssh-ed25519 AAAA...xyz github-actions@tenpennynovels
# Copia TUTTO l'output

# Connettiti al VPS
ssh deploy@<IP_VPS>

# Aggiungi chiave pubblica ad authorized_keys
nano ~/.ssh/authorized_keys

# Incolla la chiave pubblica su una NUOVA riga (non sovrascrivere esistenti!)
# Salva: Ctrl+O, Enter, Ctrl+X

# Verifica permessi
chmod 600 ~/.ssh/authorized_keys
```

### Test Connessione con Nuova Chiave

```bash
# Sul tuo computer locale
ssh -i ~/.ssh/tenpennynovels_github_actions deploy@<IP_VPS>

# Dovresti entrare senza password
# Se funziona: ✅ Chiave configurata correttamente
```

### Copia Chiave Privata per GitHub Secret

```bash
# Sul tuo computer locale
cat ~/.ssh/tenpennynovels_github_actions

# Output: (copia TUTTO l'output, incluse righe BEGIN e END)
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
...
...
-----END OPENSSH PRIVATE KEY-----
```

**Configurazione GitHub**:
- Name: `SSH_PRIVATE_KEY`
- Secret: Incolla TUTTA la chiave privata (tutte le righe, incluse BEGIN e END)

**ATTENZIONE**:
- ❌ NON condividere mai la chiave privata
- ❌ NON committare la chiave privata nel repository
- ❌ NON inviare la chiave via email/chat
- ✅ La chiave privata deve rimanere solo su: tuo computer locale + GitHub Secrets

---

## Verifica Secrets Configurati

Dopo aver configurato tutti i 4 secrets, verifica:

1. Vai su GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Dovresti vedere 4 repository secrets:
   - `SSH_HOST`
   - `SSH_PORT`
   - `SSH_USERNAME`
   - `SSH_PRIVATE_KEY`

**Screenshot atteso** (GitHub UI):
```
Repository secrets
┌──────────────────────────────────────────────────────────┐
│ SSH_HOST                       Updated 2 minutes ago     │
│ SSH_PORT                       Updated 2 minutes ago     │
│ SSH_PRIVATE_KEY               Updated 1 minute ago       │
│ SSH_USERNAME                   Updated 2 minutes ago     │
└──────────────────────────────────────────────────────────┘
```

---

## Test GitHub Actions Workflow

### Opzione A: Push al Branch Master

```bash
# Sul tuo computer locale, nel repository tenpennynovels
git checkout master
git pull origin master

# Fai una modifica test (esempio: README.md)
echo "\n<!-- Test deploy $(date) -->" >> README.md
git add README.md
git commit -m "Test GitHub Actions deploy"
git push origin master

# Vai su GitHub repository → Actions tab
# Dovresti vedere workflow "Deploy to OVH VPS" in esecuzione
```

### Opzione B: Manual Dispatch

1. Vai su GitHub repository → **Actions** tab
2. Nel menu laterale: seleziona workflow **Deploy to OVH VPS**
3. Clicca **Run workflow** (bottone in alto a destra)
4. Seleziona branch: `master`
5. Skip health checks: No (lascia default)
6. Clicca **Run workflow** (bottone verde)

---

## Workflow Stages Spiegazione

### Stage 1: Build Check (PR + Push)

```yaml
jobs:
  build-check:
    name: Build Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
      - name: Setup Node.js
      - name: Install all dependencies
      - name: Build all frontend apps
      - name: Build all backend services
```

**Purpose**: Verifica che il codice compili correttamente PRIMA di fare deploy.

**Duration**: ~10-15 minuti

**Failure**: Se build fallisce, il workflow si ferma qui (NO deploy).

---

### Stage 2: Deploy Files via rsync (Solo Push/Dispatch)

```yaml
- name: Deploy files via rsync
  uses: burnett01/rsync-deployments@7.0.1
  with:
    switches: -avzr --delete --exclude-from='.github/rsync-exclude.txt'
    path: ./
    remote_path: ~/tenpennynovels/
    remote_host: ${{ secrets.SSH_HOST }}
    remote_port: ${{ secrets.SSH_PORT }}
    remote_user: ${{ secrets.SSH_USERNAME }}
    remote_key: ${{ secrets.SSH_PRIVATE_KEY }}
```

**Purpose**: Sincronizza codice da GitHub al VPS via rsync.

**Flags**:
- `-a`: Archive mode (preserve permissions, timestamps)
- `-v`: Verbose
- `-z`: Compress during transfer
- `-r`: Recursive
- `--delete`: Rimuovi file sul server che non esistono più nel repo
- `--exclude-from`: Escludi file da `.github/rsync-exclude.txt`

**Excluded Files** (`.github/rsync-exclude.txt`):
```
.git/
.github/
node_modules/
.next/
dist/
*.log
.env*
.DS_Store
```

**Duration**: ~2-3 minuti (dipende da quanti file sono cambiati)

---

### Stage 3: Install Dependencies

```yaml
- name: Install dependencies
  script: |
    # Smart dependency installation: only if package.json/package-lock.json changed
    NEW_HASH=$(find . -maxdepth 3 -name 'package.json' -o -name 'package-lock.json' | sort | xargs cat | sha256sum | cut -d' ' -f1)
    OLD_HASH=$(cat .deps-hash 2>/dev/null || echo "")

    if [ "$NEW_HASH" != "$OLD_HASH" ]; then
      echo "📦 Dependency files changed — installing..."
      npm install --production  # Root
      # Apps
      for app in apps/*/; do
        (cd "$app" && npm install --production)
      done
      # Services
      for service in services/*/; do
        (cd "$service" && npm install)
      done
      echo "$NEW_HASH" > .deps-hash
    else:
      echo "⏭️  Skipping dependency installation (no changes)"
    fi
```

**Purpose**: Installa dipendenze solo se `package.json` o `package-lock.json` sono cambiati.

**Optimization**: Hash comparison evita `npm install` inutili (~5-10 min saved).

**Duration**:
- Se dependencies cambiate: ~5-10 minuti
- Se dependencies non cambiate: ~5 secondi (skip)

---

### Stage 4: Build Frontend Apps

```yaml
- name: Build frontend apps
  script: |
    npm run build:frontend:all
```

**Purpose**: Build tutte le 4 app Next.js (landing, game, documents, management).

**Command**: Esegue `npm run build` in ogni app.

**Duration**: ~10-15 minuti

**Output**: Directory `.next/` in ogni app con bundle produzione.

---

### Stage 5: Build Backend Services

```yaml
- name: Build backend services
  script: |
    npm run build:backend:all
```

**Purpose**: Build tutti i 3 backend services (api-gateway, unified-backend, embeddings-worker).

**Command**: Esegue `npm run build` in ogni service (TypeScript → JavaScript).

**Duration**: ~2-3 minuti

**Output**: Directory `dist/` in ogni service con file `.js` compilati.

---

### Stage 6: Setup Python for Embeddings Worker

```yaml
- name: Setup Python for embeddings worker
  script: |
    cd ~/tenpennynovels/services/embeddings-worker/python
    rm -rf .venv
    python3 -m venv venv
    source venv/bin/activate
    pip3 install --upgrade pip
    pip3 install -r requirements.txt
    python3 setup-models.py  # Pre-download HuggingFace models
```

**Purpose**: Installa dipendenze Python e pre-scarica modelli HuggingFace.

**Duration**: ~5-10 minuti (download modelli può essere lento)

**Note**: Se `setup-models.py` fallisce (rate limit HuggingFace), i modelli saranno scaricati al primo utilizzo (non blocca deploy).

---

### Stage 7: Restart PM2 Services

```yaml
- name: Restart PM2 services
  script: |
    pm2 startOrRestart ecosystem.config.js --update-env --env production
```

**Purpose**: Riavvia tutti i 7 processi PM2 con nuova versione.

**Command**: `pm2 startOrRestart` → start se non esistono, restart se esistono.

**Duration**: ~30-60 secondi

**CRITICO**: `--update-env` ricarica variabili d'ambiente da `.env.production`.

---

### Stage 8: Verify PM2 Status

```yaml
- name: Verify PM2 status
  script: |
    sleep 5  # Wait for services to stabilize
    pm2 status --no-color
```

**Purpose**: Verifica che tutti i processi siano `online`.

**Output**: Tabella PM2 con status di tutti i 7 processi.

**Failure**: Se qualche processo è `errored`, il workflow fallisce.

---

### Stage 9: Health Checks

```yaml
- name: Health checks
  if: ${{ github.event.inputs.skip_health_check != 'true' }}
  script: |
    ENDPOINTS=(
      "https://api.tenpennynovels.com/health"
      "https://ws.tenpennynovels.com/health"
    )
    for url in "${ENDPOINTS[@]}"; do
      response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
      if [ "$response" -eq 200 ]; then
        echo "✅ $url OK ($response)"
      else
        echo "❌ $url FAILED ($response)"
        exit 1
      fi
    done
```

**Purpose**: Verifica che API Gateway e Unified Backend rispondano con HTTP 200.

**Duration**: ~5 secondi

**Skippable**: Può essere saltato con `skip_health_check: true` nel manual dispatch.

---

## Deploy Timeline

**Total Duration**: ~25-35 minuti (primo deploy) | ~15-20 minuti (deploy successivi)

| Stage | Duration | Skippable? |
|-------|----------|-----------|
| Build Check | 10-15 min | ❌ No |
| rsync Files | 2-3 min | ❌ No |
| Install Deps | 5-10 min (o 5 sec se no changes) | ✅ Auto-skip se no changes |
| Build Frontend | 10-15 min | ❌ No |
| Build Backend | 2-3 min | ❌ No |
| Setup Python | 5-10 min | ❌ No (ma model download può fallire senza bloccare) |
| Restart PM2 | 30-60 sec | ❌ No |
| Verify PM2 | 5 sec | ❌ No |
| Health Checks | 5 sec | ✅ Con manual dispatch |

---

## Troubleshooting

### Error: Permission denied (publickey)

**Causa**: SSH_PRIVATE_KEY non configurato correttamente.

**Fix**:
1. Verifica che `SSH_PRIVATE_KEY` secret contenga la chiave privata COMPLETA (incluse righe BEGIN/END)
2. Verifica che la chiave pubblica corrispondente sia in `~/.ssh/authorized_keys` sul VPS
3. Test manuale: `ssh -i ~/.ssh/tenpennynovels_github_actions deploy@<IP_VPS>`

---

### Error: rsync connection closed

**Causa**: SSH connection fallita durante rsync.

**Fix**:
1. Verifica tutti i 4 secrets (SSH_HOST, SSH_PORT, SSH_USERNAME, SSH_PRIVATE_KEY)
2. Verifica che il VPS sia online: `ping <IP_VPS>`
3. Verifica firewall: porta 22 deve essere aperta (`sudo ufw status`)

---

### Error: Health check failed

**Causa**: API Gateway o Unified Backend non rispondono.

**Fix**:
1. SSH nel VPS: `ssh deploy@<IP_VPS>`
2. Controlla PM2: `pm2 status`
3. Se processo è `errored`: `pm2 logs tenpennynovels-<nome> --lines 50`
4. Cause comuni:
   - `.env.production` mancante
   - MongoDB connection failed
   - Port already in use

---

### Error: Build failures

**Causa**: Codice non compila (TypeScript errors, dipendenze mancanti).

**Fix**:
1. Testa build localmente: `npm run build:frontend:all && npm run build:backend:all`
2. Risolvi errori TypeScript
3. Verifica `package.json` dependencies aggiornate
4. Commit fix e re-push

---

### Error: ENOSPC (No space left on device)

**Causa**: Disco pieno sul VPS.

**Fix**:
```bash
# SSH nel VPS
ssh deploy@<IP_VPS>

# Controlla spazio disco
df -h

# Pulisci node_modules vecchi (se necessario)
cd ~/tenpennynovels
find . -name 'node_modules' -type d -prune -exec du -sh {} \;

# Pulisci build cache
rm -rf apps/*/.next apps/*/node_modules services/*/node_modules services/*/dist

# Reinstalla dependencies
./deploy/scripts/install-all.sh
npm run build:frontend:all
npm run build:backend:all
pm2 restart all
```

---

### Error: pm2 command not found

**Causa**: PM2 non installato o PATH non configurato.

**Fix**:
```bash
# SSH nel VPS
ssh deploy@<IP_VPS>

# Verifica nvm caricato
which node
# Deve mostrare: /home/deploy/.nvm/versions/node/v22.13.1/bin/node

# Se NON caricato, aggiungi a ~/.bashrc:
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
source ~/.bashrc

# Verifica PM2
pm2 --version

# Se non installato:
npm install -g pm2
```

---

## Rollback Procedure

Se un deploy causa problemi in produzione:

### Opzione A: Rollback via Git

```bash
# SSH nel VPS
ssh deploy@<IP_VPS>
cd ~/tenpennynovels

# Trova commit precedente
git log --oneline -5

# Checkout commit precedente (esempio: 9d8c7b7)
git checkout 9d8c7b7

# Rebuild
npm run build:frontend:all
npm run build:backend:all

# Restart PM2
pm2 restart all

# Verifica
pm2 status
curl https://api.tenpennynovels.com/health
```

### Opzione B: Rollback via GitHub (Re-deploy)

```bash
# Sul tuo computer locale
cd ~/path/to/tenpennynovels

# Reset al commit precedente
git log --oneline -5
git reset --hard <commit-hash-precedente>

# Force push (ATTENZIONE: sovrascrive history)
git push origin master --force

# GitHub Actions farà deploy automatico del commit precedente
```

---

## Best Practices

### 1. Test Localmente Prima di Push

```bash
# Sul tuo computer locale
npm run build:frontend:all
npm run build:backend:all

# Se build fallisce localmente, NON fare push
```

### 2. Use Pull Requests per Modifiche Importanti

```bash
# Crea branch per feature
git checkout -b feature/my-feature
git push origin feature/my-feature

# Crea Pull Request su GitHub
# GitHub Actions eseguirà solo build check (NO deploy)
# Merge PR dopo review → deploy automatico
```

### 3. Monitor Deploy Logs

- Vai su GitHub → **Actions** tab durante deploy
- Clicca su workflow run per vedere log in real-time
- Se un stage fallisce, leggi i log per capire il problema

### 4. Health Check Post-Deploy

Dopo ogni deploy, verifica manualmente:
```bash
curl https://api.tenpennynovels.com/health
curl https://ws.tenpennynovels.com/health

# Visita nel browser:
# - https://tenpennynovels.com
# - https://game.tenpennynovels.com
# - https://documenti.tenpennynovels.com
# - https://gestione.tenpennynovels.com
```

### 5. Backup Prima di Deploy Rischioso

```bash
# SSH nel VPS prima di deploy rischioso
ssh deploy@<IP_VPS>

# Backup MongoDB
~/backup-mongodb.sh

# Backup .env files
tar -czf ~/env-backup-$(date +%Y%m%d).tar.gz apps/*/.env.production services/*/.env.production
```

---

## Advanced: Custom Deployment

### Deploy Solo Specifici Servizi

```bash
# SSH nel VPS
ssh deploy@<IP_VPS>
cd ~/tenpennynovels

# Build solo game app
cd apps/game
npm run build
pm2 restart tenpennynovels-game

# Build solo unified-backend
cd ../../services/unified-backend
npm run build
pm2 restart tenpennynovels-unified-backend
```

### Skip Health Checks (Manual Dispatch)

Utile se sai che health checks falliranno temporaneamente (esempio: maintenance MongoDB):

1. GitHub → Actions → Deploy to OVH VPS → Run workflow
2. Seleziona branch: `master`
3. **Skip health checks**: `true`
4. Run workflow

---

## Monitoring Deploy Frequency

```bash
# Sul tuo computer locale
cd ~/path/to/tenpennynovels

# Conta deploy ultimi 7 giorni
git log --since="7 days ago" --oneline --all | wc -l

# Visualizza ultimi 10 commit con date
git log --oneline --decorate --graph -10
```

---

## Security Notes

- ✅ SSH_PRIVATE_KEY è encrypted at rest in GitHub Secrets
- ✅ SSH_PRIVATE_KEY non appare mai nei log del workflow
- ✅ rsync usa connessione SSH encrypted
- ❌ NON committare mai SSH keys nel repository
- ❌ NON condividere GitHub Secrets
- ✅ Rota SSH keys periodicamente (ogni 6-12 mesi)

---

## Related Documentation

- [Ubuntu From Zero](./ubuntu-from-zero.md) - Setup server completo
- [PM2 Guide](./pm2-guide.md) - ecosystem.config.js dettagliato
- [Nginx Guide](./nginx-guide.md) - Configurazioni Nginx
- [VPS Troubleshooting](./vps-deployment-guide.md) - Fix specifici produzione
- [Deployment Overview](../docs/06-operations/deployment-guide.md) - Panoramica generale
