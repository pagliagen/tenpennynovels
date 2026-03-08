# BotAI Backend Context

## Scopo
Gestisce personaggi bot NPC (Non-Player Characters) con intelligenza artificiale per il gioco di ruolo ambientato nella Londra vittoriana. I bot possono rispondere automaticamente alle azioni dei giocatori, mantenere memoria delle conversazioni, sviluppare relazioni e avere personalità, obiettivi ed emozioni dinamiche.

## Architettura

### Deployment
```
game-backend (OVH) ←─ HTTP ─→ botai-backend (Standalone/Local)
                                      ↓
                                Claude SDK API
                                      ↓
                                MongoDB (dedicato)
```

### Caratteristiche Principali
- **Separazione completa**: Database MongoDB dedicato e isolato
- **Dual-instance setup**: Supporta istanze development e production simultanee
- **Comunicazione HTTP**: API REST per integrazione con game-backend
- **Fallback graceful**: Il gioco continua normalmente se botai non è raggiungibile
- **Claude AI Integration**: Usa Claude SDK per generare risposte intelligenti

### Struttura del Codice
```
src/
├── agents/           # Claude Agent per bot decisions
├── config/           # Configurazione database e Claude SDK
├── controllers/      # BotController, SyncController, HealthController
├── middleware/       # Auth, error handling, environment detection
├── models/           # MongoDB models (Bot, BotMemory, BotRelationship, etc.)
├── routes/           # Definizione endpoint REST
├── services/         # Business logic (BotGenerator, BotDecision, GameBackendClient)
└── utils/            # Logger, API response helpers
```

## Pattern Comuni

### API Response Format
Tutti i controller usano formato API standardizzato:
```typescript
{
  result: boolean,
  data?: T,
  error?: string,
  timestamp: string
}
```

### Autenticazione
- Usa `verifyAdminApiKey` middleware per proteggere endpoint admin
- Richiede header `X-Admin-API-Key` con valore da `BOT_ADMIN_API_KEY`
- Endpoint pubblici: `/health`

### Logging
- Usa `logger` da `utils/logger.ts` per logging strutturato
- Log separati per development e production
- Supporta diversi log levels (debug, info, warn, error)

### Error Handling
- Middleware centralizzato in `middleware/errorHandler.ts`
- Sempre try/catch nei controller
- Usa `errorResponse` helper per risposte standardizzate

## Modelli Database

### Bot
Schema principale per i bot characters:
- `characterId`: ID del personaggio nel game-backend
- `systemPrompt`: Prompt di sistema per Claude
- `personality`: Tratti di personalità
- `goals`: Obiettivi del bot
- `emotionalState`: Stato emotivo corrente
- `status`: active/inactive

### BotMemory
Memoria delle conversazioni e interazioni:
- `botId`: Riferimento al bot
- `characterId`: Personaggio coinvolto
- `eventType`: Tipo di evento (message, action, etc.)
- `content`: Contenuto della memoria
- `importance`: Livello di importanza (0-10)

### BotRelationship
Relazioni tra bot e altri personaggi:
- `botId`: Bot principale
- `characterId`: Altro personaggio
- `relationshipType`: friend, enemy, neutral, romantic, etc.
- `trust`: Livello di fiducia (0-100)
- `affinity`: Affinità (0-100)

### CharacterSnapshot
Snapshot periodici dei dati character dal game-backend:
- `characterId`: ID del personaggio
- `name`, `occupation`, `location`: Dati base
- `stats`, `traits`, `inventory`: Stato dettagliato
- `timestamp`: Data dello snapshot

### LocationActionCache
Cache delle azioni disponibili per location:
- `locationId`: ID della location
- `actions`: Lista azioni disponibili
- `lastUpdate`: Ultimo aggiornamento

## Servizi Principali

### ClaudeAgentService
- Integrazione con Claude SDK (Anthropic)
- Genera risposte intelligenti basate su context
- Gestisce conversazioni con memoria
- Supporta diversi modelli (Haiku per decisioni, Sonnet per traduzioni)

### BotGeneratorService
- Genera nuovi bot da template o prompt
- Crea system prompt personalizzati
- Inizializza personalità e obiettivi

### BotDecisionService
- Decide quando e come un bot deve reagire
- Analizza eventi di gioco e determina rilevanza
- Genera azioni appropriate basate su context

### GameBackendClient
- Client HTTP per comunicare con game-backend
- Fetch dati personaggi, location, azioni
- Invia risposte bot al gioco
- Autenticazione con `GAME_BACKEND_BOT_API_KEY`

### ActionHistoryService
- Traccia storia delle azioni bot
- Previene ripetizioni eccessive
- Analizza pattern di comportamento

### BotSelectionService
- Seleziona quali bot devono reagire a eventi
- Filtra per location, visibilità, cooldown
- Prioritizza bot più rilevanti

## Endpoint Principali

### Bot Management
- `POST /bots` - Crea nuovo bot (admin)
- `GET /bots` - Lista tutti i bot (admin)
- `GET /bots/:id` - Dettagli bot specifico (admin)
- `PATCH /bots/:id` - Aggiorna bot (admin)
- `DELETE /bots/:id` - Elimina bot (admin)

### Bot Operations
- `POST /bots/:id/activate` - Attiva bot (admin)
- `POST /bots/:id/deactivate` - Disattiva bot (admin)
- `POST /bots/:id/react` - Trigger reazione manuale (admin)

