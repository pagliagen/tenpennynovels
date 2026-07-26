# Character-Gen — Piano di implementazione: generazione asincrona con cancel-and-replace + SSE

> Documento di specifica per l'implementazione. Seguire alla lettera.
> Autore design: sessione Opus. Implementatore: sessione successiva.
> Servizio: `local-ai/services/character-gen` (porta 8130).

---

## 0. Obiettivo

Trasformare `/generate` da chiamata sincrona (SSE diretta) a un pattern **job asincrono con cancel-and-replace**:

1. `POST /generate` avvia una generazione e ritorna **subito** un `generationId` (NON streama).
2. `GET /status/:sessionKey` è l'endpoint **SSE** che streama l'avanzamento.
3. Se l'utente reinvia con una nuova descrizione (stesso `sessionKey`), la generazione in corso viene **abortita davvero** (interrotta a metà, non "scartata a fine job") e ne parte una nuova.
4. Il refresh della pagina non perde nulla: il client si riconnette a `GET /status/:sessionKey` e rivede lo stato corrente.

### Requisiti hard (non negoziabili)
- **Abort interruttivo**: l'abort deve fermare la pipeline entro lo step corrente (~5-15s), NON far finire tutti i ~10 step. Con concorrenza 1, "scartare a fine job" farebbe aspettare l'utente ~2 minuti → inaccettabile.
- **Budget esatti**: la somma dei punti caratteristiche = `statsBudget` ESATTO; la somma dei punti skill = `skillsBudget` ESATTO. Se non torna, fallire loud (throw).
- **In-memory, NO Redis**: il servizio è single-instance. Usare `Map` in memoria + cleanup a timer.

---

## 1. Modello concettuale

### Chiavi
- **`sessionKey`** (string, UUID): generato dal **client** quando apre il modale di creazione, persistito lato client in `sessionStorage`. È la **chiave primaria** di tutto. Una sessione = al più UNA generazione attiva. Risolve sia cancel-replace sia refresh-recovery.
- **`generationId`** (number, incrementale per sessione): identifica la singola run dentro una sessione. Va incluso in **ogni** evento SSE. Il client scarta eventi con `generationId` più vecchio dell'ultimo visto (protezione da eventi "stale" in volo durante un abort).

### Due livelli di concorrenza (coesistono)
- **Cross-sessione**: coda FIFO globale con **concorrenza 1** (Ollama self-hosted, non sovraccaricarlo). NON usare `p-queue` (non è tra le dipendenze) — implementare una mini-coda interna.
- **Per-sessione**: cancel-and-replace. Un nuovo `submit` sulla stessa `sessionKey` aborta la run precedente (in coda o in esecuzione) e la rimpiazza.

---

## 2. File da creare / modificare

| File | Azione |
|------|--------|
| `src/GenerationManager.ts` | **NUOVO** — orchestratore: sessioni, coda, abort, SSE fan-out |
| `src/CharacterGenerator.ts` | **MODIFICA** — rendere la pipeline abortibile (accetta `AbortSignal` + `emit`), threading del signal fino a Ollama |
| `src/routes.ts` | **MODIFICA** — `POST /generate` → `manager.submit`; nuovo `GET /status/:sessionKey` → `manager.subscribe` |
| `src/types.ts` | **MODIFICA** — aggiungere `sessionKey` all'input, tipi eventi/sessione |
| `src/SkillAllocator.ts` | **VERIFICA** — `normalizeSumTo` già aggiunto (budget esatto). Confermare. |
| `src/StatAllocator.ts` | **VERIFICA** — `normalizeSumTo` già presente. Confermare. |

Nessuna nuova dipendenza npm. Usare solo `http`/`https` nativi, `express` già presente, e `AbortController` (built-in Node 22).

---

## 3. Tipi (`src/types.ts`)

Aggiungere/aggiornare:

