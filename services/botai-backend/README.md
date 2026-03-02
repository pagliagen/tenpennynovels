# BotAI Backend

Backend service per gestire personaggi bot NPC con intelligenza artificiale usando Claude SDK.

## Descrizione

Questo servizio gestisce personaggi bot non giocanti (NPC) per il gioco di ruolo ambientato nella Londra vittoriana. I bot possono:
- Rispondere automaticamente alle azioni dei giocatori
- Mantenere memoria delle conversazioni
- Sviluppare relazioni con i personaggi
- Avere personalità, obiettivi ed emozioni dinamiche

## Architettura

```
game-backend (OVH) ←─ HTTP (ngrok) ─→ botai-backend (PC locale)
                                              ↓
                                        Claude SDK API
                                              ↓
                                        MongoDB (locale)
```

- **Separazione completa**: Database MongoDB separato, nessuna connessione Redis
- **Comunicazione HTTP**: Webhook via ngrok per notifiche da game-backend
- **Fallback graceful**: Se botai non raggiungibile, il gioco continua normalmente

## Prerequisiti

- Node.js 18+
- MongoDB (locale)
- Docker (opzionale)
- Claude API Key (Anthropic)
- ngrok (per esporre servizio locale)

## Installazione

### 1. Installa dipendenze

```bash
cd services/botai-backend
npm install
```

### 2. Configura environment

Crea due file separati `.env.development` e `.env.production`:

```bash
cp .env.example .env.development
cp .env.example .env.production
```

Modifica i file con le credenziali per ogni ambiente:

**`.env.development`** (localhost):
```env
GAME_BACKEND_URL=http://host.docker.internal:3001
GAME_BACKEND_BOT_API_KEY=your-dev-bot-api-key
ADMIN_BACKEND_URL=http://host.docker.internal:3002
ADMIN_BACKEND_BOT_API_KEY=your-dev-admin-key
MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=botai123
ANTHROPIC_API_KEY=your-claude-api-key
```

**`.env.production`** (OVH):
```env
GAME_BACKEND_URL=https://api.tenpennynovels.com
GAME_BACKEND_BOT_API_KEY=your-prod-bot-api-key
ADMIN_BACKEND_URL=https://api.tenpennynovels.com
ADMIN_BACKEND_BOT_API_KEY=your-prod-admin-key
MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=strong-password
ANTHROPIC_API_KEY=your-claude-api-key
```

> **Nota**: `ADMIN_BACKEND_BOT_API_KEY` serve a due scopi:
> 1. Proteggere gli endpoint admin del botai-backend (usata ora)
> 2. Autenticare chiamate verso management-backend (uso futuro)

### 3. Avvia MongoDB locale

```bash
mongod --dbpath /path/to/data
```

### 4. Build e avvia

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## Deployment con Docker Compose

BotAI Backend può girare in Docker con il proprio MongoDB dedicato, eliminando conflitti di porta e permettendo deployment indipendente.

### Stack Docker Compose

Lo stack include:
- **MongoDB dedicato** per BotAI (porta configurabile per dev/prod)
- **BotAI Backend** (porta 8080 interno, 8082 per dev o 8080 per prod)
- **Rete isolata** per comunicazione interna
- **Volumi persistenti** per dati MongoDB

### Configurazione Environment

1. **File di configurazione** - Crea file separati per ogni ambiente:

```bash
cp .env.example .env.development
cp .env.example .env.production
```

Modifica i file con le credenziali per ogni ambiente.

**`.env.development`**:
```env
NODE_ENV=development
PORT=8080  # Porta interna container

GAME_BACKEND_URL=http://host.docker.internal:3001
GAME_BACKEND_BOT_API_KEY=your-dev-bot-api-key
ADMIN_BACKEND_URL=http://host.docker.internal:3002
ADMIN_BACKEND_BOT_API_KEY=your-dev-admin-bot-api-key

MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=botai123
MONGODB_ROOT_DATABASE=botai-dev

ANTHROPIC_API_KEY=your-anthropic-api-key-here
CLAUDE_MODEL=claude-haiku-4-5-20251001
TRANSLATE_MODEL=claude-sonnet-4-5-20250929
```

