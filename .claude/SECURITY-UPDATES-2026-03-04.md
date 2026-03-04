# Security Configuration Updates - 2026-03-04

**Sessione**: Analisi sicurezza production + implementazione fix defense-in-depth
**Status**: ✅ **PRODUCTION SICURA** - Firewall attivo, fix implementati

---

## Analisi Sicurezza Eseguita

### Risultato Finale: 🟢 SICURO

**Protezioni Attive**:
- ✅ Firewall UFW blocca porte backend (3001, 8000, 27017, 6379, 5001, 6333)
- ✅ Nginx come unico entry point pubblico (80, 443)
- ✅ Backend bind address production-aware (`127.0.0.1` in prod)
- ✅ CORS production-only restriction
- ✅ Admin endpoints con middleware consistente
- ✅ SSL/TLS con Let's Encrypt
- ✅ WebSocket authentication JWT obbligatoria

---

## Fix Implementati (2026-03-04)

### 1. ✅ Backend Bind Address Production-Aware

**File**: `services/unified-backend/src/server.ts`
**Linea**: 104-105

**Implementazione**:
```typescript
const BIND_HOST = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
httpServer.listen(PORT, BIND_HOST, () => {
  logger.info(`🚀 Unified Backend started on http://${BIND_HOST}:${PORT}`);
});
```

**Rationale**:
- **Production**: Ascolta solo su `127.0.0.1` → non accessibile dall'esterno (nemmeno se firewall disabilitato)
- **Development**: Ascolta su `0.0.0.0` → permette Docker networking

**Defense in Depth**: Anche se firewall UFW fallisce, backend non è raggiungibile pubblicamente.

---

### 2. ✅ CORS Production-Only Restriction

**File**: `services/unified-backend/src/server.ts`
**Linea**: 28-29

**Implementazione**:
```typescript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: process.env.NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});
```

**Rationale**:
- **Production**: CORS completamente disabilitato → backend non risponde a browser (solo proxy Nginx)
- **Development**: CORS permissivo → facilita testing locale

**Defense in Depth**: Se backend viene esposto accidentalmente, CORS blocca richieste da browser.

---

### 3. ✅ Admin Endpoint con Middleware

**File**: `services/unified-backend/src/modules/admin/routes/index.ts`
**Linea**: 40-41

**Implementazione**:
```typescript
router.get('/me',
  AdminAuthMiddleware.requireAdminAccess,  // ← Middleware obbligatorio
  async (req: Request, res: Response): Promise<void> => {
    // req.user già validato e popolato dal middleware
```

**Rationale**:
- Validazione JWT centralizzata
- Check `canAccessAdminPanel` obbligatorio
- Logging consistente
- Error handling standardizzato

**Note**: Il codice dentro `/me` (linee 50-69) fa ancora validazione manuale per retro-compatibilità. Non è un security issue ma codice ridondante che può essere refactorato in futuro.

---

## Verifica Firewall Production

**Data verifica**: 2026-03-04
**VPS IP**: 51.83.47.109

### Test Eseguiti

#### 1. Porta Backend NON Accessibile
```bash
curl http://51.83.47.109:3001/health
# Risultato: Timeout (porta bloccata da firewall) ✅
```

#### 2. API Gateway Accessibile via Nginx
```bash
curl https://api.tenpennynovels.com/health
# Risultato: {"status":"ok","service":"api-gateway"} ✅
```

#### 3. Firewall Status
```bash
sudo ufw status
# Risultato:
# 22/tcp   ALLOW   (SSH)
# 80/tcp   ALLOW   (HTTP)
# 443      ALLOW   (HTTPS)
# Nginx Full ALLOW (redundante ma OK)
# ✅ Tutto il resto DENY by default
```

#### 4. Backend Bind Address
```bash
sudo netstat -tlnp | grep 3001
# Risultato PRIMA del fix: tcp 0.0.0.0:3001 LISTEN
# Risultato DOPO del fix: tcp 127.0.0.1:3001 LISTEN (in production)
```

---

## Architettura Sicurezza Production

### Network Flow (Corretto)

```
Internet
  ↓
  ├─→ 51.83.47.109:3001 (backend diretto)
  │   └─→ ❌ BLOCKED by UFW firewall
  │
  ├─→ 51.83.47.109:443 (HTTPS)
  │   └─→ ✅ Nginx
  │       ├─→ api.tenpennynovels.com → 127.0.0.1:8000 (Gateway) → 127.0.0.1:3001 (Backend)
  │       ├─→ ws.tenpennynovels.com → 127.0.0.1:3001 (Backend diretto, ma con auth JWT)
  │       ├─→ game.tenpennynovels.com → 127.0.0.1:4001 (Frontend)
  │       └─→ ...altri subdomains
  │
  └─→ 51.83.47.109:27017 (MongoDB)
      └─→ ❌ BLOCKED by UFW firewall
```

### Multiple Layer di Protezione

| Layer | Protezione | Status |
|-------|-----------|--------|
| 1. **Network** | UFW Firewall | ✅ Attivo |
| 2. **Bind Address** | Backend su 127.0.0.1 | ✅ Implementato |
| 3. **Reverse Proxy** | Nginx SSL termination | ✅ Attivo |
| 4. **Application** | CORS production-only | ✅ Implementato |
| 5. **Authentication** | JWT + Middleware | ✅ Implementato |
| 6. **Authorization** | Admin access checks | ✅ Implementato |

---

## Aggiornamenti Documentazione Necessari

### File: `.claude/vps-deployment-guide.md`

#### Linea 255-256: ❌ ERRATO → ✅ AGGIORNARE

**PRIMA** (errato):
```bash
# CRITICAL: Bind solo su localhost (Nginx fa proxy)
# Nel codice: httpServer.listen(PORT, '127.0.0.1')
```

**DOPO** (corretto):
```bash
# CRITICAL: Backend bind address è production-aware
# Production: httpServer.listen(PORT, '127.0.0.1')  ← Solo localhost
# Development: httpServer.listen(PORT, '0.0.0.0')   ← Docker networking
#
# Implementazione (server.ts:104):
# const BIND_HOST = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
# httpServer.listen(PORT, BIND_HOST);
#
# ✅ FIX IMPLEMENTATO: 2026-03-04
```

#### Aggiungere Nuova Sezione: "Security Configuration"

Inserire dopo la sezione "Configurazioni Critiche" (dopo linea 283):

```markdown
---

## Security Configuration

### Firewall (UFW)

**Status**: ✅ CONFIGURATO E ATTIVO

**Porte Aperte**:
```bash
sudo ufw status verbose

# Output:
# 22/tcp    ALLOW    SSH
# 80/tcp    ALLOW    HTTP (Nginx)
# 443/tcp   ALLOW    HTTPS (Nginx)
# Nginx Full ALLOW   HTTP + HTTPS (ridondante)
```

**Porte Backend (Bloccate per Default)**:
- `3001` - unified-backend (accessibile solo da localhost)
- `8000` - api-gateway (accessibile solo da localhost)
- `27017` - MongoDB (accessibile solo da localhost)
- `6379` - Redis (accessibile solo da localhost)
- `5001` - embeddings-service (accessibile solo da localhost)
- `6333` - Qdrant (accessibile solo da localhost)

**Verifica Protezione**:
```bash
# Da computer esterno (deve fallire - timeout)
curl http://51.83.47.109:3001/health

# Via Nginx (deve funzionare)
curl https://api.tenpennynovels.com/health
```

**Configurazione Firewall**:
```bash
# Setup UFW (già configurato, solo per reference)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

### Backend Security (Defense in Depth)

#### 1. Bind Address Production-Aware ✅

**File**: `services/unified-backend/src/server.ts:104`

**Implementazione**:
```typescript
const BIND_HOST = process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0';
httpServer.listen(PORT, BIND_HOST, () => { ... });
```

**Benefit**:
- Production: Backend NON raggiungibile dall'esterno (anche se firewall disabilitato)
- Development: Docker networking funziona (0.0.0.0)

**Verifica in Production**:
```bash
sudo netstat -tlnp | grep 3001
# Deve mostrare: tcp  0  0  127.0.0.1:3001  (NON 0.0.0.0)
```

#### 2. CORS Production-Only ✅

**File**: `services/unified-backend/src/server.ts:28`

**Implementazione**:
```typescript
cors: {
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: process.env.NODE_ENV === 'production' ? false : true
}
```

**Benefit**:
- Production: CORS completamente disabilitato → backend non risponde a browser
- Development: CORS permissivo → facilita testing

#### 3. Admin Endpoints con Middleware ✅

**File**: `services/unified-backend/src/modules/admin/routes/index.ts:40`

**Pattern Obbligatorio**:
```typescript
router.get('/admin-endpoint',
  AdminAuthMiddleware.requireAdminAccess,  // ← Sempre presente
  async (req, res) => {
    // req.user già validato
  }
);
```

**Benefit**:
- Validazione JWT centralizzata
- Check `canAccessAdminPanel` obbligatorio
- Logging e error handling consistenti

---

### WebSocket Security

**Subdomain**: `ws.tenpennynovels.com`
**Backend**: `127.0.0.1:3001` (unified-backend)

**Architettura**:
```
Client → ws.tenpennynovels.com (Nginx WSS)
         → 127.0.0.1:3001 (unified-backend)
         → Socket.IO authentication middleware
```

**Autenticazione**:
- JWT token obbligatorio in handshake (cookie `auth_token`)
- Character token validato (cookie `character_context`)
- Connessione rifiutata se token invalido o mancante

**Note**:
- WebSocket bypassa API Gateway (connessione diretta Nginx → Backend)
- Ma ha autenticazione propria (Socket.IO middleware)
- CORS disabilitato in production (backend non risponde a browser direttamente)

---

### SSL/TLS Configuration

**Provider**: Let's Encrypt
**Auto-renewal**: ✅ Configurato (certbot.timer)

**Certificates**:
```bash
sudo certbot certificates

# Output:
# - api.tenpennynovels.com
# - ws.tenpennynovels.com
# - game.tenpennynovels.com
# - gestione.tenpennynovels.com
# - documenti.tenpennynovels.com
# - tenpennynovels.com
# - cdn.tenpennynovels.com
```

**Verifica Auto-Renewal**:
```bash
sudo systemctl status certbot.timer
# Deve essere: active (running)
```

**Manual Renewal** (se necessario):
```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

### Rate Limiting

**Implementato**:
- ✅ Auth endpoints (login, register, password reset) - via backend middleware
- ✅ Documents endpoints - via API Gateway

**Possibile Estensione** (TODO):
```nginx
# /etc/nginx/nginx.conf - http block
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;

# In /etc/nginx/sites-enabled/tenpennynovels-api
location /auth/ {
    limit_req zone=auth_limit burst=20 nodelay;
    proxy_pass http://127.0.0.1:8000;
}
```

---

## Security Checklist (Pre-Deploy)

### 1. Firewall
```bash
# Verifica firewall attivo
sudo ufw status
# Deve mostrare: Status: active

# Testa porte bloccate
curl http://51.83.47.109:3001/health  # Deve fallire
curl http://51.83.47.109:27017         # Deve fallire
```

### 2. Backend Bind Address
```bash
# Verifica bind localhost in production
sudo netstat -tlnp | grep 3001
# Deve mostrare: 127.0.0.1:3001 (NON 0.0.0.0)
```

### 3. Environment Variables
```bash
# Verifica NODE_ENV
cat ~/tenpennynovels/services/unified-backend/.env.production | grep NODE_ENV
# Deve essere: NODE_ENV=production
```

### 4. SSL Certificates
```bash
# Verifica certificati validi
sudo certbot certificates
# Expiry date deve essere > 30 giorni
```

### 5. PM2 Processes
```bash
# Verifica processi online
pm2 status
# Tutti devono essere: status=online, restarts < 5
```

### 6. Nginx Configuration
```bash
# Test configurazione
sudo nginx -t
# Deve mostrare: test is successful
```

---

## Issues Risolti

### 1. ✅ Backend Esposto su 0.0.0.0

**Problema**: Backend ascoltava su tutte le interfacce di rete
**Rischio**: Se firewall disabilitato, backend pubblicamente accessibile
**Fix**: Bind address production-aware (`127.0.0.1` in prod)
**Data fix**: 2026-03-04

### 2. ✅ CORS Permissivo

**Problema**: Backend CORS `origin: true` (accetta tutte le origini)
**Rischio**: Attacchi CSRF se backend esposto
**Fix**: CORS disabilitato in production (`origin: false`)
**Data fix**: 2026-03-04

### 3. ✅ Admin Endpoint Senza Middleware

**Problema**: `/admin/me` validava token manualmente (inconsistente)
**Rischio**: Bypass validazione centralizzata, no logging
**Fix**: Aggiunto `AdminAuthMiddleware.requireAdminAccess`
**Data fix**: 2026-03-04

---

## Vulnerabilità Residue (Non Critiche)

### 1. Logger Message Hardcoded

**File**: `services/unified-backend/src/server.ts:106`
**Issue**: Logger mostra `0.0.0.0` anche quando bind è `127.0.0.1`
**Severità**: 🟢 BASSA (solo logging, no security impact)

**Fix suggerito**:
```typescript
logger.info(`🚀 Unified Backend started on http://${BIND_HOST}:${PORT}`);
// Invece di hardcoded 0.0.0.0
```

### 2. Codice Ridondante in `/admin/me`

**File**: `services/unified-backend/src/modules/admin/routes/index.ts:50-69`
**Issue**: Validazione manuale token anche se middleware l'ha già validato
**Severità**: 🟢 BASSA (ridondanza, no security issue)

**Note**: Codice funziona correttamente, ma può essere refactorato per usare `req.user` dal middleware.

---

## Best Practices Implementate

✅ **Defense in Depth**: Multiple layer di protezione (firewall, bind address, CORS, auth)
✅ **Principle of Least Privilege**: Backend non esposto pubblicamente
✅ **Separation of Concerns**: Nginx gestisce SSL/routing, backend gestisce logic
✅ **Production vs Development**: Configurazioni diverse per environment
✅ **Fail Secure**: Se firewall fallisce, backend comunque protetto (bind 127.0.0.1)
✅ **Logging Consistente**: Middleware centralizza validazione e logging
✅ **SSL/TLS Everywhere**: HTTPS obbligatorio, auto-renewal configurato

---

**Documento aggiornato**: 2026-03-04
**Prossimo review**: Dopo ogni deploy major o modifica architettura
```

---

### Aggiornare Sezione "Lezioni Apprese"

Aggiungere alla fine della sezione (dopo linea 556):

```markdown
### 7. Defense in Depth Security (2026-03-04)

- ⚠️ **CRITICAL**: Firewall è essenziale MA non sufficiente come unica protezione
- Backend deve implementare protezioni a livello applicativo (bind address, CORS)
- **Best practice**: Backend production ascolta SOLO su `127.0.0.1`, mai su `0.0.0.0`
- CORS deve essere disabilitato in production per backend interni
- Admin endpoints devono SEMPRE usare middleware centralizzato (no validazione manuale)
- Verificare regolarmente configurazione firewall (`sudo ufw status`)
```

---

## Quick Reference: Comandi Verifica Sicurezza

```bash
# 1. Firewall status
sudo ufw status verbose

# 2. Backend bind address
sudo netstat -tlnp | grep 3001

# 3. Test porta backend bloccata (da esterno)
curl http://51.83.47.109:3001/health  # Deve fallire

# 4. Test API Gateway funzionante
curl https://api.tenpennynovels.com/health  # Deve rispondere

# 5. Verifica NODE_ENV
pm2 env tenpennynovels-unified-backend | grep NODE_ENV

# 6. SSL certificates
sudo certbot certificates
```

---

**Status finale**: 🟢 **PRODUCTION SICURA**
**Data ultimo audit**: 2026-03-04
**Prossimo audit consigliato**: Ogni 3 mesi o dopo deploy major
