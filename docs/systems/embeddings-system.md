# Sistema Embeddings - Ricerca Semantica

Sistema di embeddings event-driven per ricerca semantica su documenti e location actions. Utilizza architettura asincrona con Redis pub/sub per zero-latency sulle API.

## 📋 Indice

- [Panoramica](#panoramica)
- [Architettura](#architettura)
- [Componenti](#componenti)
- [Modelli Database](#modelli-database)
- [Flusso di Lavoro](#flusso-di-lavoro)
- [Performance](#performance)
- [Setup e Gestione](#setup-e-gestione)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)

## 🎯 Panoramica

### Cosa fa il sistema?

Genera **embeddings vettoriali** (rappresentazioni numeriche) del testo per permettere ricerche semantiche intelligenti:

- **Documenti**: "Come posso creare un personaggio?" → trova documenti su creazione personaggi
- **Giocate**: "Azioni di Lord Blackwood al pub" → trova tutte le azioni del personaggio in quella location

### Modello utilizzato

- **Nome**: `paraphrase-multilingual-MiniLM-L12-v2`
- **Tipo**: Sentence Transformer (Hugging Face)
- **Dimensioni**: 384 (vettore di 384 numeri per ogni testo)
- **Lingue**: Italiano, Inglese, + 50 lingue
- **Dimensione**: 118MB
- **Velocità**: ~100ms per embedding

### ⚠️ Importante: Solo Ricerca, Non Risposte

Questo modello **NON genera risposte** alle domande. È un embedding model, non un LLM:

```
✅ Cosa FA:
Input:  "Come creare un personaggio?"
Output: [0.15, -0.23, 0.87, ..., 0.45]  (384 numeri)
        ↓
Trova documenti simili tramite cosine similarity

❌ Cosa NON FA:
Input:  "Come creare un personaggio?"
Output: "Per creare un personaggio devi..."  (testo generato)
        ↑ Questo richiede un LLM (GPT, Claude, Llama)
```

Per generare risposte serve implementare **RAG (Retrieval-Augmented Generation)** con un LLM esterno.

## 🏗️ Architettura

### Event-Driven Design

```
┌─────────────────┐      ┌──────────────┐      ┌──────────────────┐
│  API Backends   │─────▶│ Redis Pub/Sub │─────▶│ Embeddings Worker│
│ (Game/Mgmt)     │      │  (3 channels) │      │   (Node.js)      │
└─────────────────┘      └──────────────┘      └──────────────────┘
        │ 150ms                                         │ 100ms
        ▼                                               ▼
┌─────────────────┐                            ┌──────────────────┐
│    MongoDB      │◀───────────────────────────│ Embeddings       │
│   (Documents)   │      Update embeddings     │ Service (Flask)  │
└─────────────────┘                            └──────────────────┘
```

### Flusso Zero-Latency

1. **User crea documento** → API salva in MongoDB (150ms)
2. **API risponde subito** → Utente non aspetta
3. **API pubblica evento** → Redis channel (background)
4. **Worker riceve evento** → Genera embedding (100ms)
5. **Worker aggiorna DB** → Embedding disponibile per ricerche

**Total latency percepita**: 150ms (come senza embeddings!)

## 🧩 Componenti

### 1. Embeddings Service (Flask HTTP)

**Container**: `tenpennynovels-embeddings`
**Port**: 5001
**Language**: Python 3.13
**Image**: tenpennynovels/embeddings-service:latest

```python
# Endpoints disponibili
POST /embed          # Singolo embedding
POST /embed/batch    # Batch embeddings
GET  /health         # Health check
```

**Features**:
- Modello pre-caricato all'avvio (evita reload)
- Batch processing per performance
- Health checks integrati
- Docker multi-stage build

**Dockerfile location**: `services/embeddings-service/Dockerfile`

### 2. Embeddings Worker (Node.js/TypeScript)

**Container**: `tenpennynovels-embeddings-worker`
**Language**: TypeScript (Node.js 22)
**Image**: tenpennynovels/embeddings-worker:latest

```typescript
// Redis channels ascoltati
'embedding:document:created'
'embedding:document:updated'
'embedding:location_action:created'

// Processing flow
1. Riceve evento da Redis
2. Carica contesto necessario (es. location.name)
3. Chiama embeddings service HTTP
4. Salva embedding in MongoDB
```

**Features**:
- Event-driven 24/7
- Modelli Mongoose semplificati (solo campi essenziali)
- Error handling robusto
- Logging strutturato con emoji

**Dockerfile location**: `services/embeddings-worker/Dockerfile`

### 3. Redis Pub/Sub

**Channels**:

```typescript
const REDIS_CHANNELS = {
  EMBEDDING_DOCUMENT_CREATED: 'embedding:document:created',
  EMBEDDING_DOCUMENT_UPDATED: 'embedding:document:updated',
  EMBEDDING_LOCATION_ACTION_CREATED: 'embedding:location_action:created',
} as const;
```

**Event Schema**:

```typescript
interface DocumentEmbeddingEvent {
  eventId: string;           // UUID v4
  timestamp: Date;           // Event creation time
  documentId: string;        // MongoDB ObjectId
  title: string;             // Document title
  content: string;           // Full content
  type: 'ambientazione' | 'regolamento' | 'lore';
}

interface LocationActionEmbeddingEvent {
  eventId: string;
  timestamp: Date;
  locationActionId: string;  // MongoDB ObjectId
  characterId: string;
  characterName: string;
  locationId: string;
  content: string;           // Action content
  actionType: string;        // emote, action, etc.
}
```

## 📊 Modelli Database

### Document Model (Completo)

**Location**: `services/database/models/Document.ts`

```typescript
interface IDocument extends MongooseDocument {
  // Contenuto principale
  title: string;
  content: string;
  slug: string;
  type: 'ambientazione' | 'regolamento' | 'lore';

  // Organizzazione
  groupId: Schema.Types.ObjectId;
  group: string;

  // Embeddings per semantic search
  contentEmbedding?: number[];        // 384 dimensions
  embeddingModel?: string;            // 'paraphrase-multilingual-MiniLM-L12-v2'
  embeddingGeneratedAt?: Date;        // Timestamp generazione

  // ... altri campi (visibilità, versioning, autori, ecc.)
}
```

**Validazione embedding**:
```typescript
contentEmbedding: {
  type: [Number],
  required: false,
  validate: {
    validator: function (v: number[]) {
      return !v || v.length === 0 || v.length === 384;
    },
    message: 'Embedding must be 384 dimensions'
  }
}
```

### LocationAction Model (Completo)

**Location**: `services/database/models/LocationAction.ts`

```typescript
interface ILocationAction {
  characterId: Schema.Types.ObjectId;
  locationId: Schema.Types.ObjectId;
  content: string;
  actionType: string;

  // Embedding context (cached per search)
  locationName?: string;              // Nome location per contesto
  contentEmbedding?: number[];        // 384 dimensions
  embeddingModel?: string;
  embeddingGeneratedAt?: Date;

  // ... altri campi
}
```

### Worker Models (Semplificati)

**Location**: `services/embeddings-worker/src/models/`

Il worker ha modelli ridotti con **solo i campi necessari**:

```typescript
// Document.ts (worker)
{
  title: string;
  content: string;
  type: string;
  contentEmbedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Date;
}

// Location.ts (worker)
{
  name: string;           // Solo per contesto
  description?: string;
}

// LocationAction.ts (worker)
{
  characterId: ObjectId;
  locationId: ObjectId;
  content: string;
  actionType: string;
  locationName?: string;
  contentEmbedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Date;
}
```

**Perché modelli semplificati?**
1. Riduce dipendenze (no `@tenpennynovels/shared`)
2. Build Docker più veloce
3. Worker fa solo update embeddings, non business logic
4. Modifiche ai modelli completi non impattano il worker

## 🔄 Flusso di Lavoro

### Document Creation/Update

```typescript
// 1. API Backend (DocumentController)
const document = await db.collection('documents').insertOne({
  title: "Creazione Personaggio",
  content: "Per creare un personaggio...",
  // ... altri campi
  contentEmbedding: undefined,  // Sarà popolato dal worker
});

// 2. Publish Redis Event
const redisPublisher = getRedisPublisher();
const embeddingPublisher = new EmbeddingEventPublisher(redisPublisher);
await embeddingPublisher.publishDocumentEvent(
  documentId,
  title,
  content,
  type,
  false // isUpdate
);

// 3. Response immediata al client
return res.json({ success: true, documentId });
```

```typescript
// 4. Worker riceve evento
async handleDocumentEvent(message: string) {
  const event: DocumentEmbeddingEvent = JSON.parse(message);

  // Generate embedding
  const text = `${event.title}\n\n${event.content}`;
  const truncated = text.substring(0, 2000); // Max 2000 chars
  const embedding = await this.generateEmbedding(truncated);

  // Update database
  await Document.findByIdAndUpdate(event.documentId, {
    contentEmbedding: embedding,
    embeddingModel: 'paraphrase-multilingual-MiniLM-L12-v2',
    embeddingGeneratedAt: new Date()
  });
}
```

### LocationAction Creation

```typescript
// 1. API Backend (LocationActionsController)
const action = await LocationAction.createAction({
  characterId,
  locationId,
  content: "Lord Blackwood ordina un whisky al barista",
  actionType: "action"
});

// 2. Publish Redis Event
await embeddingPublisher.publishLocationActionEvent(
  action._id,
  characterId,
  characterName,
  locationId,
  content,
  actionType
);

// 3. Worker processa
async handleLocationActionEvent(message: string) {
  const event: LocationActionEmbeddingEvent = JSON.parse(message);

  // Get location name for context
  const location = await Location.findById(event.locationId);

  // Generate embedding with context
  const text = `${event.characterName} a ${location.name}: ${event.content}`;
  const embedding = await this.generateEmbedding(text);

  // Update with embedding AND cached location name
  await LocationAction.findByIdAndUpdate(event.locationActionId, {
    locationName: location.name,
    contentEmbedding: embedding,
    embeddingModel: 'paraphrase-multilingual-MiniLM-L12-v2',
    embeddingGeneratedAt: new Date()
  });
}
```

## 📈 Performance

### Metriche Misurate

| Operazione | Sync (Prima) | Async (Dopo) | Improvement |
|------------|--------------|--------------|-------------|
| Document Seeding | 151 secondi | 133ms | **1135x** |
| API Response Time | +8s per doc | +0ms | **Instant** |
| Embedding Generation | 8s (spawn) | 100ms (HTTP) | **80x** |
| Batch Processing | Bloccante | 3-4s background | **Non-blocking** |

### Throughput Worker

- **Singolo embedding**: ~100ms
- **Batch 19 documenti**: ~3-4 secondi
- **Throughput**: ~5 embeddings/secondo

### Overhead Memoria

- **Embeddings Service**: ~500MB RAM (modello caricato)
- **Worker**: ~100MB RAM
- **Per documento**: ~1.5KB (384 float32)

## ⚙️ Setup e Gestione

### Environment Variables

```bash
# Embeddings Service (Flask)
EMBEDDINGS_SERVICE_HOST=0.0.0.0
EMBEDDINGS_SERVICE_PORT=5001
EMBEDDINGS_MODEL=paraphrase-multilingual-MiniLM-L12-v2
LOG_LEVEL=INFO

# Embeddings Worker (Node.js)
MONGODB_URI=mongodb://@tenpennynovels-mongodb:27017/tenpennynovels
REDIS_URL=redis://:redis123@tenpennynovels-redis:6379
EMBEDDINGS_SERVICE_URL=http://tenpennynovels-embeddings:5001
NODE_ENV=production
```

### Docker Commands

```bash
# Build
npm run docker:embeddings:build    # Build Flask service
npm run docker:worker:build         # Build Node.js worker

# Start
npm run docker:infra:up             # Avvia tutta l'infrastruttura
# Oppure singolarmente:
npm run docker:embeddings:up
npm run docker:worker:up

# Logs
npm run docker:embeddings:logs     # Service logs
npm run docker:worker:logs          # Worker logs

# Restart (dopo modifiche)
npm run docker:worker:restart
docker-compose -f docker-compose.infrastructure.yml restart tenpennynovels-embeddings
```

### Development Mode

```bash
# Worker in dev (senza Docker)
npm run worker:dev

# Embeddings service deve rimanere in Docker
npm run docker:embeddings:up
```

### Testing

```bash
# Test embeddings service health
curl http://localhost:5001/health

# Test singolo embedding
curl -X POST http://localhost:5001/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Come posso creare un personaggio?"}'

# Seed documents con embeddings async
npm run seed:documents -- --force

# Verifica worker processing
npm run docker:worker:logs

# Check embeddings in database
docker exec tenpennynovels-mongodb mongosh -u admin -p password123 \
  --authenticationDatabase admin tenpennynovels \
  --eval "db.documents.findOne({}, {title: 1, contentEmbedding: 1, embeddingGeneratedAt: 1})"
```

## 🔧 Troubleshooting

### Worker non processa eventi

```bash
# 1. Check worker logs
npm run docker:worker:logs

# 2. Verify Redis connection
docker exec tenpennynovels-redis redis-cli -a redis123 PING

# 3. Check Redis channels
docker exec tenpennynovels-redis redis-cli -a redis123 PUBSUB CHANNELS

# 4. Verify worker is subscribed
docker exec tenpennynovels-redis redis-cli -a redis123 PUBSUB NUMSUB embedding:document:created
```

### Embeddings non generati

```bash
# 1. Check embeddings service
curl http://localhost:5001/health

# 2. Test manual embedding
curl -X POST http://localhost:5001/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Test"}' | jq

# 3. Check MongoDB
docker exec tenpennynovels-mongodb mongosh -u admin -p password123 \
  --authenticationDatabase admin tenpennynovels \
  --eval "db.documents.countDocuments({contentEmbedding: {\$exists: true}})"
```

### Performance issues

```bash
# Monitor containers
docker stats tenpennynovels-embeddings tenpennynovels-embeddings-worker

# Check Redis memory
docker exec tenpennynovels-redis redis-cli -a redis123 INFO memory

# Worker CPU/Memory
docker logs tenpennynovels-embeddings-worker --tail 100
```

### Rebuild dopo modifiche

```bash
# Worker code changes
npm run docker:worker:build
npm run docker:worker:restart

# Service model changes
docker-compose -f docker-compose.infrastructure.yml build tenpennynovels-embeddings --no-cache
docker-compose -f docker-compose.infrastructure.yml up -d tenpennynovels-embeddings
```

## 🚀 Future Enhancements

### 1. RAG (Retrieval-Augmented Generation)

Aggiungere LLM per generare risposte invece di solo trovare documenti:

```typescript
// Endpoint futuro: /api/documents/ask
POST /api/documents/ask
{
  "query": "Come posso creare un personaggio?"
}

// Response
{
  "answer": "Per creare un personaggio devi seguire questi passi...",
  "sources": [
    { "title": "Creazione Personaggio", "similarity": 0.95 },
    { "title": "Caratteristiche", "similarity": 0.78 }
  ]
}
```

**Opzioni**:
- **API Externa**: OpenAI GPT-4, Anthropic Claude (~$0.03 per 1K tokens)
- **Self-Hosted**: Ollama + Llama 3.1 (richiede GPU)

### 2. Vector Database Migration

Migrare da MongoDB con array a vector database specializzato:

- **Qdrant**: Vector database open-source
- **Pinecone**: Managed vector database
- **Milvus**: Scalable vector search

**Vantaggi**: Query più veloci, scaling orizzontale, filtering avanzato

### 3. Redis Streams

Sostituire pub/sub con Redis Streams per:
- **Guaranteed delivery**: Eventi non vanno persi
- **Replay capability**: Riprocessare eventi storici
- **Consumer groups**: Multiple workers in parallelo
- **Backpressure handling**: Controllo throughput

### 4. Batch Re-Processing

Script per riprocessare documenti esistenti:

```bash
# Regenerate embeddings for all documents
npm run embeddings:reprocess -- --type=documents

# Regenerate for specific type
npm run embeddings:reprocess -- --type=documents --filter=ambientazione
```

### 5. Monitoring & Metrics

Prometheus metrics:
- Embedding generation rate
- Queue depth
- Processing latency
- Error rate
- Model cache hit ratio

## 📝 Note Implementative

### Scelte Architetturali

1. **Perché async invece di sync?**
   - Zero impact su user experience
   - Scalabilità: worker può essere replicato
   - Resilienza: API funziona anche se embeddings service è down

2. **Perché modelli ridotti nel worker?**
   - Minimizza dipendenze Docker
   - Build più veloce
   - Worker non ha bisogno di business logic completa

3. **Perché Flask invece di Node.js per embeddings?**
   - Sentence Transformers è Python native
   - Ecosystem ML/AI più maturo in Python
   - Performance migliori con NumPy/PyTorch

4. **Perché truncate a 2000 caratteri?**
   - Modello ha limite 512 tokens (~2000 chars italiano)
   - Oltre quel limite, embedding quality decresce
   - Per documenti lunghi: chunking strategy futura

### Limitazioni Attuali

1. **Eventi Redis sono fire-and-forget**: Se worker è down, eventi vanno persi
2. **No retry logic**: Fallimenti richiedono re-processing manuale
3. **No chunking**: Documenti lunghi vengono troncati
4. **No vector search endpoints**: Solo preparazione infrastruttura

### Consistenza Dati

- Worker è idempotente: può riprocessare stesso documento
- MongoDB update è atomico: no race conditions
- Se embedding generation fallisce, documento rimane senza embedding
- Soluzione: batch script per trovare e riprocessare documenti mancanti

## 📚 Riferimenti

- **Documentazione Setup**: `docs/setup/embeddings-setup.md`
- **Development Guide**: [docs/setup/development-guide.md](../setup/development-guide.md) - Sezione "Embeddings & Semantic Search System"
- **Sentence Transformers**: https://www.sbert.net/
- **Model Card**: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
