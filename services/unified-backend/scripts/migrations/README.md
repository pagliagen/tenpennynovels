# Database Migrations

Scripts per modifiche strutturali al database MongoDB.

## Come eseguire una migration

### Development (Local)

```bash
cd services/unified-backend

# Verifica variabili ambiente
cat .env | grep MONGODB_URI

# Esegui migration
npx ts-node scripts/migrations/001-remove-character-session-unique-constraint.ts
```

### Production

```bash
# 1. SSH nel server
ssh user@server

# 2. Naviga alla directory
cd /path/to/tenpennynovels/services/unified-backend

# 3. Backup del database (IMPORTANTE!)
mongodump --uri="mongodb://..." --out=/backup/$(date +%Y%m%d-%H%M%S)

# 4. Esegui migration
npx ts-node scripts/migrations/001-remove-character-session-unique-constraint.ts

# 5. Verifica risultato
mongo --eval 'db.character_sessions.getIndexes()'
```

---

## Migration History

### 001 - Remove CharacterSession Unique Constraint (2026-03-21)

**Problema:** Index unique `{ characterId: 1, isActive: 1 }` impedisce multi-tab support.

**Soluzione:** Rimuove unique constraint, permette multiple sessioni attive per stesso personaggio.

**Files modificati:**
- `services/unified-backend/src/database/models/CharacterSession.ts` (line 108-114)

**Impatto:**
- ✅ Multi-tab support abilitato
- ✅ Ogni tab ha sessionId univoco (Redis)
- ✅ MongoDB CharacterSession ora è solo audit log

**Rollback:**
```javascript
// Se necessario rollback (NON RACCOMANDATO dopo multi-tab deploy):
db.character_sessions.dropIndex("characterId_1_isActive_1");
db.character_sessions.createIndex(
  { characterId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
```

---

## Best Practices

1. **Backup SEMPRE prima di migration production**
2. **Test migration in development PRIMA di production**
3. **Verifica risultato con query manuale**
4. **Documenta cambio in questo README**
5. **Migration script deve essere IDEMPOTENTE** (safe to run multiple times)

---

## Verifiche Post-Migration

### Verifica Index

```javascript
// Connetti a MongoDB
mongo mongodb://localhost:27017/tenpennynovels

// Lista indexes
db.character_sessions.getIndexes()

// Output atteso:
// {
//   "v": 2,
//   "key": { "characterId": 1, "isActive": 1 },
//   "name": "characterId_1_isActive_1",
//   "unique": false  // ✅ NON unique
// }
```

### Verifica Multi-Session

```javascript
// Conta personaggi con multiple sessioni attive
db.character_sessions.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: '$characterId', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])

// Output atteso dopo multi-tab usage:
// { "_id": "char-id-123", "count": 2 }  ✅ 2 tab aperti
```

### Verifica Redis Sessions

```bash
# Connetti a Redis
redis-cli

# Lista tutte le session keys
KEYS session:*

# Inspect session data
GET session:abc123-uuid-here

# Output atteso:
# {"userId":"user123","characterId":"char456","deviceInfo":{...},"createdAt":...}
```

---

## Troubleshooting

### Error: "Index already exists with different options"

**Causa:** Vecchio index unique ancora presente.

**Soluzione:**
```javascript
db.character_sessions.dropIndex("characterId_1_isActive_1");
// Poi ri-esegui migration script
```

### Error: "Cannot create duplicate session"

**Causa:** Codice backend ancora usa vecchia logica invalidazione.

**Verifica:**
```bash
# Check che characterSessionManager.ts NON invalida sessioni
grep -n "invalidateCharacterSessions" services/unified-backend/src/modules/auth/utils/characterSessionManager.ts

# Output atteso: NESSUN MATCH (o solo commenti)
```

### Redis Session non trovata

**Causa:** Redis vuoto o session scaduta.

**Debug:**
```bash
# Check Redis connectivity
redis-cli PING

# Check TTL di una session
redis-cli TTL session:abc123-uuid

# Output:
# -2 = key non esiste
# -1 = key esiste senza expire
# N > 0 = secondi rimanenti
```