**`.env.production`**:
```env
NODE_ENV=production
PORT=8080  # Porta interna container

GAME_BACKEND_URL=https://api.tenpennynovels.com
GAME_BACKEND_BOT_API_KEY=your-prod-bot-api-key
ADMIN_BACKEND_URL=https://api.tenpennynovels.com
ADMIN_BACKEND_BOT_API_KEY=your-prod-admin-bot-api-key

MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=strong-password
MONGODB_ROOT_DATABASE=botai-prod

ANTHROPIC_API_KEY=your-anthropic-api-key-here
CLAUDE_MODEL=claude-haiku-4-5-20251001
TRANSLATE_MODEL=claude-sonnet-4-5-20250929
```

Gli script nella cartella `scripts/` caricano automaticamente il file `.env` corretto per l'ambiente.

### Comandi Gestione Docker

#### Development (porta 8082)

```bash
# Avvia stack development (MongoDB + BotAI Backend)
npm run docker:dev:start
# oppure
./scripts/start-dev.sh

# Ferma stack development
npm run docker:dev:stop
# oppure
./scripts/stop-dev.sh

# Mostra log development (usa -f per follow)
npm run docker:dev:logs
# oppure
./scripts/logs-dev.sh
./scripts/logs-dev.sh -f  # follow mode
```

#### Production (porta 8080)

```bash
# Avvia stack production (MongoDB + BotAI Backend)
npm run docker:prod:start
# oppure
./scripts/start-prod.sh

# Ferma stack production
npm run docker:prod:stop
# oppure
./scripts/stop-prod.sh

# Mostra log production (usa -f per follow)
npm run docker:prod:logs
# oppure
./scripts/logs-prod.sh
./scripts/logs-prod.sh -f  # follow mode
```

#### Comandi Docker Diretti

Se preferisci usare docker-compose direttamente:

```bash
# Development
docker-compose -f docker-compose.dev.yml --env-file .env.development up -d
docker-compose -f docker-compose.dev.yml --env-file .env.development down
docker-compose -f docker-compose.dev.yml --env-file .env.development logs -f

# Production
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
docker-compose -f docker-compose.prod.yml --env-file .env.production down
docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f
```

### Deployment Produzione (Macchina Separata)

Per deployare BotAI su una macchina dedicata:

1. **Clona repository** sulla macchina BotAI:
```bash
git clone <repo-url>
cd services/botai-backend
```

2. **Installa dipendenze**:
```bash
npm install
```

3. **Configura `.env.production` per produzione** (usa chiavi forti!):
```env
# Server Configuration
NODE_ENV=production
PORT=8080

# MongoDB Configuration
MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=STRONG_PASSWORD
MONGODB_ROOT_DATABASE=botai-prod

# Game Backend (OVH)
GAME_BACKEND_URL=https://api.tenpennynovels.com
GAME_BACKEND_BOT_API_KEY=production-bot-api-key

# Management Backend (OVH) - Feature futura
ADMIN_BACKEND_URL=https://api.tenpennynovels.com
ADMIN_BACKEND_BOT_API_KEY=production-admin-bot-api-key

# Claude API
ANTHROPIC_API_KEY=your-production-anthropic-key
CLAUDE_MODEL=claude-haiku-4-5-20251001
TRANSLATE_MODEL=claude-sonnet-4-5-20250929

# CORS Configuration
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
```

4. **Avvia con Docker Compose**:
```bash
npm run docker:prod:start
# oppure
./scripts/start-prod.sh
```

5. **Esponi con ngrok o reverse proxy**:
```bash
# Con ngrok
ngrok http 8080

# O configura nginx/caddy come reverse proxy
```

6. **Configura game-backend** con l'URL pubblico di BotAI:
```env
BOTAI_WEBHOOK_URL=https://your-botai-public-url.com
```

### Architettura Deployment

#### Locale (Development)
```
┌─────────────────────────────────────────┐
│ Game Stack                              │
│ ├─ MongoDB:       27017                 │
│ ├─ Redis:         6379                  │
│ └─ Game Backend:  3001 (fuori Docker)   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ BotAI Stack (Autonomo)                  │
│ ├─ MongoDB:       27018 → 27017         │
│ └─ BotAI Backend: 8080                  │
└─────────────────────────────────────────┘
```

