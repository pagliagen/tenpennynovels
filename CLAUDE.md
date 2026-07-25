# TenpennyNovels - Istruzioni per Claude

## ⚠️ Preferenze Utente Critiche

**L'utente richiede SEMPRE risposte critiche e NON accondiscendenti.**

- ❌ NON dire "va bene" se ci sono margini di miglioramento
- ✅ Analizzare problemi reali
- ✅ Identificare limiti e issue
- ✅ Proporre miglioramenti concreti

---

## Architettura Progetto

TenpennyNovels è un monorepo TypeScript/Node.js per un gioco di ruolo vittoriano multiplayer con AI.

### Struttura:
```
tenpennynovels/
├── apps/                 # 4 Frontend Next.js apps
│   ├── landing/         # Auth & character selection (port 4000)
│   ├── game/            # Main gameplay UI (port 4001)
│   ├── documents/       # Knowledge base (port 4002)
│   └── management/      # Admin panel (port 4003)
├── services/            # 3 Backend services
│   ├── api-gateway/     # Reverse proxy (port 8000)
│   ├── unified-backend/ # Main backend (port 3001)
│   └── embeddings-worker/ # Vector embeddings + Q&A RAG "Bibliotecario" (port 5001)
└── local-ai/            # 2 AI services
    ├── services/botai/  # Character AI (port 8080)
    └── services/character-gen/ # Character generation (port 8130)
```

### Stack Tecnologico:
- **Frontend**: Next.js 16 (Pages Router), React 18, TypeScript, Zustand, React Query, Socket.IO client
- **Backend**: Express (v5 in api-gateway/unified-backend, v4 in embeddings-worker/local-ai), TypeScript, MongoDB, Redis, Socket.IO server, Bull queues
- **AI**: Ollama (LLM locale, dual-model creativo/analitico), Qdrant (vector DB), embeddings multilingua
- **Infrastructure**: Docker Compose, PM2, Nginx, Ubuntu VPS
- **Node**: v24.18.0 (`.nvmrc` è source of truth)

---

## Sistema Rules

Questo progetto usa un sistema modulare di regole in `.claude/rules/` per prevenire errori ricorrenti e standardizzare i pattern.

### 📋 Regole Globali (leggi SEMPRE per qualsiasi task):

1. **[00-project-wide.md](.claude/rules/00-project-wide.md)** - Regole critiche
   - MongoDB: SEMPRE `_id` (MAI `id`)
   - Logging: Winston logger (MAI console.log in production)
   - WebSocket: Single reception point (WebSocketContext)
   - Optimistic updates: NO invalidate in onSuccess
   - Build tools: In dependencies se usati nel deployment

2. **[01-typescript.md](.claude/rules/01-typescript.md)** - Standard TypeScript
   - Strict mode enabled
   - Zod per runtime validation
   - Path aliases (@/, @/components/, @shared/, @modules/)
   - No `any` types senza giustificazione

3. **[02-node-environment.md](.claude/rules/02-node-environment.md)** - Node & npm
   - Node v24.18.0 da `.nvmrc`
   - npm ci per CI/CD, npm install per local
   - Production vs dev dependencies

4. **[03-git-workflow.md](.claude/rules/03-git-workflow.md)** - Git patterns
   - Commit conventions
   - Branch naming
   - Pre-commit hook handling

5. **[04-ci-cd.md](.claude/rules/04-ci-cd.md)** - CI/CD & GitHub Actions
   - Deploy in produzione SOLO da master (develop = solo build-check, non deploya mai)
   - Smart dependency installation (hash-based)
   - PM2 restart pattern
   - Health checks with retry

6. **[docker-deployment.md](.claude/rules/docker-deployment.md)** - Docker
   - Multi-stage builds
   - `docker compose stop + up -d` dopo build (NON restart)
   - Health checks

---

### 🎨 Frontend Rules (apps/*)

**Leggi quando lavori su frontend:**

- **[apps/README.md](.claude/rules/apps/README.md)** - Overview architettura frontend
- **[apps/shared-frontend.md](.claude/rules/apps/shared-frontend.md)** - Pattern comuni
  - Next.js Pages Router, React Query, Zustand, SCSS modules

**Per app specifiche:**

- **[apps/game-app.md](.claude/rules/apps/game-app.md)** - Game app (più complesso)
  - WebSocket via WebSocketContext (CRITICAL)
  - Optimistic updates senza invalidation
  - Zustand stores: authStore, gameStateStore, chatStore, uiStore
  - Session management

- **[apps/management-app.md](.claude/rules/apps/management-app.md)** - Admin panel
  - TipTap editor
  - CRUD patterns con audit
  - react-hook-form + Zod

- **[apps/documents-app.md](.claude/rules/apps/documents-app.md)** - Knowledge base
  - SSR patterns
  - Semantic search

- **[apps/landing-app.md](.claude/rules/apps/landing-app.md)** - Authentication
  - Fetch API (non Axios)
  - Victorian theme

---

### ⚙️ Backend Rules (services/*)

**Leggi quando lavori su backend:**

- **[services/README.md](.claude/rules/services/README.md)** - Overview architettura backend
- **[services/shared-backend.md](.claude/rules/services/shared-backend.md)** - Pattern comuni
  - Winston logger (CRITICAL - mai console.log)
  - API response format standard
  - MongoDB `_id` usage
  - Express-validator patterns

**Per service specifici:**

- **[services/unified-backend.md](.claude/rules/services/unified-backend.md)** - Main backend
  - Module structure (auth, game, admin, documents, forum)
  - Controller/Service pattern
  - WebSocket handlers
  - Redis pub/sub
  - SessionStore

