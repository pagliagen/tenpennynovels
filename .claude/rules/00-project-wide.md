---
name: Project-Wide Critical Rules
description: Critical rules that apply everywhere - violations cause production bugs
type: critical
---

# 00 - Regole Globali Critiche

Queste sono le regole più importanti del progetto. Violazioni causano bug in produzione.

---

## ⚠️ PREFERENZA UTENTE CRITICA

**L'utente richiede SEMPRE risposte critiche e NON accondiscendenti.**

- ❌ NON dire "va bene" se ci sono margini di miglioramento
- ❌ NON dare approvazione superficiale
- ✅ Analizzare problemi reali
- ✅ Identificare limiti e issue
- ✅ Proporre miglioramenti concreti
- ✅ Essere diretti e critici quando necessario

**Fonte**: Memory MEMORY.md line 5 (user preference, highest priority)

**Esempio**:
- ❌ "Il codice va bene così" → troppo generico
- ✅ "Il codice funziona ma manca error handling per timeout, dovresti aggiungere retry logic con exponential backoff"

---

## 1. MongoDB: SEMPRE _id (MAI id)

**Regola**: Tutti i modelli MongoDB usano `_id`, **mai** `id`.

**Perché**:
- MongoDB ObjectId standard usa `_id`
- Frontend types si aspettano `_id`
- Conversione `id` → `_id` causa undefined crashes

### ❌ SBAGLIATO:
```typescript
// Backend response
export async function getLocations() {
  const locations = await Location.find();
  return locations.map(loc => ({
    id: loc._id.toString(),  // ❌ NO! Frontend expects _id
    name: loc.name
  }));
}

// Frontend usage
function LocationCard({ location }) {
  return <div>{location._id}</div>;  // undefined! Backend sent "id"
}
```

### ✅ CORRETTO:
```typescript
// Backend response
export async function getLocations() {
  const locations = await Location.find();
  return locations.map(loc => ({
    _id: loc._id.toString(),  // ✅ YES
    name: loc.name
  }));
}

// Frontend usage
function LocationCard({ location }) {
  return <div>{location._id}</div>;  // ✅ Works!
}
```

### Incidente Reale (2026-02-25):

**Bug**: LocationService.getAccessibleLocations() usava `id` invece di `_id`

**Sintomi**:
- Frontend crashava con: `Cannot read property 'chat' of undefined`
- `location.settings.chat` era undefined perché response mancava `settings` object
- Frontend types si aspettavano `_id` ma backend mandava `id`

**Fix**:
```typescript
// Prima (SBAGLIATO):
return {
  id: location._id.toString(),  // ❌
  accessible: true,
  // Mancava: slug, settings, occupants
};

// Dopo (CORRETTO):
return {
  _id: location._id.toString(),  // ✅
  slug: location.slug,
  settings: {
    visible: location.settings?.visible ?? true,
    chat: location.settings?.chat ?? true,
    shop: location.settings?.shop ?? false,
    private: location.settings?.private ?? false
  },
  hasShop: location.settings?.shop || false,
  hasChat: location.settings?.chat || false,
  isPrivate: location.settings?.private || false,
  occupants: []  // Prevent undefined errors
};
```

**File da Verificare**:
- Backend: All schemas in `services/unified-backend/src/database/models/`
  - UserSchema, CharacterSchema, LocationSchema, MessageSchema, MarketItemSchema
- Frontend: All types in `apps/*/src/types/api/`

### Come Verificare:

```bash
# Cerca usages di "id:" in backend responses
grep -r "id:" services/*/src/ --include="*.ts" | grep -v "_id"

# Cerca usages di ".id" in frontend (potenziali bug)
grep -r "\.id[^a-zA-Z_]" apps/*/src/ --include="*.ts" --include="*.tsx"
```

---

## 2. Logging: SEMPRE Winston (MAI console.log)

**Regola**: Usare Winston logger in production code, **mai** console.log.

**Perché**:
- Structured logging con timestamp, levels, context
- Configurabile (file, console, external services)
- Searchable e filterable
- Production-ready (rotation, formatting)