#### Produzione (Macchine Separate)
```
┌─────────────────────────────────────────┐
│ Macchina 1 (OVH) - Game Stack           │
│ ├─ MongoDB:       27017                 │
│ ├─ Redis:         6379                  │
│ └─ Game Backend:  3001                  │
└─────────────────────────────────────────┘
                    ↕ HTTP/Webhook
┌─────────────────────────────────────────┐
│ Macchina 2 - BotAI Stack                │
│ ├─ MongoDB:       27017 (locale)        │
│ └─ BotAI Backend: 8080 (esposto)        │
└─────────────────────────────────────────┘
```

### Vantaggi Deployment Docker

✅ **Zero conflitti** - Porte MongoDB separate (27020 dev, 27019 prod) in locale
✅ **Isolamento completo** - Stack indipendenti con proprie reti e volumi
✅ **Scalabilità** - Può girare su hardware dedicato in produzione
✅ **Manutenzione separata** - Aggiornamenti senza toccare game stack
✅ **Hot-reload in dev** - Development con tsx watch per modifiche immediate
✅ **Deploy facile** - Script npm per gestione completa

## Verifiche Post-Deploy

Dopo l'avvio, verifica che tutto funzioni:

```bash
# Health check BotAI (development su porta 8082)
curl http://localhost:8082/health

# Health check BotAI (production su porta 8080)
curl http://localhost:8080/health

# Verifica containers attivi
docker ps | grep botai

# Logs in tempo reale (development)
./scripts/logs-dev.sh -f

# Logs in tempo reale (production)
./scripts/logs-prod.sh -f
```

## Esposizione con ngrok

Esponi il servizio production locale per ricevere webhook da game-backend:

```bash
# Avvia production (porta 8080)
npm run docker:prod:start

# In un altro terminale, esponi con ngrok
ngrok http 8080
```

Copia l'URL generato (es: `https://kindredly-untinted-rosanna.ngrok-free.dev`) e configuralo in game-backend come `BOTAI_WEBHOOK_URL`.

**Nota**: Usa sempre l'istanza **production** (porta 8080) per ngrok, non development.

## API Endpoints

### Health Checks

- `GET /health` - Health status
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Bot Management (require Admin API Key)

- `POST /bots` - Crea nuovo bot (manuale con payload completo)
- `POST /bots/generate` - **Genera bot con AI** (Claude Haiku + Sonnet per profili psicologici)
- `GET /bots` - Lista tutti i bot
- `GET /bots/:botId` - Dettagli bot
- `PUT /bots/:botId` - Aggiorna bot
- `DELETE /bots/:botId` - Disattiva bot
- `POST /bots/:botId/activate` - Attiva bot
- `PATCH /bots/:botId/emotional-state` - Aggiorna stato emotivo
- `PATCH /bots/:botId/active-emotions` - Gestisci emozioni attive

### Sync Endpoints (webhook da game-backend)

- `POST /sync/action` - Riceve notifica nuova azione
- `POST /sync/character` - Riceve aggiornamento personaggio
- `GET /sync/status` - Status sync

## Creare un Bot

### Metodo 1: Generazione AI (Raccomandato) 🤖

Genera automaticamente bot con profili psicologici completi usando Claude AI:

```bash
curl -X POST http://localhost:8080/bots/generate \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: your-admin-key" \
  -d '{
    "locationId": "6983aab878eac8ca4255363f",
    "locationName": "The Whitechapel Tavern",
    "locationDescription": "Una taverna frequentata dai lavoratori di Whitechapel",
    "description": "Un barista esperto sulla cinquantina che gestisce il bancone con autorità silenziosa",
    "tags": ["bancone"]
  }'
```

Il sistema genera automaticamente:
- ✅ **Assi psicologici** (6 dimensioni da -3 a +3)
- ✅ **Ferita centrale** (wound + manifestation)
- ✅ **Dualità** (maschera pubblica vs verità privata)
- ✅ **Personalità completa** (traits, values, speech pattern)
- ✅ **Background e obiettivi**
- ✅ **Traduzione in italiano** con Sonnet

**Oppure usa lo script helper**:

```bash
# Genera 4 bot per una location
ADMIN_BACKEND_BOT_API_KEY=your-key \
BOTAI_WEBHOOK_URL=http://localhost:8080 \
npx tsx scripts/generate-bot.ts "The Whitechapel Tavern" 4
```

