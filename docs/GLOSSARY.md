# Glossary

**Navigation**: [Home](./INDEX.md) > Glossary

**Status**: ✅ Reference | **Last Updated**: 2026-03-01

Terminologia Victorian e tecnica usata nel progetto TenPennyNovels.

---

## Victorian Terminology

### Appellatives & Social Conventions

**Master** / **Mistress**
- Appellativo formale per personaggi di alto status sociale
- Utilizzato in dialoghi bot AI per mantenere l'ambientazione
- Esempio: "Good evening, Master Smith"

**Esquire** (Esq.)
- Titolo onorifico per gentiluomini
- Usato in corrispondenza formale
- Esempio: "John Smith, Esq."

**Guillemets** (« »)
- Virgolette francesi usate nei dialoghi Victorian
- Standard nei testi bot AI
- Esempio: « I shall consider your proposal, sir »

**Victorian Narrative Style**
- Tono formale e letterario
- Riferimenti a Agatha Christie, Arthur Conan Doyle
- Evitare modernismi e slang contemporaneo

---

## Game System Terminology

### Call of Cthulhu d100 System

**d100**
- Sistema di gioco basato su percentili (1-100)
- Skill checks: roll under skill value to succeed
- Critical success: ≤5, Critical failure: ≥96

**Characteristics / Stats**
- STR (Strength), CON (Constitution), DEX (Dexterity)
- INT (Intelligence), POW (Power), APP (Appearance)
- EDU (Education), SIZ (Size)
- Valori base: 40-90, totale disponibile: ~400 punti

**Skills**
- Abilità specialistiche (Archaeology, Medicine, Persuade, etc.)
- Skill cap durante creation: 75 (finale: 80 post-approval)
- Bonus skills da occupation

**Occupation**
- Professione del personaggio (Detective, Physician, Artist, etc.)
- 55 occupazioni disponibili in ambientazione Victorian
- Determina bonus skills e credit rating

**Experience Points (XP)**
- Punti esperienza per avanzamento personaggio
- Daily XP: 2 punti base giornalieri
- Skill advancement via sessioni di gioco

**Credit Rating**
- Indicatore di ricchezza e status sociale
- Range: 0-99
- Influenza interazioni sociali e access a locations

---

## Technical Terminology

### Backend Architecture

**Unified Backend**
- Backend monolitico modulare (port 3001)
- 5 moduli: auth, game, admin, forum, documents
- Consolidamento di auth-backend, game-backend, management-backend

**API Gateway**
- Single entry point per tutte le richieste (port 8000)
- Proxy routing verso unified-backend
- WebSocket upgrade handling
- CORS e rate limiting

**Middleware**
- Funzioni intermedie per auth, validation, logging
- Dual-token JWT: auth_token + character_context
- Character session manager per unicità sessione

**Redis Pub/Sub**
- Sistema publish/subscribe per eventi inter-service
- Channels: CHARACTER_EVENTS, LOCATION_EVENTS, EMBEDDING_EVENTS
- Event-driven architecture

**WebSocket**
- Comunicazione real-time bi-direzionale (Socket.IO 4.8.3)
- Room-based broadcasting (location_{id}, user_{id}, character_{id})
- **CRITICAL**: No direct socket.on/emit in components

---

### Database & Persistence

**MongoDB**
- Database NoSQL document-oriented (v7.0)
- 44+ schemas (User, Character, Location, Document, etc.)
- Mongoose 9.2.1 ORM

**Schema**
- Struttura dati MongoDB definita via Mongoose
- Esempi: UserSchema, CharacterSchema, LocationSchema
- Indexes per performance (compound, unique, sparse)

**_id**
- Primary key MongoDB (ObjectId, 24 hex chars)
- **Standard progetto**: Sempre `_id` (non `id`)
- Conversione toString() per JSON responses

**Embedding** (MongoDB)
- Array di 384 float (contentEmbedding field)
- Vector representation per semantic search
- Generato via embeddings-service

---

### AI & Machine Learning

**Embeddings**
- Vector representation di testo (384 dimensioni)
- Model: paraphrase-multilingual-MiniLM-L12-v2
- Usato per semantic search

**Vector Database**
- Qdrant (port 6333) per Approximate Nearest Neighbor (ANN) search
- Collections: documents, document_chunks
- Point ID: UUID string (non ObjectId)

**Semantic Search**
- Ricerca per significato (non keyword)
- Dual-level: L1 (full text) + L2 (vector similarity)
- Threshold cosine similarity: >0.7