**Eccezioni Permesse**:
- Script di build (non production runtime)
- Script di migration one-time
- Debug locale temporaneo (committare solo con logger)

### ❌ SBAGLIATO:
```typescript
// services/unified-backend/src/modules/game/controllers/CharacterController.ts
export async function createCharacter(req, res) {
  console.log('Creating character', req.body);  // ❌ NO!

  try {
    const character = await Character.create(req.body);
    console.log('Character created:', character._id);  // ❌ NO!
    res.json({ success: true, data: character });
  } catch (error) {
    console.error('Error:', error);  // ❌ NO!
    res.status(500).json({ error: 'Internal error' });
  }
}
```

### ✅ CORRETTO:
```typescript
// Backend
import { logger } from '@shared/utils/logger';

export async function createCharacter(req, res) {
  logger.info('Creating character', {
    userId: req.user._id,
    characterName: req.body.name
  });

  try {
    const character = await Character.create(req.body);
    logger.info('Character created', {
      characterId: character._id,
      userId: req.user._id
    });
    res.json({ success: true, data: character });
  } catch (error) {
    logger.error('Character creation failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user._id,
      body: req.body
    });
    res.status(500).json({ error: 'Internal error' });
  }
}

// Frontend (game/management apps)
import { logger } from '@/lib/logger';

function LocationChat() {
  useEffect(() => {
    logger.debug('WebSocket connected', { locationId });

    return () => {
      logger.debug('WebSocket disconnected', { locationId });
    };
  }, [locationId]);
}
```

### Logger Levels:

| Level | When to Use | Examples |
|-------|-------------|----------|
| `error` | Errori che richiedono attenzione | Auth failures, DB connection errors, unhandled exceptions |
| `warn` | Situazioni anomale ma gestite | Retry attempts, deprecated API usage, missing optional fields |
| `info` | Eventi importanti | User login, character creation, API calls |
| `debug` | Dettagli per debugging | WebSocket events, state changes, function entry/exit |

### Incidente Reale (2026-03-03):

**Bug**: API Gateway aveva mix di console.log + logger

**File**: `services/api-gateway/src/app.ts`

**Problemi**:
- CORS logs con console.log → no timestamp, no context
- Proxy callbacks con console.log → non filterable
- HTTP access logs mancanti
- Errors con console.error → no structured data

**Fix**:
```typescript
// Prima (SBAGLIATO):
app.use(cors({
  origin: (origin, callback) => {
    console.log('CORS request from:', origin);  // ❌
    callback(null, true);
  }
}));

// Dopo (CORRETTO):
import { logger } from './utils/logger';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      logger.debug('CORS allowed', { origin });  // ✅
      callback(null, true);
    } else {
      logger.warn('CORS blocked', { origin });  // ✅
      callback(new Error('CORS not allowed'));
    }
  }
}));

// Added Morgan for HTTP access logs
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));
```

### Come Verificare:

```bash
# Cerca console.log in production code (esclude node_modules, scripts)
grep -r "console\\.log" services/*/src/ apps/*/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v "/scripts/"

# Cerca console.error
grep -r "console\\.error" services/*/src/ apps/*/src/ --include="*.ts" --include="*.tsx"
```

---

## 3. API Response Format Standard

**Regola**: Tutti gli endpoint backend seguono il format standardizzato.

**Perché**:
- Consistent error handling nel frontend
- Type-safe responses con Zod validation
- Request tracing con requestId
- Clear success/error distinction

### Success Response:
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T | T[];              // Single object o array
  message?: string;           // Optional success message
  requestId?: string;         // Request tracing
  timestamp: string;          // ISO 8601
}
```

### Error Response:
```typescript
interface ErrorResponse {
  success: false;
  error: string;              // Human-readable error (italiano)
  code: ErrorCode;            // Machine-readable (es. "INVALID_FORMAT")
  details?: object;           // Optional error context
  requestId?: string;
  timestamp: string;
}
```

### List Response:
```typescript
interface ListResponse<T> {
  success: true;
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
  timestamp: string;
}
```

### ✅ CORRETTO:
```typescript
// services/unified-backend/src/shared/utils/apiResponse.ts
import { v4 as uuidv4 } from 'uuid';