```typescript
export interface CharacterGenInput {
  requestId: string;         // mantenuto per compat/log; NON è la chiave
  sessionKey: string;        // NUOVO — chiave primaria (client-generated UUID)
  description: string;       // required
  firstName?: string;        // opzionale — se assente, generato dall'LLM
  lastName?: string;         // opzionale — se assente, generato dall'LLM
  gender?: 'male' | 'female' | 'other';
}

// Evento SSE bufferabile
export interface GenEvent {
  generationId: number;
  type: 'state' | 'step' | 'restarted' | 'complete' | 'error' | 'aborted';
  data: any;
}

export type GenStatus = 'queued' | 'processing' | 'complete' | 'error' | 'aborted';
```

`GeneratedStats`, `GeneratedBackground`, `CharacterGenResult` restano invariati.

---

## 4. `GenerationManager.ts` (NUOVO)

Cuore del sistema. Una singola istanza esportata (singleton), usata da `routes.ts`.

### 4.1 Stato interno

```typescript
import { Response } from 'express';
import { CharacterGenInput, GenEvent, GenStatus, CharacterGenResult } from './types';
import { CharacterGenerator } from './CharacterGenerator';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('GenerationManager');

const SESSION_TTL_MS = 60 * 60 * 1000; // 1h
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5min
const SSE_PING_INTERVAL_MS = 15 * 1000; // keep-alive

interface SessionState {
  sessionKey: string;
  currentGenerationId: number;
  input: CharacterGenInput;
  gameConfig: any;                 // preso dal chiamante (vedi §7 gameConfig)
  status: GenStatus;
  events: GenEvent[];              // buffer per replay al (ri)connect
  result?: CharacterGenResult;
  error?: string;
  abortController: AbortController; // uno per generazione corrente
  subscribers: Set<Response>;
  createdAt: number;
  updatedAt: number;
}

export class GenerationManager {
  private sessions = new Map<string, SessionState>();
  private queue: string[] = [];        // FIFO di sessionKey in attesa
  private running: string | null = null;
  private generator = new CharacterGenerator();

  constructor() {
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS).unref();
  }
```

### 4.2 `submit()` — avvia o rimpiazza

```typescript
  submit(input: CharacterGenInput, gameConfig: any): { generationId: number } {
    const key = input.sessionKey;
    const existing = this.sessions.get(key);

    if (existing) {
      // Cancel-and-replace: aborta la run precedente
      this.abortSession(existing, 'replaced');
      // rimuovi da coda se era in attesa (verrà ri-accodata sotto)
      this.queue = this.queue.filter(k => k !== key);

      const newGenId = existing.currentGenerationId + 1;
      existing.currentGenerationId = newGenId;
      existing.input = input;
      existing.gameConfig = gameConfig;
      existing.status = 'queued';
      existing.events = [];              // buffer nuovo per la nuova run
      existing.result = undefined;
      existing.error = undefined;
      existing.abortController = new AbortController();
      existing.updatedAt = Date.now();
      // avvisa i client già connessi che si riparte
      this.emit(existing, { generationId: newGenId, type: 'restarted', data: { generationId: newGenId } });
      this.enqueue(key);
      return { generationId: newGenId };
    }

    const state: SessionState = {
      sessionKey: key,
      currentGenerationId: 1,
      input,
      gameConfig,
      status: 'queued',
      events: [],
      abortController: new AbortController(),
      subscribers: new Set(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(key, state);
    this.enqueue(key);
    return { generationId: 1 };
  }
```

### 4.3 Coda + processing

