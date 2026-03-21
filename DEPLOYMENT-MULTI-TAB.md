# Deployment: Multi-Tab Character Selection Support

**Feature:** Supporto multi-tab - stesso utente, personaggi diversi in tab diversi.

**Target Environment:** Beta (non production)

**Breaking Changes:** ⚠️ SI - Index MongoDB + Cookie authentication deprecato

---

## 🎯 Opzione 1: Migration (Preserva Dati Esistenti)

Usa questa opzione se vuoi **mantenere** le sessioni/personaggi esistenti.

### Step 1: Backup Database (IMPORTANTE!)

```bash
# Local backup
mongodump --uri="mongodb://localhost:27017/tenpennynovels" --out=./backup/$(date +%Y%m%d-%H%M%S)

# Remote backup (se MongoDB remoto)
mongodump --uri="mongodb://user:pass@host:port/tenpennynovels" --out=./backup/$(date +%Y%m%d-%H%M%S)
```

### Step 2: Deploy Backend

```bash
cd services/unified-backend

# 1. Pull latest code
git pull origin feature/multi-tab-support

# 2. Install dependencies (se nuove)
npm install

# 3. Build
npm run build

# 4. Run migration (rimuove unique constraint)
npx ts-node scripts/migrations/001-remove-character-session-unique-constraint.ts

# 5. Restart backend
pm2 restart unified-backend
# oppure
npm run dev
```

**Verifica migration:**
```bash
# Connetti a MongoDB
mongo mongodb://localhost:27017/tenpennynovels

# Verifica index NON unique
db.character_sessions.getIndexes()

# Output atteso:
# {
#   "key": { "characterId": 1, "isActive": 1 },
#   "name": "characterId_1_isActive_1",
#   "unique": false  // ✅ Deve essere false
# }
```

### Step 3: Verifica Redis

```bash
# Verifica connettività Redis
redis-cli PING
# Output atteso: PONG

# Verifica che Redis sia vuoto (nessuna session vecchia)
redis-cli KEYS session:*
# Output atteso: (empty array) o vecchie keys (da flushare)

# OPZIONALE: Flush vecchie session Redis
redis-cli FLUSHDB
```

### Step 4: Deploy Frontend

```bash
# Landing App
cd apps/landing
npm install
npm run build
pm2 restart landing
# oppure
npm run dev

# Game App
cd ../game
npm install
npm run build
pm2 restart game
# oppure
npm run dev
```

### Step 5: Test Multi-Tab

1. **Login utente con 2+ personaggi**
2. **Tab A**: Seleziona Personaggio 1 → verifica sessionStorage contiene `character_session_id`
   ```javascript
   // DevTools Console
   sessionStorage.getItem('character_session_id')
   // Output: "abc123-uuid-456"
   ```
3. **Tab B**: Seleziona Personaggio 2 → verifica sessionId DIVERSO
4. **Tab A**: API call → verifica header `X-Session-Id` inviato
   ```javascript
   // DevTools Network tab → Headers
   // X-Session-Id: abc123-uuid-456
   ```
5. **Tab B**: API call → verifica sessionId diverso
6. **Chiudi Tab A** → verifica sendBeacon inviato (`/game/presence/leave`)
7. **Tab B**: Ancora attivo con Personaggio 2 ✅

### Step 6: Monitor Logs

```bash
# Backend logs
pm2 logs unified-backend --lines 100

# Cerca:
# ✅ "Session created" (quando selezioni personaggio)
# ✅ "Session authenticated" (quando API call)
# ✅ "Session deleted" (quando chiudi tab)
# ⚠️ "DEPRECATED: character_context cookie used" (se vecchi client)
```

---

## 🚀 Opzione 2: Reset DB (Più Semplice per Beta)

Usa questa opzione se puoi **resettare** il database (nessun dato critico da preservare).

### Step 1: Reset Database

```bash
# ATTENZIONE: Questo cancella TUTTI i dati!

# Local
mongo mongodb://localhost:27017/tenpennynovels --eval "db.dropDatabase()"

# Remote (se necessario)
mongo mongodb://user:pass@host:port/tenpennynovels --eval "db.dropDatabase()"
```

### Step 2: Deploy Backend + Restart

```bash
cd services/unified-backend

# 1. Pull code
git pull origin feature/multi-tab-support

# 2. Install deps
npm install

# 3. Build
npm run build

# 4. Restart (MongoDB indexes auto-created dal model)
pm2 restart unified-backend

# 5. Verifica logs
pm2 logs unified-backend --lines 50
# Cerca: "MongoDB connected" ✅
```

**MongoDB auto-crea indexes corretti** dal model `CharacterSession.ts` (linea 103-114):
- ✅ `{ characterId: 1, isActive: 1 }` NON unique
- ✅ `{ sessionId: 1 }` unique
- ✅ `{ userId: 1, isActive: 1 }`

### Step 3: Flush Redis

```bash
redis-cli FLUSHDB
# Output: OK
```

### Step 4: Deploy Frontend

```bash
# Landing
cd apps/landing
npm install && npm run build && pm2 restart landing

# Game
cd apps/game
npm install && npm run build && pm2 restart game
```

### Step 5: Ricrea Dati Test

```bash
# 1. Crea utente test
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test123"}'

# 2. Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}' \
  -c cookies.txt

# 3. Crea personaggi (wizard completo richiesto)
# Oppure usa UI per creare personaggi
```

### Step 6: Test Multi-Tab (come Opzione 1)

---

## 📊 Verifica Deployment

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health
# Output: {"status":"ok","timestamp":"..."}

# Redis connectivity
redis-cli PING
# Output: PONG