export function successResponse<T>(
  data: T | T[],
  message?: string,
  requestId?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    requestId: requestId || uuidv4(),
    timestamp: new Date().toISOString()
  };
}

export function errorResponse(
  error: string,
  code: ErrorCode,
  details?: object,
  statusCode: number = 500,
  requestId?: string
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    details,
    requestId: requestId || uuidv4(),
    timestamp: new Date().toISOString()
  };
}

// Usage in controller
export async function getCharacter(req: Request, res: Response) {
  try {
    const character = await Character.findById(req.params.id);

    if (!character) {
      return res.status(404).json(
        errorResponse(
          'Personaggio non trovato',
          'NOT_FOUND',
          { characterId: req.params.id }
        )
      );
    }

    res.json(successResponse(character, 'Personaggio recuperato'));
  } catch (error) {
    logger.error('Error fetching character', { error, characterId: req.params.id });
    res.status(500).json(
      errorResponse(
        'Errore nel recupero del personaggio',
        'INTERNAL_ERROR',
        { characterId: req.params.id }
      )
    );
  }
}
```

### Error Codes Standard:

```typescript
// services/unified-backend/src/shared/types/errors.ts
export enum ErrorCode {
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation errors
  INVALID_FORMAT = 'INVALID_FORMAT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_FIELD = 'MISSING_FIELD',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  DUPLICATE_KEY = 'DUPLICATE_KEY',

  // Business logic errors
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CHARACTER_BUSY = 'CHARACTER_BUSY',
  LOCATION_FULL = 'LOCATION_FULL',

  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}
```

**File di Riferimento**:
- `/services/unified-backend/src/shared/utils/apiResponse.ts`
- `/services/unified-backend/src/shared/types/errors.ts`

---

## 4. WebSocket: Single Reception Point

**Regola**: Componenti NON chiamano mai `socket.on()` direttamente.

**Perché**:
- Previene race conditions
- Previene memory leaks (cleanup automatico)
- Single source of truth per eventi
- Previene duplicate listeners
- Gestione centralizzata errori

**Architettura**:
```
Frontend API Call → Backend Logic → WebSocket Broadcast → WebSocketContext Reception → Component Subscription
```

### ❌ SBAGLIATO:
```typescript
// apps/game/src/components/chat/ChatPanel.tsx
import { socket } from '@/lib/websocket';

function ChatPanel() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // ❌ NO! Direct socket access
    socket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('user_typing', (data) => {
      setTypingUsers(prev => [...prev, data.userId]);
    });

    // ❌ Cleanup problematico (quale listener rimuovere?)
    return () => {
      socket.off('new_message');
      socket.off('user_typing');
    };
  }, []);

  // Altro componente fa stesso pattern → duplicate listeners!
}
```

### ✅ CORRETTO:
```typescript
// apps/game/src/components/chat/ChatPanel.tsx
import { useWebSocket } from '@/contexts/WebSocketContext';

function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const { onLocationEvent } = useWebSocket();  // ✅ Use context

  useEffect(() => {
    // ✅ YES! Single subscription point
    const unsubscribe = onLocationEvent((event) => {
      switch (event.type) {
        case 'new_message':
          setMessages(prev => [...prev, event.data]);
          break;
        case 'user_typing':
          setTypingUsers(prev => [...prev, event.data.userId]);
          break;
      }
    });

    // ✅ Cleanup automatico
    return unsubscribe;
  }, [onLocationEvent]);
}
```

### Implementazione WebSocketContext:

```typescript
// apps/game/src/contexts/WebSocketContext.tsx