```typescript
  private enqueue(key: string) {
    if (!this.queue.includes(key) && this.running !== key) {
      this.queue.push(key);
    }
    this.processNext();
  }

  private processNext() {
    if (this.running) return;               // concorrenza 1
    const key = this.queue.shift();
    if (!key) return;
    const state = this.sessions.get(key);
    if (!state) { this.processNext(); return; }
    // se è stata abortita mentre era in coda, salta
    if (state.status === 'aborted') { this.processNext(); return; }

    this.running = key;
    state.status = 'processing';
    state.updatedAt = Date.now();
    const genId = state.currentGenerationId;
    const signal = state.abortController.signal;

    this.generator
      .run(
        state.input,
        state.gameConfig,
        signal,
        (type, data) => this.emit(state, { generationId: genId, type: type as any, data }),
      )
      .then((result) => {
        // ignora se nel frattempo la run è stata rimpiazzata
        if (state.currentGenerationId !== genId) return;
        state.status = 'complete';
        state.result = result;
        state.updatedAt = Date.now();
        this.emit(state, { generationId: genId, type: 'complete', data: { ...result } });
      })
      .catch((err) => {
        if (isAbortError(err)) {
          // abort: NON emettere error/complete; 'aborted' già emesso da abortSession
          logger.info(`Generation aborted: session=${key} gen=${genId}`);
          return;
        }
        if (state.currentGenerationId !== genId) return;
        state.status = 'error';
        state.error = err.message;
        state.updatedAt = Date.now();
        this.emit(state, { generationId: genId, type: 'error', data: { error: err.message, code: 'GENERATION_ERROR' } });
      })
      .finally(() => {
        this.running = null;
        this.processNext();
      });
  }
```

### 4.4 Abort

```typescript
  private abortSession(state: SessionState, reason: string) {
    if (state.status === 'processing' || state.status === 'queued') {
      const genId = state.currentGenerationId;
      state.abortController.abort();
      state.status = 'aborted';
      state.updatedAt = Date.now();
      this.emit(state, { generationId: genId, type: 'aborted', data: { reason } });
    }
  }
```

Nota: se la sessione era `running`, l'abort fa fallire la pipeline con AbortError; il `.finally()` libera `this.running` e chiama `processNext()`, che poi pesca la sessionKey ri-accodata da `submit()` per la nuova run.

### 4.5 SSE: subscribe / emit / unsubscribe

```typescript
  // Ritorna false se la sessione non esiste (il chiamante manda 404 PRIMA di aprire l'SSE)
  subscribe(sessionKey: string, res: Response): boolean {
    const state = this.sessions.get(sessionKey);
    if (!state) return false;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evita buffering nginx
    res.flushHeaders?.();

    // snapshot iniziale
    this.writeEvent(res, {
      generationId: state.currentGenerationId,
      type: 'state',
      data: { status: state.status, currentGenerationId: state.currentGenerationId, stepsBuffered: state.events.length },
    });
    // replay del buffer
    for (const ev of state.events) this.writeEvent(res, ev);

    state.subscribers.add(res);

    // keep-alive ping
    const ping = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { /* noop */ }
    }, SSE_PING_INTERVAL_MS);

    res.on('close', () => {
      clearInterval(ping);
      state.subscribers.delete(res);
    });

    return true;
  }

  private emit(state: SessionState, ev: GenEvent) {
    state.events.push(ev);
    for (const res of state.subscribers) this.writeEvent(res, ev);
  }

  private writeEvent(res: Response, ev: GenEvent) {
    try {
      res.write(`event: ${ev.type}\n`);
      res.write(`data: ${JSON.stringify({ generationId: ev.generationId, ...ev.data })}\n\n`);
    } catch { /* client disconnesso */ }
  }
```

### 4.6 Cleanup

```typescript
  private cleanup() {
    const now = Date.now();
    for (const [key, state] of this.sessions) {
      const terminal = state.status === 'complete' || state.status === 'error' || state.status === 'aborted';
      if (terminal && state.subscribers.size === 0 && now - state.updatedAt > SESSION_TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }
}

export const generationManager = new GenerationManager();
```

### 4.7 Helper AbortError (in cima al file o in un util condiviso)