### Metodo 2: Creazione Manuale

Per controllo completo sul bot, puoi crearlo manualmente:

```json
{
  "name": "Thomas",
  "surname": "Blackwood",
  "gender": "male",
  "psychologicalAxes": {
    "rationalEmotional": -2,
    "controlledImpulsive": -3,
    "cynicalIdealist": -1,
    "proudSubmissive": -2,
    "prudentParanoid": 1,
    "directAllusive": -2
  },
  "centralWound": {
    "wound": "Loss of agency and status",
    "manifestation": "Maintains iron control over his domain"
  },
  "duality": {
    "publicMask": "Efficient, impassive barista",
    "privateTruth": "Broken man haunted by failures"
  },
  "physicalDescription": "Un uomo di mezza età con capelli grigi",
  "publicDescription": "Il proprietario della taverna",
  "personality": {
    "traits": ["gioviale", "curioso", "diffidente"],
    "coreValues": ["lealtà", "onestà"],
    "speechPattern": "Parla con accento cockney londinese",
    "emotionalRange": { "min": -5, "max": 8 }
  },
  "goals": {
    "shortTerm": ["Mantenere la taverna sicura"],
    "longTerm": ["Proteggere la famiglia"]
  },
  "activationRules": {
    "keywords": ["thomas", "taverna", "proprietario"],
    "contextualRelevance": 50,
    "cooldownMinutes": 5
  }
}
```

```bash
curl -X POST http://localhost:8080/bots \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: your-admin-key" \
  -d @bot-data.json
```

## Database Models

### Database Connection
BotAI usa connessioni MongoDB separate per dev/prod:
- **Development**: MongoDB su porta 27020 → Database `botai-dev`
- **Production**: MongoDB su porta 27019 → Database `botai-prod`

### Bot
Configurazione completa bot con **profilo psicologico**:
- `psychologicalAxes`: 6 assi psicologici (-3 a +3)
  - rationalEmotional, controlledImpulsive, cynicalIdealist
  - proudSubmissive, prudentParanoid, directAllusive
- `centralWound`: Ferita psicologica centrale + manifestazione
- `duality`: Maschera pubblica vs verità privata
- `activeEmotions`: Array di emozioni attive con intensità
- `personality`: Traits, core values, speech pattern, emotional range
- `goals`: Obiettivi a breve e lungo termine
- `activationRules`: Keywords, relevance, cooldown

### BotMemory
Memoria conversazioni ed eventi con emotional impact

### BotRelationship
Relazioni bot-personaggi con **profondità psicologica**:
- `sentiment`, `trustLevel`, `familiarity`: Metriche base
- `relationshipArchetype`: Tipo relazione (protetto, rivale, tentazione, minaccia, alleato, specchio)
- `sourceCredibility`: Affidabilità come fonte di informazioni (-3 a +3)
- `latentTensions`: Sospetti e tensioni non confermate con stato

### CharacterSnapshot
Snapshot dati personaggi per context

### LocationActionCache
Cache azioni location processate

### BotResponse
Audit log risposte generate con token usage

## Sistema Cognitivo-Emotivo 🧠

BotAI implementa un framework psicologico completo per bot NPC realistici e profondi:

### Assi Psicologici (6 dimensioni)

Ogni bot ha 6 assi psicologici su scala **-3 a +3**:

| Asse | Estremo Negativo (-3) | Centro (0) | Estremo Positivo (+3) |
|------|----------------------|------------|----------------------|
| **Razionale/Emotivo** | Estremamente razionale | Bilanciato | Estremamente emotivo |
| **Controllato/Impulsivo** | Molto controllato | Equilibrato | Molto impulsivo |
| **Cinico/Idealista** | Profondamente cinico | Pragmatico | Profondamente idealista |
| **Orgoglioso/Remissivo** | Molto orgoglioso | Equilibrato | Molto remissivo |
| **Prudente/Paranoico** | Estremamente prudente | Cauto | Paranoico |
| **Diretto/Allusivo** | Molto diretto | Equilibrato | Molto allusivo |

Questi assi governano le **reazioni istintive** del bot e sono sempre rispettati nelle risposte.

### Ferita Centrale