- **[services/api-gateway.md](.claude/rules/services/api-gateway.md)** - Gateway
  - Reverse proxy config
  - Rate limiting per-path
  - CORS & security headers

- **[services/embeddings-worker.md](.claude/rules/services/embeddings-worker.md)** - Vector worker
  - Bull queue
  - Qdrant integration (UUID format)
  - Retry policies

---

### 🤖 AI Services Rules (local-ai/*)

**Leggi quando lavori su AI services:**

- **[local-ai/README.md](.claude/rules/local-ai/README.md)** - Overview AI services
- **[local-ai/shared-patterns.md](.claude/rules/local-ai/shared-patterns.md)** - Pattern comuni
  - p-queue sequential processing
  - Callback patterns con retry
  - Ollama dual-model (creativo/analitico) + Inception agent
  - Docker multi-stage builds

---

## Quick Reference

### File Paths Critici:
- **Node version**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.nvmrc`
- **Memory**: `/Users/gennaropaglia/.claude/projects/-Users-gennaropaglia-Documents-SitiPersonali-tenpennynovels/memory/`
- **Rules**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/`

### Porte Servizi:

**Frontend:**
- Landing: `4000`
- Game: `4001`
- Documents: `4002`
- Management: `4003`

**Backend:**
- API Gateway: `8000`
- Unified Backend: `3001`
- Embeddings Worker: `5001`

**AI Services:**
- BotAI: `8080`
- Character-Gen: `8130`
- AI Gateway: `9000`

### Database & Infrastructure:
- MongoDB: `27017` (production), `27030` (local-ai)
- Redis: `6379`
- Qdrant: `6333`

---

## Pattern Critici (SEMPRE rispettare)

### 1. ✅ MongoDB: Usa `_id` (NON `id`)
```typescript
// ✅ CORRETTO
return { _id: user._id.toString(), name: user.name };

// ❌ SBAGLIATO
return { id: user._id.toString(), name: user.name };
```

### 2. ✅ Logging: Winston (NON console.log)
```typescript
// ✅ CORRETTO
import { logger } from '@shared/utils/logger';
logger.info('User logged in', { userId });

// ❌ SBAGLIATO
console.log('User logged in', userId);
```

### 3. ✅ WebSocket: WebSocketContext (NON socket.on() diretto)
```typescript
// ✅ CORRETTO
const { onLocationEvent } = useWebSocket();
useEffect(() => {
  const unsubscribe = onLocationEvent((event) => { /* ... */ });
  return unsubscribe;
}, []);

// ❌ SBAGLIATO
socket.on('new_message', (msg) => { /* ... */ });
```

### 4. ✅ Optimistic Updates: NO invalidate in onSuccess
```typescript
// ✅ CORRETTO
useMutation({
  mutationFn: updateData,
  onMutate: async () => {
    // Optimistic update
    queryClient.setQueryData(key, newData);
    return { previousData };
  },
  onError: (err, vars, context) => {
    // Rollback on error
    queryClient.setQueryData(key, context.previousData);
  }
  // NO onSuccess invalidation
});

// ❌ SBAGLIATO (causa race condition)
useMutation({
  mutationFn: updateData,
  onSuccess: () => {
    queryClient.invalidateQueries(key); // ❌ NO!
  }
});
```

### 5. ✅ Docker: stop + up dopo build
```bash
# ✅ CORRETTO
docker compose stop unified-backend
docker compose build unified-backend
docker compose up -d unified-backend

# ❌ SBAGLIATO (non carica nuova build)
docker compose restart unified-backend
```

### 6. ✅ Build Tools: Dependencies se usati in production
```json
// ✅ CORRETTO se esbuild usato durante deployment
{
  "dependencies": {
    "esbuild": "^0.20.2"
  }
}

// ❌ SBAGLIATO (deployment con --production fallisce)
{
  "devDependencies": {
    "esbuild": "^0.20.2"
  }
}
```

---

## Come Usare Questo Sistema

### Per un nuovo task:

1. **Leggi sempre**: [00-project-wide.md](.claude/rules/00-project-wide.md) (regole critiche)

2. **Identifica l'area**:
   - Frontend? → Leggi `apps/shared-frontend.md` + app-specific rules
   - Backend? → Leggi `services/shared-backend.md` + service-specific rules
   - AI? → Leggi `local-ai/shared-patterns.md`
   - Docker? → Leggi `docker-deployment.md`

3. **Verifica pattern specifici** nei file dell'area

4. **Riferisci file concreti** dal codebase per esempi

### Per un bug fix:

1. Verifica se il bug è un **pattern ricorrente** in [00-project-wide.md](.claude/rules/00-project-wide.md)
2. Controlla la sezione "Incidenti Reali" nelle rules per pattern simili
3. Applica il fix seguendo gli esempi ✅ CORRETTO
4. Verifica che non violi altre regole critiche

---

## Maintenance

Quando aggiungi/modifichi codice:

1. **Verifica conformità** con le regole prima di proporre modifiche
2. **Usa esempi concreti** dal codebase per validare pattern
3. **Aggiorna le rules** se scopri nuovi anti-pattern ricorrenti
4. **Cross-reference** tra file rules quando appropriato

---

## Emergency Contacts & Resources

- **Bug ricorrenti**: Vedi memory in `~/.claude/projects/.../memory/`
- **Incidenti passati**: Documentati in MEMORY.md con date
- **Architecture decisions**: Documentati nei file rules con "Perché" section
