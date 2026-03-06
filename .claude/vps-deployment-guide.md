# TenPennyNovels - VPS Deployment Troubleshooting Guide

**Data creazione**: 2026-02-28
**Sessione di debug**: Deployment produzione su VPS Ubuntu (51.83.47.109)

---

## Architettura Produzione

### Subdomains e Porte

| Subdomain | Servizio | Porta Interna | PM2 Process | Note |
|-----------|----------|---------------|-------------|------|
| `tenpennynovels.com` | Landing App | 4000 | `tenpennynovels-landing` | Next.js SSR |
| `game.tenpennynovels.com` | Game App | 4001 | `tenpennynovels-game` | Next.js SSR |
| `documenti.tenpennynovels.com` | Documents App | 4003 | `tenpennynovels-documenti` | Next.js SSR |
| `gestione.tenpennynovels.com` | Management App | 4004 | `tenpennynovels-gestione` | Next.js SSR |
| `api.tenpennynovels.com` | API Gateway | 8000 | `tenpennynovels-api-gateway` | Express (cluster x2) |
| `ws.tenpennynovels.com` | WebSocket Server | 3001 | `tenpennynovels-unified-backend` | Socket.IO (fork x1) |

### Backend Services (Internal)

| Servizio | Porta | PM2 Process | Instances | Note |
|----------|-------|-------------|-----------|------|
| **api-gateway** | 8000 | `tenpennynovels-api-gateway` | 2 (cluster) | Entry point HTTP |
| **unified-backend** | 3001 | `tenpennynovels-unified-backend` | 1 (fork) | Main backend + WebSocket |
| **embeddings-service** | 5001 | `tenpennynovels-embeddings-service` | 1 (fork) | Python Flask ML |
| **embeddings-worker** | - | `tenpennynovels-embeddings-worker` | 1 (fork) | Bull queue worker |

### Database Produzione

**MongoDB URI**: `mongodb://127.0.0.1:27017/tenpennynovels` (NON `tenpennynovels-prod`)
⚠️ **CRITICAL**: Seeder usa `tenpennynovels-prod` di default → specificare `MONGODB_URI` e `DB_NAME` quando si eseguono i seeder!

---

## Problemi Riscontrati e Soluzioni

### 1. Frontend Redirect a Localhost dopo Login

**Problema**:
- Dopo login su `tenpennynovels.com`, redirect a `localhost:3010`
- Mancava variabile env `NEXT_PUBLIC_GAME_URL`

**Soluzione**:
- Aggiunto a `deploy/env-templates/landing.env`:
  ```bash
  NEXT_PUBLIC_GAME_URL=https://game.tenpennynovels.com
  ```

**Lezione**:
- ⚠️ Next.js compila `NEXT_PUBLIC_*` durante build → modificare `.env.production` NON basta, serve **rebuild**

---

### 2. WebSocket Non Si Connette

**Problema iniziale**: WebSocket sempre disconnesso
**Causa root**: Content Security Policy (CSP) bloccava connessioni a `ws.tenpennynovels.com`

**Errore browser console**:
```
Connecting to 'https://ws.tenpennynovels.com/socket.io/?EIO=4&transport=polling&t=...'
violates the following Content Security Policy directive:
"connect-src 'self' ws: wss: http://localhost:8000 https://api.tenpennynovels.com"
```

**Soluzione**:
- File: `apps/game/next.config.js` (line 85)
- **BEFORE**:
  ```javascript
  "connect-src 'self' ws: wss: http://localhost:8000 https://api.tenpennynovels.com",
  ```
- **AFTER**:
  ```javascript
  "connect-src 'self' ws: wss: http://localhost:8000 https://api.tenpennynovels.com https://ws.tenpennynovels.com",
  ```

**Path completo fix**:
1. Modificare `apps/game/next.config.js`
2. Rebuild app: `cd ~/tenpennynovels/apps/game && npm run build`
3. Restart PM2: `pm2 restart tenpennynovels-game`

---

### 3. URL WebSocket: `https://` vs `wss://`

**Confusione iniziale**: Che protocollo usa Socket.IO client?

**RISPOSTA**:
- ✅ Socket.IO client usa `https://` (NON `wss://`)
- Socket.IO upgradia automaticamente a WebSocket Secure quando usa HTTPS
- ❌ `wss://` è per WebSocket nativo, NON per Socket.IO

**Env var corretta**:
```bash
NEXT_PUBLIC_WS_URL=https://ws.tenpennynovels.com  # ✅ CORRETTO
```

**NON usare**:
```bash
NEXT_PUBLIC_WS_URL=wss://ws.tenpennynovels.com   # ❌ SBAGLIATO per Socket.IO
```

---

### 4. Character Non Selezionato al Login