```typescript
export function makeAbortError(): Error {
  const e = new Error('ABORTED');
  e.name = 'AbortError';
  return e;
}
export function isAbortError(err: any): boolean {
  return err?.name === 'AbortError' || err?.code === 'ABORT_ERR';
}
```

---

## 5. `CharacterGenerator.ts` — rendere la pipeline abortibile

### 5.1 Nuova firma pubblica

Sostituire `generateWithSSE(input, gameConfig, sendEvent)` con:

```typescript
async run(
  input: CharacterGenInput,
  gameConfig: any,
  signal: AbortSignal,
  emit: (type: string, data: any) => void,
): Promise<CharacterGenResult>
```

- Rimuovere il vecchio `generate()` e `generateWithSSE()` (o farli chiamare `run` con un signal mai abortito, ma preferibile rimuoverli per non lasciare codice morto).
- La logica dei 7 step resta identica a quella attuale, con TRE aggiunte:
  1. `checkAbort(signal)` **prima di ogni step** e **dentro il loop delle background sections** (prima di ogni sezione).
  2. Passare `signal` a `this.llmRequest(...)` → `ollamaRequest(...)` / `inceptionRequest(...)`.
  3. Sostituire ogni `sendEvent(...)` con `emit(...)` (stessa semantica; il `generationId` lo aggiunge il manager).

```typescript
function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw makeAbortError();
}
```

### 5.2 Threading del signal fino a Ollama

`llmRequest`:
```typescript
private async llmRequest(system: string, user: string, maxTokens: number, temperature: number, signal: AbortSignal): Promise<LLMResponse> {
  if (this.provider === 'inception') {
    return inceptionRequest(this.apiKey, this.model, { /* body */ }, signal);
  }
  return ollamaRequest(this.ollamaHost, this.model, system, user, maxTokens, temperature, signal);
}
```

`ollamaRequest` — aggiungere parametro `signal` e passarlo a `http.request`:
```typescript
function ollamaRequest(host, model, systemPrompt, userMessage, maxTokens, temperature, signal: AbortSignal): Promise<LLMResponse> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(makeAbortError()); return; }
    const payload = JSON.stringify({ /* invariato */ });
    const url = new URL('/api/chat', host);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: REQUEST_TIMEOUT_MS,
      signal,                          // <-- Node 22: abort → distrugge la request
    }, (res) => { /* invariato: raccogli data, resolve */ });

    req.on('error', (err: any) => {
      if (isAbortError(err)) reject(makeAbortError());
      else reject(new Error(`Ollama connection error: ${err.message}`));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(payload);
    req.end();
  });
}
```

Idem `inceptionRequest`: aggiungere `signal` alle opzioni di `https.request` e gestire AbortError in `on('error')`.