Ogni bot ha una **ferita psicologica profonda** che guida il comportamento:
- **Wound**: La ferita o bisogno centrale (es: "Fear of abandonment", "Loss of status")
- **Manifestation**: Come si manifesta nel comportamento quotidiano

Esempi:
- *Wound*: "Paura dello scandalo sociale"
  *Manifestation*: "Mantiene segreti ossessivamente e osserva tutto per proteggersi"
- *Wound*: "Fame di riconoscimento"
  *Manifestation*: "Cerca costantemente validazione attraverso pettegolezzi e consigli"

### Dualità (Maschera vs Verità)

Separazione tra identità pubblica e privata:
- **Public Mask**: Ciò che mostra al mondo (es: "Barista efficiente e impassibile")
- **Private Truth**: Chi è realmente (es: "Uomo spezzato tormentato dai fallimenti")

La **maschera** è mantenuta sempre, la **verità** emerge solo con trust > 80 o in momenti di vulnerabilità.

### Emozioni Attive

Array di emozioni multiple con intensità e trigger:
```typescript
activeEmotions: [
  { emotion: "ansia", intensity: 7, trigger: "Rumors about the murder" },
  { emotion: "curiosità", intensity: 5, trigger: "New stranger in tavern" }
]
```

Influenzano sottilmente tono, scelte di parole e reazioni.

### Relazioni con Archetipi

Le relazioni hanno **archetipi dinamici**:
- **Protetto**: Il bot vuole proteggere il personaggio
- **Rivale**: Competizione o antagonismo
- **Tentazione**: Attrazione o desiderio (non solo romantico)
- **Minaccia**: Il personaggio rappresenta un pericolo
- **Alleato**: Partnership e fiducia reciproca
- **Specchio**: Il personaggio riflette aspetti del bot

### Affidabilità Fonte & Tensioni Latenti

Sistema di **filtro informazioni indirette**:

**Affidabilità fonte** (-3 a +3):
- **-3 a -1**: Fonte inaffidabile → informazioni ignorate o tensioni dormienti
- **0**: Fonte neutra → tensioni latenti attive (richiedono conferma)
- **+1 a +3**: Fonte affidabile → aggiornamento sentiment diretto

**Tensioni latenti** (sospetti non confermati):
- **State**: dormant, active, confirmed, dismissed
- **Severity**: 0-10
- Il bot mostra curiosità, cautela o allusioni indirette (non accusa direttamente)

### Generazione con AI

Il sistema usa **2 modelli Claude**:
1. **Claude Haiku 4.5**: Generazione veloce del profilo psicologico (in inglese)
2. **Claude Sonnet 4.5**: Traduzione accurata e context-aware in italiano

**Vantaggi**:
- ⚡ **Veloce**: Haiku genera in ~10-15 secondi
- 🎯 **Accurato**: Sonnet traduce mantenendo atmosfera vittoriana
- 💰 **Economico**: Haiku costa molto meno di Sonnet per generazione
- 🌍 **Multilingua**: Output italiano naturale e idiomatico

## Flusso Operativo

1. Player invia azione in location → game-backend
2. game-backend salva azione, invia webhook a botai-backend (HTTP via ngrok)
3. botai-backend valuta se bot deve rispondere:
   - Verifica keywords
   - Calcola relevance
   - Controlla cooldown
4. Se deve rispondere:
   - Carica memoria e relazioni
   - Prepara context per Claude
   - Genera risposta con Claude SDK
   - Salva memoria e aggiorna relazioni
   - Posta risposta a game-backend (HTTP con API key)
5. game-backend riceve risposta bot, la mostra ai players

## Gestione Errori

- **Timeout webhook**: Bot disabilitato per sessione corrente
- **Claude API fail**: Risposta salvata come fallita, retry non automatico
- **MongoDB down**: Service unhealthy, container restart

## Logging

Log salvati in:
- Console (development)
- `logs/combined.log` (production)
- `logs/error.log` (solo errori)

Livelli: error, warn, info, http, debug

## Monitoring

Health check endpoint per Kubernetes/Docker:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 40
  periodSeconds: 10