### Sync & Health
- `POST /sync/character/:characterId` - Sincronizza dati character
- `POST /sync/location/:locationId` - Sincronizza dati location
- `GET /health` - Health check (pubblico)

### Webhook (Futuro)
- Endpoint per ricevere notifiche dal game-backend
- Processare eventi in real-time

## Variabili d'Ambiente

### Configurazione Separata per Ambiente
Il servizio usa due file `.env` separati:
- `.env.development`: Development locale (porta 8082, MongoDB botai-dev)
- `.env.production`: Production (porta 8080, MongoDB botai-prod)

### Variabili Chiave
```env
# Server
NODE_ENV=development|production
PORT=8080

# MongoDB
MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=your-password
MONGODB_ROOT_DATABASE=botai-dev|botai-prod

# Game Backend Integration
GAME_BACKEND_URL=http://localhost:3001|https://api.tenpennynovels.com
GAME_BACKEND_BOT_API_KEY=your-bot-api-key

# Admin Backend Integration (uso futuro)
ADMIN_BACKEND_URL=http://localhost:3002|https://api.tenpennynovels.com
ADMIN_BACKEND_BOT_API_KEY=your-admin-api-key

# Claude API
ANTHROPIC_API_KEY=your-anthropic-api-key
CLAUDE_MODEL=claude-haiku-4-5-20251001
TRANSLATION_MODEL=claude-sonnet-4-5-20250929
```

### Nota su API Keys
`ADMIN_BACKEND_BOT_API_KEY` serve a due scopi:
1. **Protegge endpoint admin** del botai-backend (mappata come `BOT_ADMIN_API_KEY` nel codice)
2. **Autenticherà chiamate** verso management-backend (uso futuro)

## Docker Compose

### Dual Instance Setup
Supporta esecuzione simultanea di due istanze:
- **Development**: `docker-compose.dev.yml` + `.env.development`
- **Production**: `docker-compose.prod.yml` + `.env.production`

### Componenti per Istanza
1. **MongoDB Container**: Database dedicato con porta univoca
2. **BotAI Backend Container**: Servizio Node.js
3. **Network Isolata**: Comunicazione interna sicura
4. **Volumi Persistenti**: Dati MongoDB persistenti

### Script di Gestione
```bash
./scripts/start-dev.sh    # Avvia development (porta 8082)
./scripts/start-prod.sh   # Avvia production (porta 8080)
./scripts/stop-dev.sh     # Ferma development
./scripts/stop-prod.sh    # Ferma production
./scripts/logs-dev.sh     # Visualizza logs development
./scripts/logs-prod.sh    # Visualizza logs production
```

## Come Aggiungere Nuovo Endpoint

1. **Crea controller method** in `src/controllers/[Name]Controller.ts`
   ```typescript
   export const myMethod = async (req: Request, res: Response) => {
     try {
       // Logic here
       return successResponse(res, data);
     } catch (error) {
       return errorResponse(res, 'Error message', 500);
     }
   };
   ```

2. **Aggiungi route** in `src/routes/[name].ts`
   ```typescript
   router.post('/my-endpoint', verifyAdminApiKey, myMethod);
   ```

3. **Registra route** in `src/routes/index.ts`
   ```typescript
   app.use('/my-path', myRoutes);
   ```

## Integrazione con Game Backend

### Flow di Comunicazione
1. **Evento di gioco** succede nel game-backend (es. messaggio in chat)
2. **Bot relevance check**: Determina quali bot dovrebbero reagire
3. **Fetch context**: Recupera dati necessari (character, location, history)
4. **Claude decision**: AI decide azione appropriata
5. **Execute action**: Invia azione al game-backend
6. **Store memory**: Salva interazione nella memoria del bot

### Sync con Game Backend
- **Character sync**: Aggiorna snapshot dati personaggi
- **Location sync**: Aggiorna cache azioni disponibili
- **Periodic sync**: Mantiene dati allineati

## Note Importanti

- **Separazione dal game-backend**: Database e servizi completamente isolati
- **Scalabilità**: Può girare su macchine separate dal game stack
- **Fallback safety**: Il gioco funziona anche se botai è offline
- **Memory management**: Usa importance score per decidere cosa ricordare
- **Rate limiting**: Evita spam di azioni bot
- **Type Safety**: TypeScript strict mode attivo
- **Error resilience**: Gestione errori robusta per non bloccare il gioco

## Dipendenze Esterne

### Claude SDK
- **@anthropic-ai/sdk**: Client ufficiale Anthropic
- Modelli usati: Haiku (veloce, economico), Sonnet (accurato)
- API key richiesta da Anthropic

### MongoDB
- Database dedicato per botai
- Mongoose per ODM
- Collections: bots, bot_memories, bot_relationships, character_snapshots

### Game Backend
- HTTP REST API per fetch dati e inviare azioni
- Autenticazione via API key
- Endpoints usati: `/game/characters/:id`, `/game/locations/:id`, `/game/chats/:locationId/messages`

## Testing

### Health Check
```bash
curl http://localhost:8082/health  # Development
curl http://localhost:8080/health  # Production
```

### Verifica Environment Variables
```bash
docker exec botai-backend-dev env | grep GAME_BACKEND_URL
docker exec botai-backend-prod env | grep GAME_BACKEND_URL
```

### Test Bot Creation
```bash
curl -X POST http://localhost:8082/bots \
  -H "X-Admin-API-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestBot","characterId":"test1"}'
```
