# Deploy Utility Scripts

Script **manuali occasionali** per operazioni speciali. NON usati dal workflow automatico.

---

## 🔧 Script Disponibili

### `rebuild-frontend.sh`
Rebuilda SOLO i frontend apps (più veloce del build completo).

**Quando usare**:
- Cambio solo codice frontend (no backend)
- Fix env vars frontend (`NEXT_PUBLIC_*`)
- Quick rebuild dopo hotfix frontend
- CSP policy changes

**Cosa fa**:
1. Rebuilda landing, game, documents, management apps
2. Mostra comandi PM2 per restart

**Esecuzione**:
```bash
# Sul server OVH
cd ~/tenpennynovels
./deploy/utility/rebuild-frontend.sh

# Poi restart PM2
pm2 restart tenpennynovels-landing tenpennynovels-game tenpennynovels-documenti tenpennynovels-gestione
```

---

### `fix-websocket-env.sh`
Fix specifico per WebSocket URL environment variables.

**Quando usare**:
- WebSocket non si connette dopo deploy
- Cambio URL WebSocket (da localhost a production)
- Fix CSP (Content Security Policy) per WebSocket
- Rebuild necessario dopo modifica env vars

**Cosa fa**:
1. Aggiorna `NEXT_PUBLIC_WS_URL` in `.env.production`
2. Rebuilda frontend apps che usano WebSocket
3. Restart PM2 services interessati

**Esecuzione**:
```bash
# Sul server OVH
cd ~/tenpennynovels
./deploy/utility/fix-websocket-env.sh
```

---

### `link-env.sh`
Crea symlink per file `.env` condivisi tra directory.

**Quando usare**:
- Setup development locale
- Condividere env vars tra servizi
- Evitare duplicazione file .env

**Cosa fa**:
- Crea symlink da una directory source a target
- Utile per development, NON per production

**Esecuzione**:
```bash
# Locale
./deploy/utility/link-env.sh
```

**⚠️ NOTA**: In production, ogni servizio ha il proprio `.env.production` separato. Non usare symlink in production!

---

## 📋 Quando NON Usare Questi Script

- ❌ Deploy automatico (GitHub Actions)
- ❌ Routine maintenance
- ❌ Ogni deploy

Questi script sono per **fix specifici** o **setup speciali** occasionali.

---

## 🔍 Differenza con Altri Script

| Directory | Scopo | Frequenza |
|-----------|-------|-----------|
| **primo-rilascio-manuale/** | Setup iniziale server | Una volta (primo deploy) |
| **scripts/** | Automazione deploy | Ogni deploy (GitHub Actions) |
| **utility/** | Fix occasionali | Quando serve (manuale) |

---

## 💡 Aggiungere Nuovi Utility Script

Se crei nuovi script manuali:

1. Mettili in `deploy/utility/`
2. Documenta qui cosa fanno
3. Aggiungi esempio d'uso
4. Specifica quando usarli

**Esempi di utility script futuri**:
- `fix-database-migration.sh` - Fix migration DB
- `clear-redis-cache.sh` - Flush Redis cache
- `rotate-jwt-secrets.sh` - Rotate JWT secrets
- `backup-production.sh` - Backup manuale

---

**Vedi anche**:
- [../scripts/](../scripts/) - Script automazione deploy
- [../primo-rilascio-manuale/](../primo-rilascio-manuale/) - Setup iniziale server