**Problema**:
- Login OK (auth_token presente)
- Ma API ritornano: `"error": "Character selection required"`
- WebSocket non si connette perché `WebSocketContext` richiede `selectedCharacter`

**Causa root**: `multipleCharactersAllowed: true` nel DB

**Logica backend** (`AuthController.ts`):
```typescript
// Lines 207-234: Auto-crea character se non esiste
if (characters.length === 0) {
  // Crea character con nome = username (o username2, username3, etc.)
}

// Lines 293-330: Auto-seleziona character SE:
if (!user.multipleCharactersAllowed && characters.length > 0) {
  // Setta character context cookie
  // WebSocket può connettersi
}
```

**Soluzione**:
1. File: `scripts/seeders/seeders/UserSeeder.ts`
2. Cambiato `multipleCharactersAllowed: true` → `multipleCharactersAllowed: false` (line 77, 116)
3. Re-seed utenti: `npm run seed:users -- --force`
4. ⚠️ Ma il seeder seedava DB sbagliato! Vedi problema 5

---

### 5. Seeder e Backend Usano Database Diversi

**Problema**:
- Seeder creava utenti con `multipleCharactersAllowed: false`
- Ma nel DB il valore era ancora `true`

**Causa**:
- **Seeder default**: `mongodb://127.0.0.1:27017/tenpennynovels-prod`
- **Backend default**: `mongodb://localhost:27017/tenpennynovels`

**Database nomi**:
- ❌ `tenpennynovels-prod` → usato solo da seeder (se no env vars)
- ✅ `tenpennynovels` → usato da backend produzione

**Soluzione**:
```bash
# Quando esegui seeder, specifica il DB corretto:
MONGODB_URI=mongodb://127.0.0.1:27017/tenpennynovels \
DB_NAME=tenpennynovels \
npm run seed:users -- --force
```

**Fix manuale DB**:
```javascript
// check-character.js
db = db.getSiblingDB('tenpennynovels'); // NON tenpennynovels-prod

const admin = db.users.findOne({ username: 'admin' });
print(`multipleCharactersAllowed: ${admin.multipleCharactersAllowed}`);

// Fix se necessario:
db.users.updateOne(
  { username: 'admin' },
  { $set: { multipleCharactersAllowed: false } }
);
```

---

### 6. Nginx WebSocket Timeouts

**Configurazione iniziale**: `proxy_read_timeout 7d` (7 giorni)

**Problema**:
- Timeout troppo lungo → rischio connessioni zombie
- Socket.IO ha ping/pong interno (ogni 25 secondi)

**Configurazione ottimale**:
```nginx
# File: /etc/nginx/sites-enabled/tenpennynovels-websocket

location /socket.io/ {
    proxy_pass http://127.0.0.1:3001/socket.io/;
    proxy_http_version 1.1;

    # WebSocket headers
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Timeouts ottimizzati (2 ore read, 60s send/connect)
    proxy_connect_timeout 60s;       # Connessione iniziale
    proxy_send_timeout 60s;          # Invio dati
    proxy_read_timeout 7200s;        # 2 ore (sessioni di gioco lunghe)

    # Disable buffering
    proxy_buffering off;
}
```

**Rationale**:
- `proxy_connect_timeout`: Solo per handshake iniziale
- `proxy_send_timeout`: Messaggi piccoli → 60s abbondante
- `proxy_read_timeout`: Connessione persistente → 2 ore = sessione ragionevole
- Socket.IO keepalive (25s) previene timeout falsi

---

### 7. PM2 Cluster Mode Crash (unified-backend)

**Problema**:
- `unified-backend` in cluster mode (2 instances) crashava immediatamente
- Uptime: 0, memory: 0b, 6+ restarts

**Causa** (probabile):
- Redis adapter configurato MA qualcosa non funziona in cluster
- Fork mode funziona perfettamente

**Soluzione temporanea**:
```javascript
// ecosystem.config.js
{
  name: 'tenpennynovels-unified-backend',
  instances: 1,        // Solo 1 istanza
  exec_mode: 'fork',   // NON cluster
}
```

**TODO futuro**: Investigare perché cluster mode fallisce (Redis adapter issue?)

---

## Configurazioni Critiche

### Environment Variables (Production)

**Frontend Apps** (Landing, Game, Documents, Management):
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.tenpennynovels.com
NEXT_PUBLIC_WS_URL=https://ws.tenpennynovels.com  # Socket.IO usa https://, non wss://
```

**unified-backend** (`.env.production`):
```bash
NODE_ENV=production
PORT=3001

# CRITICAL: Bind solo su localhost (Nginx fa proxy)
# Nel codice: httpServer.listen(PORT, '127.0.0.1')