**Qdrant Point**
- Record in vector database
- Structure: { id: UUID, vector: float[], payload: {} }

**Cosine Similarity**
- Metrica distanza tra vectors (range: -1 to 1)
- >0.7 = molto simile, <0.3 = dissimile

---

### Bot AI System

**Psychology Axes**
- 6 assi psicologici (-3 to +3):
  - Rational/Emotional
  - Controlled/Impulsive
  - Cynical/Idealist
  - Proud/Submissive
  - Prudent/Paranoid
  - Direct/Allusive

**Central Wound**
- Ferita psicologica profonda che guida comportamento bot
- Trigger emotivi e difese psicologiche
- Deve essere visibile nelle risposte bot

**Duality System**
- Maschera pubblica vs verità privata
- Trust levels (0-100) determinano rivelazione:
  - <30: Maschera rigida
  - 30-60: Primi hints
  - 60-80: Maschera scivola
  - 80+: Rivelazione completa

**Relationship Archetype**
- Tipo di relazione bot-character: mentor, rival, romantic, suspicious
- Influenza tone e content interazioni

**Sentiment Analysis**
- Analisi tono emotivo delle interazioni
- Score: -1 (negative) to +1 (positive)
- Stored in BotMemory collection

---

### Game Systems

**Location**
- Ambiente di gioco (district, building, room)
- Hierarchical: root > district > location
- Settings: { visible, chat, shop, private }

**Occupants**
- Lista characters attualmente in una location
- Real-time tracking via WebSocket
- Cleanup automatico on disconnect

**Turn-Based System**
- Sistema turni per sessioni di gioco
- Master avanza turni manualmente
- Turn order tracking

**Master**
- Game Master / Dungeon Master
- Ruolo speciale con permessi elevated
- Gestisce sessioni, outcomes, turn order

**Session**
- Partita di gioco organizzata
- Template-based (investigation, social, combat)
- XP grant al termine

**Corporation**
- Organizzazione in-game (company, club, secret society)
- Membership, treasury, properties
- Integration con housing system

**Housing Property**
- Proprietà immobiliare (rent o purchase)
- Automated rent collection (cron daily 6am)
- Eviction dopo 14+ giorni overdue

---

### Frontend Architecture

**Next.js**
- React framework per SSR/SSG (v16.1.6)
- File-based routing
- 4 app separate: landing, game, documents, management

**Zustand**
- Lightweight state management (v5.0.3)
- Alternative a Redux
- Usato in game e management apps

**TanStack Query**
- Data fetching e caching library (v5.62.11)
- Formerly React Query
- Server state management

**WebSocketContext**
- React Context per WebSocket connection
- Subscription methods: subscribeToLocation, subscribeToCharacter
- **CRITICAL**: No direct socket access

**Optimistic Update**
- UI update immediato prima di API response
- Rollback automatico on error
- Pattern usato in GameContext (joinLocation, leaveLocation)

---

### Development & Operations

**Docker Compose**
- Orchestrazione multi-container (7 services)
- docker-compose.yml configuration
- Hot-reload volumes per development

**Health Check**
- Endpoint /health per service status
- Liveness e readiness probes
- Used in Docker depends_on conditions

**Bull Queue**
- Redis-backed job queue per async processing
- Worker concurrency: 5 jobs
- Retry strategy: 3 attempts, exponential backoff

**Hot-Reload**
- Auto-restart on code changes
- Volume mounts: src:ro, node_modules
- Development-only feature

**Cron Job**
- Scheduled tasks (dailyExperience, rentCollection)
- Node-cron syntax
- Timezone-aware (Europe/Rome)

---

### Common Acronyms

- **API**: Application Programming Interface
- **ANN**: Approximate Nearest Neighbor (vector search)
- **CORS**: Cross-Origin Resource Sharing
- **JWT**: JSON Web Token (authentication)
- **ORM**: Object-Relational Mapping (Mongoose)
- **SSR**: Server-Side Rendering (Next.js)
- **SSG**: Static Site Generation (Next.js)
- **XP**: Experience Points
- **NPC**: Non-Player Character (bot)
- **CoC**: Call of Cthulhu (game system)
- **d100**: Percentile dice system (1-100)

---

## Related Documentation

- [Getting Started](./00-getting-started/README.md) - Onboarding guide
- [Call of Cthulhu Rules](./08-reference/call-of-cthulhu-rules.md) - Game system details
- [BotAI Psychology](./04-ai-ml/botai-psychology.md) - Bot AI terminology
- [Embeddings Architecture](./04-ai-ml/embeddings-architecture.md) - ML terminology