```

## Sicurezza

- API key auth per bot management
- Nessuna auth per webhook sync (network isolation via ngrok)
- Helmet per security headers
- CORS configurabile
- Input validation su tutti gli endpoint

## Performance

- Risposte webhook immediate (processing asincrono)
- Memoria limitata a 15 memorie per context
- Cleanup automatico memorie vecchie (7 giorni, importance < 30)
- Connection pooling MongoDB

## Troubleshooting

### Bot non risponde

1. Verifica bot attivo: `GET /bots/:botId`
2. Controlla cooldown nelle risposte recenti
3. Verifica keywords o relevance bassa
4. Controlla log Claude API errors

### Webhook non arriva

1. Verifica ngrok attivo e URL corretto
2. Testa endpoint: `curl http://localhost:8080/sync/action`
3. Controlla log game-backend per timeout
4. Verifica session.botDisabledForSession nel DB

### Claude API errors

1. Verifica ANTHROPIC_API_KEY valida in `.env.development` o `.env.production`
2. Controlla rate limits su dashboard Anthropic
3. Test connection: `curl http://localhost:8080/health`
4. Verifica logs: `./scripts/logs-prod.sh` o `./scripts/logs-dev.sh`

### Docker containers non partono

1. Verifica porte libere: `lsof -i :8080` (prod) o `lsof -i :8082` (dev)
2. Controlla MongoDB: `lsof -i :27019` (prod) o `lsof -i :27020` (dev)
3. Ferma container esistenti: `./scripts/stop-prod.sh` o `./scripts/stop-dev.sh`
4. Riavvia: `./scripts/start-prod.sh` o `./scripts/start-dev.sh`

### Environment variables non caricate

1. Verifica file `.env.development` e `.env.production` esistano
2. Controlla che gli script usino `--env-file` correttamente
3. Riavvia i container per caricare le nuove variabili

## Sviluppo

### Run tests
```bash
npm test
```

### Lint
```bash
npm run lint
```

### Watch mode
```bash
npm run dev
```

## 🔄 Dual Instance Setup (Production + Development)

Il BotAI Backend supporta l'esecuzione di **due istanze separate contemporaneamente**:
- **Production** (porta 8080): Build compilato, database prod, ngrok-ready
- **Development** (porta 8082): Hot-reload con tsx watch, database dev

### Vantaggi

✅ **Isolamento completo** - Production e development non si interferiscono
✅ **Database separati** - Dati di test non contaminano produzione
✅ **Hot-reload in dev** - Modifiche TypeScript si riflettono immediatamente
✅ **Build ottimizzato in prod** - Performance massime con codice compilato
✅ **Gestione indipendente** - Ogni istanza può essere avviata/fermata separatamente
✅ **Ngrok-ready** - Production su porta 8080 pronta per esposizione esterna

### Architettura Database

Entrambe le istanze usano container MongoDB separati:
- **Production**: `botai-mongodb-prod` (porta 27019) → Database `botai-prod`
- **Development**: `botai-mongodb-dev` (porta 27020) → Database `botai-dev`

### Quick Start

#### Avviare Production

```bash
cd services/botai-backend
./scripts/start-prod.sh
```

L'istanza production sarà disponibile su:
- **API**: http://localhost:8080
- **Health**: http://localhost:8080/health
- **MongoDB**: localhost:27019

#### Avviare Development

```bash
cd services/botai-backend
./scripts/start-dev.sh
```

L'istanza development sarà disponibile su:
- **API**: http://localhost:8082
- **Health**: http://localhost:8082/health
- **MongoDB**: localhost:27020
- **Hot-reload**: ✅ Attivo (tsx watch)

#### Fermare le Istanze

```bash
# Ferma production
./scripts/stop-prod.sh

# Ferma development
./scripts/stop-dev.sh
```

#### Visualizzare i Logs

```bash
# Logs production
./scripts/logs-prod.sh

# Logs development
./scripts/logs-dev.sh
```

### Configurazione Environment

Le istanze usano **due file separati** per gestire le configurazioni:

**File `.env.development`** (usato da development):
```env
# Development Environment
NODE_ENV=development
PORT=8080

GAME_BACKEND_URL=http://host.docker.internal:3001
GAME_BACKEND_BOT_API_KEY=...
ADMIN_BACKEND_URL=http://host.docker.internal:3002
ADMIN_BACKEND_BOT_API_KEY=...

MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=...
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-4-5-20251001
TRANSLATION_MODEL=claude-sonnet-4-5-20250929
LOG_LEVEL=debug
```