# MongoDB (production DB - NON tenpennynovels-prod!)
MONGODB_URI=mongodb://127.0.0.1:27017/tenpennynovels

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Qdrant
QDRANT_URL=http://127.0.0.1:6333

# JWT Secrets
JWT_SECRET=<64_char_random_hex>
JWT_REFRESH_SECRET=<64_char_random_hex>

# Frontend CORS
FRONTEND_URL=https://game.tenpennynovels.com
ALLOWED_ORIGINS=https://tenpennynovels.com,https://game.tenpennynovels.com,https://documenti.tenpennynovels.com,https://gestione.tenpennynovels.com

# Embeddings
EMBEDDINGS_SERVICE_URL=http://127.0.0.1:5001

# BotAI (ngrok locale)
BOTAI_WEBHOOK_URL=https://onomatopoeically-unforgeable-ozie.ngrok-free.dev
BOTAI_BACKEND_URL=https://onomatopoeically-unforgeable-ozie.ngrok-free.dev
BOTAI_BACKEND_API_KEY=<api_key>
```

---

## Comandi Utili

### Build e Deploy

```bash
# Pull modifiche
cd ~/tenpennynovels
git pull

# Build singola app frontend
cd apps/game
npm run build
cd ../..

# Restart PM2 app specifica
pm2 restart tenpennynovels-game

# Restart tutti i servizi
pm2 restart all

# Verifica status
pm2 status
pm2 logs tenpennynovels-game --lines 50
```

### Verifica WebSocket

```bash
# Nginx config test
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Verifica porta 3001
sudo netstat -tlnp | grep 3001
sudo lsof -i :3001

# Test WebSocket da browser console
const socket = io('https://ws.tenpennynovels.com');
socket.on('connect', () => console.log('✅ Connected!'));
socket.on('connect_error', (err) => console.error('❌ Error:', err));
```

### Database Debugging

```bash
cd ~/tenpennynovels/scripts/seeders

# Verifica quale DB sta usando backend
grep MONGODB_URI ~/tenpennynovels/services/unified-backend/.env.production

# Check utente e character
cat > check-user.js << 'EOF'
db = db.getSiblingDB('tenpennynovels');

const admin = db.users.findOne({ username: 'admin' });
print(`User ID: ${admin._id}`);
print(`multipleCharactersAllowed: ${admin.multipleCharactersAllowed}`);
print(`canAccessAdminPanel: ${admin.canAccessAdminPanel}`);

const chars = db.characters.find({ userId: admin._id }).toArray();
print(`\nCharacters: ${chars.length}`);
chars.forEach(c => print(`  - ${c.name} (${c.status})`));
EOF

mongosh mongodb://127.0.0.1:27017 check-user.js

# Fix multipleCharactersAllowed
cat > fix-users.js << 'EOF'
db = db.getSiblingDB('tenpennynovels');

const result = db.users.updateMany(
  {},
  { $set: { multipleCharactersAllowed: false } }
);

print(`✅ Updated ${result.modifiedCount} users`);
EOF

mongosh mongodb://127.0.0.1:27017 fix-users.js
```

### Seeder con DB Corretto

```bash
cd ~/tenpennynovels/scripts/seeders

# Specifica DB corretto (NON -prod)
MONGODB_URI=mongodb://127.0.0.1:27017/tenpennynovels \
DB_NAME=tenpennynovels \
npm run seed:users -- --force
```

---

## Checklist Pre-Produzione

### 1. SSL Certificates
```bash
# Verifica certificati Let's Encrypt
sudo certbot certificates

# Rinnova se scaduti
sudo certbot renew

# Verifica auto-renewal
sudo systemctl status certbot.timer
```

### 2. Nginx Configuration
```bash
# Test configurazione
sudo nginx -t

# Verifica sites-enabled
ls -la /etc/nginx/sites-enabled/

# File necessari:
# - tenpennynovels-landing
# - tenpennynovels-game
# - tenpennynovels-documenti
# - tenpennynovels-gestione
# - tenpennynovels-api
# - tenpennynovels-websocket
```

### 3. Environment Variables
```bash
# Verifica file .env.production
cat ~/tenpennynovels/services/unified-backend/.env.production | grep -E "MONGODB_URI|PORT|JWT_SECRET"
cat ~/tenpennynovels/apps/game/.env.production

# CRITICAL: JWT_SECRET e JWT_REFRESH_SECRET devono essere random 64 char
```

### 4. Database
```bash
# Verifica MongoDB running
sudo systemctl status mongod

# Verifica Redis running
sudo systemctl status redis
redis-cli PING  # Should return PONG

# Verifica Qdrant running
curl http://127.0.0.1:6333/collections
```

### 5. PM2 Status
```bash
pm2 status