> **Caveat Ollama (documentare, non bloccante):** con `stream:false`, distruggere il socket libera subito il lato Node ma Ollama *potrebbe* continuare a calcolare lo step corrente lato GPU (spreco di UNO step, non dell'intera generazione). Accettabile. Per interrupt a spreco zero servirebbe passare a `stream:true` — fuori scope ora.

### 5.3 Generazione del nome (se non fornito)

Attualmente `firstName`/`lastName` restano placeholder. Correggere: nello **STEP 2 (basicInfo)**, se `input.firstName`/`input.lastName` sono assenti, chiedere all'LLM di generarli. Aggiungere al system prompt della basicInfo: *"Se il nome non è fornito, proponi un nome e cognome vittoriani coerenti nei campi `firstName` e `lastName`."* e includere quei campi nel JSON estratto. Poi:
```typescript
const finalFirstName = input.firstName || basicInfo.firstName || 'Unknown';
const finalLastName  = input.lastName  || basicInfo.lastName  || 'Unknown';
```
Usare `finalFirstName`/`finalLastName` nell'assemblaggio finale (§ STEP 7) e nel check unicità (§6).

### 5.4 Verifica budget ESATTI (fail loud)

Dopo STEP 5 (stats) e STEP 6 (skills), prima di assemblare:
```typescript
const statsSum = Object.values(stats).reduce((a, b) => a + b, 0);
if (statsSum !== statsBudget) {
  throw new Error(`BUDGET MISMATCH stats: got ${statsSum}, expected ${statsBudget}`);
}
const skillsSum = Object.values(skillsMap).reduce((a, b) => a + b, 0);
if (skillsSum !== skillsBudget) {
  throw new Error(`BUDGET MISMATCH skills: got ${skillsSum}, expected ${skillsBudget}`);
}
```
> Nota: `skillsMap` deve contenere i **punti spesi** (manualPoints), non il valore finale della skill. `allocateSkills` già ritorna i punti aggiunti. Confermare che `StatAllocator.allocateStats` ritorni i valori la cui SOMMA è `statsBudget` (via `normalizeSumTo`). Se `allocateStats` ritorna valori assoluti la cui somma deve fare `statsBudget`, la verifica sopra è corretta.

---

## 6. Name uniqueness (Opzione B) — best-effort e abortibile

Dopo aver stabilito `finalFirstName`/`finalLastName` (STEP 2), prima di STEP 7:

1. Chiamare unified-backend: `GET ${UNIFIED_BACKEND_URL}/characters/name-available?name=<encodeURIComponent(fullName)>` con **timeout 3s** e **abortibile** (passare `signal`).
2. Comportamento:
   - Risposta `{ available: true }` → procedi.
   - Risposta `{ available: false }` → rigenera il solo nome con una micro-chiamata LLM (o appendi un secondo nome vittoriano) e ripeti il check **max 2 volte**; poi procedi comunque col migliore.
   - **Backend irraggiungibile / errore / timeout** → `logger.warn` e **procedi** (best-effort, non bloccare la generazione).
3. Emettere un evento `step` informativo: `emit('step', { step: 6.5, message: 'Checking name uniqueness...' })`.

> **IMPORTANTE (fuori scope character-gen, ma OBBLIGATORIO documentare):** la garanzia reale di unicità è l'**unique index su `name`** nella collection Character di unified-backend + gestione del duplicate-key error a save-time (rigenera/suffissa). Il check qui è solo UX per evitare di generare un nome già preso; NON sostituisce il vincolo DB. Aprire un TODO backend-side.

Il fetch abortibile può usare `undici`/`fetch` globale di Node 22:
```typescript
const resp = await fetch(url, { signal, headers: { 'Content-Type': 'application/json' } });
```
`fetch` con `AbortSignal` lancia già un AbortError intercettato da `isAbortError`.

---

## 7. gameConfig — da dove arriva

Per ora `routes.ts` usa un **mock** di `gameConfig` (skills, occupations, statsBudget, skillsBudget). Mantenere il mock ma isolarlo in una funzione `getMockGameConfig()` con un commento `// TODO: fetch da unified-backend`. La firma di `manager.submit(input, gameConfig)` è già pronta a ricevere il config reale quando verrà implementato il fetch dal DB.

---

## 8. `routes.ts` — nuovi contratti

```typescript
import { Router, Request, Response } from 'express';
import { generationManager } from './GenerationManager';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('CharacterGen');
const router = Router();

// POST /generate — avvia/rimpiazza, ritorna SUBITO (no SSE)
router.post('/generate', (req: Request, res: Response) => {
  const { requestId, sessionKey, description, firstName, lastName, gender } = req.body;
  const missing: string[] = [];
  if (!sessionKey) missing.push('sessionKey');
  if (!description) missing.push('description');
  if (missing.length) {
    return res.status(400).json({ success: false, error: `Missing: ${missing.join(', ')}`, code: 'MISSING_REQUIRED_FIELDS' });
  }
  const gameConfig = getMockGameConfig(); // TODO: fetch da unified-backend
  const { generationId } = generationManager.submit(
    { requestId: requestId || sessionKey, sessionKey, description, firstName, lastName, gender },
    gameConfig,
  );
  logger.info(`Submit session=${sessionKey} gen=${generationId}`);
  return res.status(202).json({ success: true, sessionKey, generationId, status: 'queued' });
});

// GET /status/:sessionKey — SSE stream
router.get('/status/:sessionKey', (req: Request, res: Response) => {
  const { sessionKey } = req.params;
  const ok = generationManager.subscribe(sessionKey, res);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Session not found', code: 'SESSION_NOT_FOUND' });
  }
  // NON chiamare res.end(): la connessione resta aperta per lo streaming.
});

function getMockGameConfig() {
  return {
    skills: [
      { id: 'sk1', name: 'Firearms', baseValue: 20, category: 'combat' },
      { id: 'sk2', name: 'Occultism', baseValue: 10, category: 'knowledge' },
      { id: 'sk3', name: 'Psychology', baseValue: 15, category: 'knowledge' },
      { id: 'sk4', name: 'Investigation', baseValue: 30, category: 'knowledge' },
      { id: 'sk5', name: 'Dodge', baseValue: 25, category: 'combat' },
      { id: 'sk6', name: 'Stealth', baseValue: 20, category: 'combat' },
      { id: 'sk7', name: 'Charm', baseValue: 35, category: 'social' },
      { id: 'sk8', name: 'Medicine', baseValue: 15, category: 'knowledge' },
    ],
    occupations: [
      { id: 'occ1', name: 'Detective', description: 'Police detective' },
      { id: 'occ2', name: 'Doctor', description: 'Medical professional' },
      { id: 'occ3', name: 'Lawyer', description: 'Legal professional' },
      { id: 'occ4', name: 'Journalist', description: 'Newspaper reporter' },
    ],
    statsBudget: 450,
    skillsBudget: 250,
  };
}

export default router;
```

---

## 9. Contratto eventi SSE (per il frontend)

Ogni `data` include `generationId`. Il client **memorizza l'ultimo `generationId`** visto (da `state`/`restarted`) e **ignora** eventi con `generationId` inferiore.

| event | data | significato |
|-------|------|-------------|
| `state` | `{ generationId, status, stepsBuffered }` | snapshot iniziale al (ri)connect |
| `step` | `{ generationId, step, message, complete?, substep?, section? }` | avanzamento |
| `restarted` | `{ generationId }` | una nuova run ha rimpiazzato la precedente → il client resetta la UI |
| `aborted` | `{ generationId, reason }` | la run è stata cancellata |
| `complete` | `{ generationId, requestId, character, processingMs }` | risultato finale |
| `error` | `{ generationId, error, code }` | fallimento |

Regola client: alla ricezione di `complete` o `error` per il `generationId` corrente, chiudere la EventSource.

---

## 10. Invarianti / edge cases da rispettare

1. **404 prima dell'SSE**: se `sessionKey` non esiste, rispondere 404 JSON *prima* di scrivere header SSE.
2. **Reinvio mentre in coda** (non ancora partita): `submit` marca la vecchia `aborted` + la rimuove dalla coda + accoda la nuova. Nessuna doppia esecuzione.
3. **Reinvio mentre in esecuzione**: `abortController.abort()` → la pipeline lancia AbortError entro lo step corrente → `.finally` libera lo slot → `processNext` pesca la nuova run ri-accodata. Verificare che l'aborted NON emetta `complete`/`error`.
4. **Evento stale**: se un `complete` arriva per una run già rimpiazzata (`state.currentGenerationId !== genId`), scartarlo (già gestito nei `.then/.catch`).
5. **Client multipli** sullo stesso `sessionKey`: `emit` fa fan-out a tutti i `subscribers`. Ognuno riceve il replay al connect.
6. **Disconnessione client**: `res.on('close')` rimuove il subscriber e ferma il ping. NON abortire la generazione se un client si disconnette (un altro client / il refresh deve poterla ritrovare).
7. **Budget mismatch**: throw → diventa evento `error`. NON emettere un personaggio con budget sbagliato.
8. **Cleanup**: sessioni terminali senza subscriber e più vecchie di 1h vengono rimosse.

---

## 11. Checklist di test (curl)

Avvio: `cd local-ai/services/character-gen && npm run build && npm start` (Ollama attivo).

### T1 — Happy path
```bash
# Terminale A: apri lo stream
curl -N http://localhost:8130/status/sess-abc

# Terminale B: avvia
curl -X POST http://localhost:8130/generate -H 'Content-Type: application/json' \
  -d '{"sessionKey":"sess-abc","description":"Un detective che usa bene le garrote"}'
```
Atteso in A: `state` → sequenza `step` → `complete` con character. Somma stats = 450, somma skill = 250.

### T2 — Cancel-and-replace
```bash
curl -N http://localhost:8130/status/sess-xyz &
curl -X POST http://localhost:8130/generate -H 'Content-Type: application/json' \
  -d '{"sessionKey":"sess-xyz","description":"Un detective con le garrote"}'
sleep 3
# reinvio con più info → deve abortire e ripartire
curl -X POST http://localhost:8130/generate -H 'Content-Type: application/json' \
  -d '{"sessionKey":"sess-xyz","description":"Un detective con le garrote, si chiama Joshua Bennet, senza famiglia","firstName":"Joshua","lastName":"Bennet"}'
```
Atteso nello stream: eventi della prima run → `aborted` → `restarted` (genId 2) → step nuovi → `complete`. La seconda run parte **entro ~15s** dal reinvio (NON dopo il completamento della prima).

### T3 — Refresh recovery
```bash
curl -X POST http://localhost:8130/generate -H 'Content-Type: application/json' \
  -d '{"sessionKey":"sess-r","description":"Un medico londinese"}'
# simula refresh: apri lo stream DOPO l'avvio
curl -N http://localhost:8130/status/sess-r
```
Atteso: al connect ricevi `state` + replay degli step già avvenuti, poi live fino a `complete`.

### T4 — 404 sessione inesistente
```bash
curl -i http://localhost:8130/status/does-not-exist
```
Atteso: `HTTP/1.1 404` JSON `SESSION_NOT_FOUND`.

### T5 — Validazione
```bash
curl -X POST http://localhost:8130/generate -H 'Content-Type: application/json' -d '{"description":"x"}'
```
Atteso: 400 `MISSING_REQUIRED_FIELDS` (manca `sessionKey`).

### T6 — Budget esatti (ripeti T1 3-4 volte con descrizioni diverse)
Verificare SEMPRE: `sum(stats) === 450` e `sum(skills) === 250`. Nessuna eccezione.

---

## 12. Fuori scope (TODO successivi, documentare ma non implementare ora)
- Fetch reale di `gameConfig` da unified-backend (ora mock).
- Unique index su `Character.name` + gestione duplicate-key a save-time in unified-backend (garanzia reale unicità).
- Eventuale passaggio a `stream:true` verso Ollama per interrupt a spreco-zero.
- Debounce lato frontend (~500-800ms) sul submit per coalescere reinvii ravvicinati.
- Endpoint opzionale `DELETE /status/:sessionKey` per cancellazione esplicita.

---

## 13. Ordine di implementazione consigliato
1. `types.ts` (tipi).
2. `CharacterGenerator.ts`: firma `run()`, threading `signal`, `checkAbort`, `emit`, generazione nome, verifica budget.
3. `GenerationManager.ts` (nuovo).
4. `routes.ts` (nuovi endpoint).
5. `npm run build` → risolvere errori TS.
6. Test T1→T6 in ordine.
7. Verifica finale budget esatti su più run.