# MongoDB connectivity
mongo mongodb://localhost:27017/tenpennynovels --eval "db.stats()"
# Output: { "db": "tenpennynovels", ... }
```

### API Tests

```bash
# 1. Login + Get session
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}' \
  -c cookies.txt

# 2. Select character
curl -X POST http://localhost:8000/game/characters/CHAR_ID/select \
  -b cookies.txt \
  -H "Content-Type: application/json"

# Output atteso:
# {
#   "result": true,
#   "data": {
#     "character": {...},
#     "gameAccess": {...},
#     "sessionId": "abc123-uuid-456"  ✅ NEW FIELD
#   }
# }

# 3. Verifica Redis session creata
redis-cli GET session:abc123-uuid-456
# Output: {"userId":"...","characterId":"...","deviceInfo":{...}}
```

---

## 🔄 Rollback Plan

### Se qualcosa va storto

**Opzione A: Rollback Code**

```bash
# Backend
cd services/unified-backend
git checkout main  # o branch pre-multi-tab
npm install
npm run build
pm2 restart unified-backend

# Frontend
cd apps/landing
git checkout main
npm install && npm run build && pm2 restart landing

cd apps/game
git checkout main
npm install && npm run build && pm2 restart game
```

**Opzione B: Restore Database Backup**

```bash
# Solo se hai fatto backup (Opzione 1)
mongorestore --uri="mongodb://localhost:27017/tenpennynovels" --drop ./backup/TIMESTAMP/
```

**Opzione C: Recreate Unique Index**

```bash
mongo mongodb://localhost:27017/tenpennynovels

# Rimuovi index non-unique
db.character_sessions.dropIndex("characterId_1_isActive_1")

# Ricrea index unique (OLD BEHAVIOR)
db.character_sessions.createIndex(
  { characterId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
)
```

---

## 🐛 Troubleshooting

### "Session ID required" Error

**Causa:** Frontend non salva sessionId in sessionStorage.

**Fix:**
```javascript
// DevTools Console
sessionStorage.getItem('character_session_id')
// Se null:

// 1. Logout
// 2. Clear sessionStorage
sessionStorage.clear()

// 3. Re-login + select character
// 4. Verifica sessionId salvato
```

### "Session ownership mismatch" Error

**Causa:** Cookie auth_token non match con session.userId.

**Fix:**
```bash
# Logout + Clear cookies + Re-login
# Oppure flush Redis
redis-cli FLUSHDB
```

### WebSocket "Session not found" Error

**Causa:** sessionId non inviato in auth payload.

**Verifica:**
```javascript
// DevTools Console (page con WebSocket attivo)
// Verifica sessionStorage
sessionStorage.getItem('character_session_id')

// Se null: character non selezionato → select character prima
```

### Duplicate Key Error (E11000)

**Causa:** Vecchio index unique ancora presente.

**Fix:**
```bash
# Riesegui migration script
cd services/unified-backend
npx ts-node scripts/migrations/001-remove-character-session-unique-constraint.ts
```

---

## 📝 Post-Deployment Checklist

- [ ] Backend deployed e restarted
- [ ] Frontend (landing + game) deployed e restarted
- [ ] Migration eseguita (Opzione 1) O DB reset (Opzione 2)
- [ ] Redis flushed
- [ ] Index verificati (`characterId_1_isActive_1` NON unique)
- [ ] Test multi-tab completato
- [ ] Logs monitorati (nessun errore critico)
- [ ] Cookie fallback funziona (backward compatibility 2 settimane)
- [ ] WebSocket authentication funziona
- [ ] Tab close cleanup funziona (sendBeacon)

---

## 🎯 Metriche di Successo

**Dopo 24h deployment:**

1. **Redis Sessions:**
   ```bash
   redis-cli KEYS session:* | wc -l
   # Numero di sessioni attive (>0 se utenti attivi)
   ```

2. **Multi-Tab Usage:**
   ```javascript
   // MongoDB
   db.character_sessions.aggregate([
     { $match: { isActive: true } },
     { $group: { _id: '$characterId', count: { $sum: 1 } } },
     { $match: { count: { $gt: 1 } } }
   ]).count()
   // Numero di personaggi con 2+ tab aperti
   ```

3. **Deprecated Cookie Usage:**
   ```bash
   pm2 logs unified-backend | grep "DEPRECATED: character_context cookie"
   # Se 0 → tutti i client aggiornati ✅
   # Se >0 → alcuni client usano ancora vecchio flow
   ```

**Target:**
- ✅ Zero "Session ownership mismatch" errors
- ✅ Zero "Duplicate key" errors
- ✅ Multi-tab scenarios funzionanti
- ✅ Tab close cleanup >95% success rate

---

## 📅 Deprecation Timeline

**Week 1-2:** Backward compatibility attiva (cookie fallback)
**Week 3:** Monitor deprecated cookie usage (dovrebbe essere 0%)
**Week 4:** Remove cookie fallback code (cleanup)

**Files da modificare in Week 4:**
- `services/unified-backend/src/modules/auth/middleware/auth.ts` (rimuovi FALLBACK FLOW)
- `services/unified-backend/src/modules/game/websocket/index.ts` (rimuovi FALLBACK FLOW)
- `services/unified-backend/src/modules/auth/utils/characterSessionManager.ts` (depreca `activateCharacterContext`)

---

## 🆘 Supporto

**Se problemi durante deployment:**

1. **Check logs:** `pm2 logs unified-backend --lines 200`
2. **Check Redis:** `redis-cli MONITOR` (live monitoring)
3. **Check MongoDB:** `mongo --eval 'db.character_sessions.find().limit(5).pretty()'`
4. **Rollback:** Segui Rollback Plan sopra
5. **Report issue:** GitHub Issues con logs + steps to reproduce