# Tutti i processi devono essere:
# - status: online
# - restart: < 5
# - uptime: > 1m
```

---

## Known Issues

### 1. Character Creation DRAFT Status

**Problema attuale** (2026-02-28):
- Auto-creazione character funziona
- Ma character creato in stato `DRAFT`
- Redirect va a scheda character invece del wizard

**TODO**: Verificare logica redirect post-login quando character è `DRAFT`

### 2. Embeddings Service Restarts

**Osservazione**: `tenpennynovels-embeddings-service` aveva 20 restarts in PM2

**TODO**: Verificare logs e stabilità del servizio Python Flask

### 3. Cluster Mode Unified Backend

**Issue**: unified-backend crasha in cluster mode nonostante Redis adapter configurato

**Workaround**: Fork mode con 1 istanza (funziona perfettamente)

**TODO**: Investigare causa root del crash in cluster

---

## File Path Reference

### Nginx Configs
```
/etc/nginx/sites-enabled/tenpennynovels-landing
/etc/nginx/sites-enabled/tenpennynovels-game
/etc/nginx/sites-enabled/tenpennynovels-documenti
/etc/nginx/sites-enabled/tenpennynovels-gestione
/etc/nginx/sites-enabled/tenpennynovels-api
/etc/nginx/sites-enabled/tenpennynovels-websocket
```

### Environment Templates (Local)
```
deploy/env-templates/landing.env
deploy/env-templates/game.env
deploy/env-templates/documents.env
deploy/env-templates/management.env
deploy/env-templates/api-gateway.env
deploy/env-templates/unified-backend.env
deploy/env-templates/embeddings-service.env
deploy/env-templates/embeddings-worker.env
```

### Environment Production (VPS)
```
~/tenpennynovels/apps/landing/.env.production
~/tenpennynovels/apps/game/.env.production
~/tenpennynovels/apps/documents/.env.production
~/tenpennynovels/apps/management/.env.production
~/tenpennynovels/services/api-gateway/.env.production
~/tenpennynovels/services/unified-backend/.env.production
~/tenpennynovels/services/embeddings-service/.env
~/tenpennynovels/services/embeddings-worker/.env.production
```

### PM2 Ecosystem
```
~/tenpennynovels/ecosystem.config.js
```

### Logs
```
~/tenpennynovels/logs/              # PM2 logs (se configurato)
/var/log/nginx/api-tenpennynovels-access.log
/var/log/nginx/api-tenpennynovels-error.log
/var/log/nginx/ws-tenpennynovels-access.log
/var/log/nginx/ws-tenpennynovels-error.log
```

---

## Lezioni Apprese

### 1. Next.js Environment Variables
⚠️ **CRITICAL**: `NEXT_PUBLIC_*` variables sono **compilate durante build**
- Modificare solo `.env.production` → NON funziona
- Serve **rebuild** dopo ogni modifica env vars
- Comando: `npm run build` nella directory app

### 2. Socket.IO URL Protocol
- ✅ Usa `https://` per server HTTPS (auto-upgrade a WSS)
- ❌ NON usare `wss://` (è per WebSocket nativo)

### 3. Content Security Policy
- CSP `connect-src` deve includere TUTTI i domini di connessione
- Include WebSocket domain: `https://ws.tenpennynovels.com`
- Rebuild necessario dopo modifica `next.config.js`

### 4. Database Naming Convention
- Production DB: `tenpennynovels` (NON `-prod`)
- Seeder di default usa `tenpennynovels-prod` → specificare env vars!

### 5. Character Auto-Selection
- Backend auto-crea character se non esiste
- Auto-seleziona SE `multipleCharactersAllowed: false`
- WebSocket richiede character selezionato per connettersi

### 6. PM2 Cluster Mode
- Verificare sempre compatibilità servizi con cluster mode
- Redis adapter NON garantisce cluster mode funzionante
- Fork mode è fallback sicuro

---

## Prossimi Passi

### Immediate (Session Corrente)
1. [ ] Fix redirect DRAFT character → wizard invece di scheda
2. [ ] Verifica WebSocket connessione OK dopo CSP fix
3. [ ] Test completo flow: login → character auto-created → WebSocket connected

### Post-Deployment
1. [ ] Investigare embeddings-service restarts
2. [ ] Investigare cluster mode unified-backend crash
3. [ ] Setup monitoring (PM2 Plus / Datadog / custom)
4. [ ] Backup automatico MongoDB
5. [ ] Rate limiting configurazione (Nginx)

### Documentation
1. [ ] README deployment completo
2. [ ] Runbook incident response
3. [ ] Backup/restore procedures

---

**Note**: Questo documento è basato sulla sessione di debug del 2026-02-28. Aggiornare quando nuove issues vengono risolte o configurazioni cambiano.