**File `.env.production`** (usato da production):
```env
# Production Environment
NODE_ENV=production
PORT=8080

GAME_BACKEND_URL=https://api.tenpennynovels.com
GAME_BACKEND_BOT_API_KEY=...
ADMIN_BACKEND_URL=https://api.tenpennynovels.com
ADMIN_BACKEND_BOT_API_KEY=...

MONGODB_ROOT_USERNAME=admin
MONGODB_ROOT_PASSWORD=...
ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-haiku-4-5-20251001
TRANSLATION_MODEL=claude-sonnet-4-5-20250929
LOG_LEVEL=info
```

I docker-compose files (`docker-compose.dev.yml` e `docker-compose.prod.yml`) caricano automaticamente il file `.env` corretto:
- **Production** usa `.env.production` → porta 8080, database `botai-prod`
- **Development** usa `.env.development` → porta 8082, database `botai-dev`

### Eseguire Entrambe Contemporaneamente

Puoi avviare entrambe le istanze sulla stessa macchina:

```bash
./scripts/start-prod.sh   # Production su 8080
./scripts/start-dev.sh    # Development su 8082

# Verifica che entrambe siano attive
docker ps | grep botai
# Expected: 4 container (2 backend + 2 mongodb)

# Test health di entrambe
curl http://localhost:8080/health  # Production
curl http://localhost:8082/health  # Development
```

### Testing Hot-Reload (Development)

1. Avvia development: `./scripts/start-dev.sh` o `npm run docker:dev:start`
2. Modifica un file TypeScript in `src/`
3. Guarda i logs: `./scripts/logs-dev.sh -f` (follow mode)
4. Il servizio si ricaricherà automaticamente (tsx watch)

### Configurare ngrok per Production

Per esporre l'istanza production tramite ngrok:

```bash
# Avvia production
npm run docker:prod:start

# In un altro terminale, avvia ngrok sulla porta 8080
ngrok http 8080
```

Configura l'URL ngrok generato nel game-backend:

```env
# game-backend/.env
BOTAI_WEBHOOK_URL=https://your-ngrok-url.ngrok.io
```

### Separazione Database

Le due istanze usano database completamente separati. Per verificarlo:

```bash
# Crea un bot in production
curl -X POST http://localhost:8080/bots \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: your-admin-key" \
  -d '{"name":"ProdBot","characterId":"char1"}'

# Lista bots in development (non dovrebbe includere ProdBot)
curl http://localhost:8082/bots \
  -H "X-Admin-API-Key: your-admin-key"
```

### Environment Detection

Entrambe le istanze rilevano l'environment dal header `X-Environment` inviato dal game-backend:

```bash
# Test production
curl -X POST http://localhost:8080/sync/action \
  -H "X-Environment: production" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"location_action_created",...}'

# Test development
curl -X POST http://localhost:8082/sync/action \
  -H "X-Environment: development" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"location_action_created",...}'
```

### Troubleshooting

**Porta già in uso:**
```bash
# Verifica quale processo usa la porta
lsof -i :8080  # Production
lsof -i :8082  # Development

# Ferma l'istanza corrispondente
./scripts/stop-prod.sh
./scripts/stop-dev.sh
```

**Hot-reload non funziona:**
```bash
# Riavvia l'istanza development
./scripts/stop-dev.sh
./scripts/start-dev.sh

# Verifica che i volumi siano montati
docker inspect botai-backend-dev | grep -A 10 Mounts
```

**Database non raggiungibile:**
```bash
# Verifica che MongoDB sia healthy
docker ps | grep botai-mongodb

# Controlla i logs MongoDB
docker logs botai-mongodb-prod
docker logs botai-mongodb-dev
```

### File di Configurazione

- `docker-compose.prod.yml` - Configurazione production
- `docker-compose.dev.yml` - Configurazione development
- `Dockerfile` - Build production (multi-stage)
- `Dockerfile.dev` - Build development (hot-reload)
- `.env.production` - Variabili production
- `.env.development` - Variabili development
- `scripts/` - Script di gestione

## Licenza

Proprietario - Ten Penny Novels

## Contatti

Per supporto o domande, contatta il team di sviluppo.
