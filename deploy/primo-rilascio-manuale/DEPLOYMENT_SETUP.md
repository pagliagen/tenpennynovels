# GitHub Actions Deployment Setup Guide

Questa guida spiega come configurare il deployment automatico su OVH VPS tramite GitHub Actions.

## Prerequisiti

- Accesso SSH al VPS OVH (51.83.47.109)
- Permessi admin sul repository GitHub
- Git installato localmente

---

## 1. Generare SSH Deploy Key

**Sul tuo computer locale**, genera una chiave SSH dedicata per il deployment:

```bash
# Genera chiave ed25519 (più sicura di RSA)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/tenpennynovels-deploy

# IMPORTANTE: NON impostare passphrase (premi ENTER quando richiesto)
# GitHub Actions non può inserire passphrase interattive
```

Questo crea due file:
- `~/.ssh/tenpennynovels-deploy` - Chiave privata (per GitHub Secrets)
- `~/.ssh/tenpennynovels-deploy.pub` - Chiave pubblica (per OVH)

---

## 2. Configurare OVH VPS

**SSH nel VPS OVH**:

```bash
ssh ubuntu@51.83.47.109
```

**Aggiungi la chiave pubblica con restrizioni IP**:

```bash
# Crea directory .ssh se non esiste
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Copia la chiave pubblica dal tuo computer locale
# Opzione A: Manualmente
nano ~/.ssh/authorized_keys
# Incolla il contenuto di ~/.ssh/tenpennynovels-deploy.pub
# IMPORTANTE: Prefissa con restrizione IP GitHub Actions:
# from="140.82.112.0/20,143.55.64.0/20,185.199.108.0/22,192.30.252.0/22,20.*.*.*/12" ssh-ed25519 AAAA... github-actions-deploy

# Opzione B: Con ssh-copy-id (più semplice, ma senza restrizioni IP)
# Da local: ssh-copy-id -i ~/.ssh/tenpennynovels-deploy.pub ubuntu@51.83.47.109
# Poi editare manualmente per aggiungere "from=..." prefix

# Imposta permessi corretti
chmod 600 ~/.ssh/authorized_keys
```

**Esempio riga completa in authorized_keys**:
```
from="140.82.112.0/20,143.55.64.0/20,185.199.108.0/22,192.30.252.0/22" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyHere github-actions-deploy
```

**Verifica connessione dal tuo computer**:

```bash
# Test connessione con la nuova chiave
ssh -i ~/.ssh/tenpennynovels-deploy ubuntu@51.83.47.109 "echo 'Connection OK'"

# Dovresti vedere: Connection OK
```

---

## 3. Configurare GitHub Secrets

**Vai su GitHub**: Repository → Settings → Secrets and variables → Actions

**Crea questi 4 secrets**:

### 1. `SSH_PRIVATE_KEY`

```bash
# Copia il contenuto COMPLETO della chiave privata
cat ~/.ssh/tenpennynovels-deploy
```

Copia **TUTTO**, incluso:
```
-----BEGIN OPENSSH PRIVATE KEY-----
[contenuto chiave]
-----END OPENSSH PRIVATE KEY-----
```

**Su GitHub**: New repository secret
- Name: `SSH_PRIVATE_KEY`
- Secret: [incolla tutto il contenuto sopra]

### 2. `SSH_HOST`

- Name: `SSH_HOST`
- Secret: `51.83.47.109`

### 3. `SSH_USERNAME`

- Name: `SSH_USERNAME`
- Secret: `ubuntu`

### 4. `SSH_PORT`

- Name: `SSH_PORT`
- Secret: `22`

(Cambia con porta custom se hai modificato la configurazione SSH per sicurezza)

---

## 4. Verifica Setup

### Test 1: Verifica GitHub Secrets

Vai su: Repository → Settings → Secrets and variables → Actions

Dovresti vedere:
- ✅ SSH_PRIVATE_KEY
- ✅ SSH_HOST
- ✅ SSH_USERNAME
- ✅ SSH_PORT

### Test 2: Trigger Manual Deploy

1. Vai su: Repository → Actions → Deploy to OVH VPS
2. Click su "Run workflow"
3. Seleziona branch `master`
4. (Opzionale) Check "Skip health checks" per primo test
5. Click "Run workflow"

**Cosa aspettarsi**:
- ✅ Build check: ~5-10 minuti (compila tutto)
- ✅ Deploy: ~2-3 minuti (rsync + build remoto + restart)
- ✅ Health checks: ~30 secondi

**Se fallisce**:
- Controlla i logs del workflow
- Verifica SSH connection manualmente
- Verifica che i secrets siano corretti

### Test 3: Verifica PM2 su OVH

```bash
ssh ubuntu@51.83.47.109
pm2 status

# Dovresti vedere tutti i servizi "online"
# Se qualcuno è "errored" o "stopped":
pm2 logs [nome-processo] --lines 50
```

---

## 5. Workflow Automatico

Una volta configurato, il deployment è **completamente automatico**:

### Pull Request → Build Check
- Compila frontend e backend
- Se fallisce → PR bloccata ❌
- Se passa → PR mergeable ✅

### Push to Master → Full Deploy
- Build check
- rsync deploy (solo file modificati)
- Build remoto su OVH
- PM2 restart
- Health checks
- Deployment summary

### Manual Trigger
- Vai su Actions → Run workflow
- Utile per re-deploy o hotfix

---

## 6. Monitoring & Troubleshooting

### Vedere i Deploy

GitHub → Actions → Deploy to OVH VPS

### SSH nel Server