/**
 * CRITICAL: Single point of reception for ALL WebSocket events.
 * Components subscribe to events via callback methods, never directly to socket.
 *
 * Pattern:
 * Frontend API → Backend Logic → WebSocket Broadcast → WebSocketContext → Components
 */

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }) {
  const socketRef = useRef<Socket | null>(null);
  const locationEventCallbacks = useRef<Set<(event: any) => void>>(new Set());

  useEffect(() => {
    const socket = io(WEBSOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    // Single listener registration
    socket.on('location_message_notification', (event) => {
      // Dispatch to all subscribed components
      locationEventCallbacks.current.forEach(callback => callback(event));
    });

    socket.on('player_entered', (event) => {
      locationEventCallbacks.current.forEach(callback => callback(event));
    });

    socket.on('player_left', (event) => {
      locationEventCallbacks.current.forEach(callback => callback(event));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const onLocationEvent = useCallback((callback: (event: any) => void) => {
    locationEventCallbacks.current.add(callback);

    // Return cleanup function
    return () => {
      locationEventCallbacks.current.delete(callback);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ onLocationEvent, /* ... */ }}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

### Event Types (backend emits):

```typescript
// Backend WebSocket events
socket.to(locationId).emit('location_message_notification', {
  type: 'new_message',
  data: message
});

socket.to(locationId).emit('player_entered', {
  type: 'player_entered',
  data: { characterId, characterName }
});

socket.emit('global_presence_update', {
  type: 'presence_update',
  data: presenceData
});
```

**File di Riferimento**:
- `/apps/game/src/contexts/WebSocketContext.tsx`
- `/services/unified-backend/src/modules/game/websocket/handlers.ts`

**Pattern Memory**: websocket-patterns.md (2026-03-01)

---

## 5. Optimistic Updates: NO invalidate in onSuccess

**Regola**: Per toggle operations, NON invalidare queries in `onSuccess` (causa race condition).

**Perché**:
- `onSuccess` + `invalidateQueries` trigger immediate refetch
- Refetch overwrites optimistic update → flicker
- Utente vede: stato corretto → stato vecchio → stato corretto
- Soluzione: Trust optimistic update, rollback solo su error

### ❌ SBAGLIATO (Race Condition):
```typescript
// apps/management/src/hooks/api/useDocuments.ts

export function useToggleDocumentVisibility() {
  return useMutation({
    mutationFn: ({ id, visible }) => documentsApi.updateVisibility(id, visible),

    onSuccess: () => {
      // ❌ NO! Immediate refetch overwrites optimistic update
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    }
  });
}

// Usage in component
function DocumentRow({ document }) {
  const { mutate: toggleVisibility } = useToggleDocumentVisibility();

  return (
    <button onClick={() => toggleVisibility({ id: document._id, visible: !document.visible })}>
      {/* User sees: visible → hidden → visible (flicker!) */}
      {document.visible ? 'Nascondi' : 'Mostra'}
    </button>
  );
}
```

### ✅ CORRETTO (Optimistic Update):
```typescript
// apps/management/src/hooks/api/useDocuments.ts

export function useToggleDocumentVisibility() {
  return useMutation({
    mutationFn: ({ id, visible }) => documentsApi.updateVisibility(id, visible),

    onMutate: async ({ id, visible }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(documentKeys.detail(id));

      // Optimistic update
      queryClient.setQueryData(documentKeys.detail(id), (old: any) => ({
        ...old,
        visible
      }));

      // Return rollback context
      return { previousData, id };
    },

    onError: (error, variables, context) => {
      // Rollback ONLY on error
      if (context) {
        queryClient.setQueryData(
          documentKeys.detail(context.id),
          context.previousData
        );
      }

      // Show error toast
      useUIStore.getState().addToast({
        type: 'error',
        message: 'Errore durante l\'aggiornamento'
      });
    }

    // NO onSuccess invalidation - trust optimistic update
  });
}
```

### Pattern generale:

```typescript
useMutation({
  mutationFn: async (data) => api.update(data),

  onMutate: async (data) => {
    // 1. Cancel refetches
    await queryClient.cancelQueries({ queryKey });

    // 2. Snapshot old value
    const previous = queryClient.getQueryData(queryKey);

    // 3. Optimistic update
    queryClient.setQueryData(queryKey, (old) => ({ ...old, ...data }));

    // 4. Return rollback context
    return { previous };
  },

  onError: (err, vars, context) => {
    // 5. Rollback ONLY on error
    if (context?.previous) {
      queryClient.setQueryData(queryKey, context.previous);
    }
  }

  // NO onSuccess, NO invalidateQueries here
});
```

### Incidente Reale (2026-03-01):

**Bug**: Toggle visibility/draft mostrava stato corretto brevemente poi revertiva (flicker)

**Causa**:
```typescript
// BUGGY CODE:
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
}
```

**Timeline**:
1. User clicks toggle → `visible: false` (optimistic)
2. API call completes → `onSuccess` fires
3. `invalidateQueries` triggers refetch
4. Refetch overwrites optimistic update → `visible: true` (old data from cache)
5. Refetch completes → `visible: false` (correct data)

**User sees**: false → true → false (flicker!)

**Fix**: Removed `onSuccess` invalidation, trust optimistic update

**Pattern Memory**: Toggle operations document in memory (2026-03-01)

---

## 6. Node Version: .nvmrc è Source of Truth

**Regola**: SEMPRE usare la versione Node da `.nvmrc`, mai assumere versione.

**File**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.nvmrc`
**Current**: `v22.13.1`

**Perché**:
- Consistent versions across dev/CI/prod
- npm packages potrebbero dipendere da features Node specifiche
- Build tools (esbuild, tsc) comportamento può variare
- Native modules (bcrypt, sharp) compiled per versione specifica

### ❌ SBAGLIATO:
```bash
# Assumere versione da package.json
node --version  # Potrebbe essere diversa da .nvmrc!

# Hardcodare versione
nvm use 20  # ❌ NO! Use .nvmrc

# Usare system default
node script.js  # ❌ Quale versione? Chi lo sa
```

### ✅ CORRETTO:
```bash
# Legge automaticamente da .nvmrc nella root
cd /Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels
nvm use  # ✅ Reads .nvmrc

# Verifica
node --version  # Output: v22.13.1

# In CI/CD (GitHub Actions, GitLab CI)
- uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'  # ✅ Use .nvmrc
```

### .nvmrc Content:
```
v22.13.1
```

### Come Verificare:

```bash
# Verifica versione corrente
cd /Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels
cat .nvmrc
node --version

# Se non match, switch
nvm use

# Verifica dopo switch
node --version  # Deve essere v22.13.1
```

### In Dockerfile:

```dockerfile
# ✅ CORRETTO - Match .nvmrc version
FROM node:22.13.1-alpine AS builder

# ❌ SBAGLIATO - Hardcoded different version
FROM node:20-alpine AS builder
```

**Incidente Reale** (Memory MEMORY.md):
- Versioni Node inconsistenti tra dev (v20), CI (v21), prod (v22)
- Build passava localmente ma falliva in prod
- npm packages installati per versione sbagliata
- Fix: .nvmrc aggiunto come single source of truth

---

## 7. Build Tools in Production Dependencies

**Regola**: Se un build tool è usato durante deployment startup, DEVE essere in `dependencies` (NON `devDependencies`).

**Perché**: `npm install --production` esclude `devDependencies`.

**Deployment flow**:
```
1. npm install --production  # Only dependencies
2. npm run build             # Uses build tools
3. npm start                 # Runs built code
```

Se build tool è in devDependencies → Step 2 fails!

### ❌ SBAGLIATO:
```json
// services/botai-backend/package.json
{
  "devDependencies": {
    "esbuild": "^0.20.2",  // ❌ NO se usato durante deployment!
    "@types/node": "^22.0.0"
  },
  "scripts": {
    "build": "esbuild src/index.ts --outdir=dist",
    "start": "node dist/index.js"
  }
}

// Deployment:
// npm install --production  → esbuild NOT installed
// npm run build  → ERROR: Cannot find package 'esbuild'
```

### ✅ CORRETTO:
```json
// services/botai-backend/package.json
{
  "dependencies": {
    "esbuild": "^0.20.2"  // ✅ YES - usato in npm run build
  },
  "devDependencies": {
    "@types/node": "^22.0.0",  // ✅ Solo types in dev
    "eslint": "^9.0.0",         // ✅ Solo lint in dev
    "prettier": "^3.0.0"        // ✅ Solo format in dev
  },
  "scripts": {
    "build": "esbuild src/index.ts --outdir=dist",
    "start": "node dist/index.js"
  }
}
```

### Regola per decidere dependencies vs devDependencies:

| Tool | dependencies | devDependencies | Ragione |
|------|--------------|-----------------|---------|
| `esbuild` | ✅ (se usato in build) | ❌ | Usato durante deployment build |
| `typescript` | ❌ | ✅ | Solo per development (tsc output committato o built) |
| `@types/*` | ❌ | ✅ | Solo type definitions |
| `eslint` | ❌ | ✅ | Solo linting (dev/CI) |
| `jest` | ❌ | ✅ | Solo testing (dev/CI) |
| `tsx` | ❌ | ✅ | Solo dev server hot reload |
| `express` | ✅ | ❌ | Runtime dependency |
| `mongoose` | ✅ | ❌ | Runtime dependency |

### Exception: tsc compilation

**Se usi `tsc` per build**:
```json
{
  "devDependencies": {
    "typescript": "^5.9.3"  // ✅ OK in devDeps
  },
  "scripts": {
    "build": "tsc",  // tsc globale o npx tsc
    "start": "node dist/index.js"
  }
}
```

**Perché OK**: `tsc` tipicamente installato globalmente o via npx, non richiesto a runtime.

**Ma se deployment usa local tsc**:
```json
{
  "dependencies": {
    "typescript": "^5.9.3"  // ✅ Needed if npm run build uses local tsc
  }
}
```

### Incidente Reale (2026-03-04):

**Bug**: botai-backend deployment failed

**Errore**: `Cannot find package 'esbuild' imported from .../build.mjs`

**Root Cause**:
- Build script `build.mjs` imports esbuild
- esbuild era in `devDependencies`
- CI build-check: `install-all.sh` → full `npm install` (includes devDependencies) → ✅ Passed
- Production deployment: `npm install --production` → excludes devDependencies → ❌ Failed

**Why esbuild needed**:
- TypeScript compiler (`tsc`) crashed with OOM (4GB+ heap exhaustion) on botai-backend
- esbuild è ~100x faster e memory-efficient (107ms build vs tsc crash)
- Attempted alignment with other backends (api-gateway, unified-backend use tsc) but failed

**Fix**: Spostato `esbuild` da devDependencies a dependencies

**Pattern**: Build tools used in deployment → dependencies. Alternative: remove `--production` flag but installs unnecessary devDeps in prod.

**File da Verificare**:
- `/services/*/package.json` - Check build scripts and dependencies

```bash
# Verifica build tools nelle dependencies
for dir in services/*/; do
  echo "=== $dir ==="
  cat "$dir/package.json" | jq '{
    build: .scripts.build,
    deps: .dependencies | keys,
    devDeps: .devDependencies | keys
  }'
done
```

---

## Cross-References

- **TypeScript strict mode**: Vedi [01-typescript.md](./01-typescript.md)
- **Node environment management**: Vedi [02-node-environment.md](./02-node-environment.md)
- **Logging implementation details**: Vedi [services/shared-backend.md](./services/shared-backend.md)
- **WebSocket implementation**: Vedi [apps/game-app.md](./apps/game-app.md)
- **Docker patterns**: Vedi [docker-deployment.md](./docker-deployment.md)

---

## Checklist Pre-Commit

Prima di committare codice, verifica:

- [ ] MongoDB: Usi `_id` (non `id`) in tutti i responses?
- [ ] Logging: Usi Winston logger (non console.log) in production code?
- [ ] API responses: Segui format standard (success/error/data)?
- [ ] WebSocket: Usi WebSocketContext (non socket.on() diretto)?
- [ ] Optimistic updates: NO invalidate in onSuccess per toggle?
- [ ] Node version: Verificato con `nvm use`?
- [ ] Dependencies: Build tools in dependencies se usati in deployment?