```bash
ssh ubuntu@51.83.47.109
cd ~/tenpennynovels
pm2 status
pm2 logs --lines 50
```

### Rollback Manuale

Se il deploy rompe qualcosa:

```bash
# 1. SSH nel server
ssh ubuntu@51.83.47.109
cd ~/tenpennynovels

# 2. Torna al commit precedente
git log --oneline -5  # Vedi ultimi commit
git checkout <commit-hash-precedente>

# 3. Rebuild
npm run build:frontend:all
npm run build:backend:all

# 4. Restart
pm2 restart all

# 5. Verifica
pm2 status
curl https://api.tenpennynovels.com/health
```

### Health Check Endpoints

- API Gateway: https://api.tenpennynovels.com/health
- WebSocket: https://ws.tenpennynovels.com/health

Se questi non rispondono 200, il deploy è considerato fallito.

---

## 7. Sicurezza Best Practices

✅ **Implementate**:
- SSH key dedicata (non riusa chiave personale)
- Key type ed25519 (più sicuro di RSA)
- No passphrase (necessario per automation)
- IP restriction su authorized_keys (solo GitHub Actions IPs)
- Secrets encrypted in GitHub (at rest)
- rsync exclude list (no .env, no secrets trasferiti)

⚠️ **Raccomandazioni**:
- Cambia porta SSH default (22 → custom)
- Abilita fail2ban sul VPS
- Setup backup automatico MongoDB
- Rate limiting su Nginx
- Monitoring (PM2 Plus o Datadog)

---

## 8. File Esclusi dal Deploy

Il file `.github/rsync-exclude.txt` previene il trasferimento di:

- `node_modules/` (reinstallato remoto)
- `.env` files (già sul server)
- `.next/`, `dist/` (generati da build remoto)
- `.git/` (non serve in produzione)
- Logs, cache, temporary files
- OS files (.DS_Store, etc.)

**Mai modificare** `.env.production` files sul server via rsync!
Questi contengono secrets e vanno editati manualmente via SSH.

---

## 9. Performance Notes

### Deploy Time Breakdown

- **Build check** (GitHub Actions runner): 5-10 min
  - npm install: ~2 min (cached: ~30s)
  - Build frontend: ~3-5 min
  - Build backend: ~2-3 min

- **rsync transfer**: ~30-60s
  - Trasferisce solo file modificati (checksum-based)
  - Compressione abilitata (-z flag)

- **Remote build** (OVH VPS): 5-10 min
  - npm install: ~2 min (skip se package-lock.json unchanged)
  - Build frontend: ~3-5 min
  - Build backend: ~2-3 min

- **PM2 restart**: ~5-10s
  - Graceful restart (zero downtime su cluster mode)

**Total**: ~12-20 minuti per deploy completo

### Ottimizzazioni Future

- [ ] Build in GitHub Actions + upload artifacts (tradeoff: env vars)
- [ ] Parallel builds frontend/backend su OVH
- [ ] Docker deployment (rollback istantaneo)
- [ ] Blue-Green deployment (zero downtime garantito)

---

## 10. Troubleshooting Comune

### Errore: "Permission denied (publickey)"

**Causa**: GitHub Actions non riesce a connettersi via SSH

**Fix**:
1. Verifica che `SSH_PRIVATE_KEY` sia corretto (con `-----BEGIN` e `-----END`)
2. Verifica che la chiave pubblica sia in `~/.ssh/authorized_keys` su OVH
3. Verifica permessi: `chmod 600 ~/.ssh/authorized_keys`
4. Test manuale: `ssh -i ~/.ssh/tenpennynovels-deploy ubuntu@51.83.47.109`

### Errore: "rsync: connection unexpectedly closed"

**Causa**: rsync fallisce durante trasferimento

**Fix**:
1. Verifica connessione SSH
2. Verifica spazio disco su OVH: `df -h`
3. Verifica permessi su `~/tenpennynovels/`

### Errore: "Health check failed"

**Causa**: Backend non risponde dopo deploy

**Fix**:
1. SSH nel server: `pm2 status`
2. Se servizio "errored": `pm2 logs [nome] --lines 50`
3. Common issues:
   - Build fallito (vedi logs)
   - Env vars mancanti (check `.env.production`)
   - MongoDB/Redis down (check `sudo systemctl status mongod redis`)

### Build fallisce con "ENOENT: no such file or directory"

**Causa**: File o directory mancante

**Fix**:
1. Verifica che tutti i servizi esistano (no authentication-backend, game-backend)
2. Verifica che `package.json` sia aggiornato
3. Verifica che `.nvmrc` esista (Node version)

---

## 11. Next Steps

Dopo il primo deploy, considera:

1. **Setup monitoring**:
   - PM2 Plus (APM integrato)
   - Datadog o New Relic
   - Custom health check script (cron)

2. **Setup alerting**:
   - Slack/Discord webhook per deploy failures
   - Email notifications
   - PagerDuty per incident management

3. **Backup automatico**:
   - MongoDB dump daily
   - Backup offsite (OVH Object Storage)
   - Test restore procedure

4. **Staging environment**:
   - Branch `staging` → VPS staging
   - Test deploy before production

---

## Support

**Issues GitHub Actions**: Controlla logs in Repository → Actions

**Issues VPS**: SSH nel server e controlla PM2 logs

**Rollback urgente**: Vedi sezione 6

**Domande**: Chiedi al team o consulta la documentazione OVH

---

**Setup completato con successo? 🎉**

Ora ogni push a `master` deploya automaticamente su produzione!
