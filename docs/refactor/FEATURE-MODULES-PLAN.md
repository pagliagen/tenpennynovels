# Piano di refactor — da organizzazione per layer a organizzazione per feature

**Branch**: `refactor/feature-modules-architecture`
**Target primario**: `services/unified-backend`
**Data**: 2026-08-13
**Stato**: piano approvato, esecuzione da iniziare dalla Fase 0

---

## 1. Obiettivo

Passare da un codebase organizzato **per layer tecnico** (tutti i model insieme, tutti i controller insieme) a uno organizzato **per feature verticale**, dove ogni feature possiede il proprio stack e si registra attraverso un manifest.

Non è solo riorganizzazione di cartelle. Il requisito che qualifica il design è questo:

> Una feature spenta non deve esistere. Una feature accesa deve **agganciarsi ai flussi del core** senza che il core sappia della sua esistenza.

Due casi guida, entrambi già presenti nel codice in forma ad-hoc:

| Caso | Oggi | Deve diventare |
|---|---|---|
| **Bibliotecario** (Q&A RAG sui documenti) | `DocumentSearchAgent` chiamato dentro il flusso di ricerca, che controlla `keeper_qa_enabled` inline | Feature che si registra sull'extension point `documents.search.stream` e si intromette nella ricerca solo se accesa |
| **Bot giocate** | Blocco `BOT ROUND GATE` di ~120 righe inline in `ChatController`, più `botRoutes` con middleware `requireBotManagementEnabled` | Feature che si registra su `chat.message.persisted` e monta le proprie route admin, tutto gated dal flag `bot` |

### Criteri di successo

1. Aggiungere una feature nuova = creare una directory + una riga nel registry. Zero modifiche sparse.
2. Spegnere una feature dal gestionale la rimuove da route, hook, job ed eventi **senza deploy**.
3. **L'API HTTP pubblica non cambia**: stessi path, stessi payload, stesso comportamento. Il refactor è interno.
4. Il core non contiene un solo `import` verso una feature.

---

## 2. Stato attuale — evidenze misurate

Numeri rilevati sul codice al commit `295a357`, non stime.

| Metrica | Valore |
|---|---|
| Righe TS in `unified-backend/src` (esclusi node_modules) | ~107.000 su 410 file |
| Controller | 84 |
| Service | 33 |
| Model Mongoose | 65 file in **una cartella piatta** |
| `ChatController.ts` | 3083 righe, **55 query Mongoose dirette** |
| File sopra 1500 righe | 7 |
| File di test in tutto il repo | **3** (1 in unified-backend) |

### I due assi duplicati

Ogni feature esiste **due volte**, una per il gioco e una per l'amministrazione:

```
modules/game/controllers/CorporationController.ts
modules/admin/controllers/CorporationManagementController.ts
```

Vale per Corporation, Location, Item, Skill, Occupation, Chat, Session, CharacterRelation, CharacterFinances, Ticket, Document e il Forum (che ha **5** controller admin). Lo slicing verticale collassa naturalmente questo asse.

### Accoppiamento reale

Gli import cross-modulo espliciti (`@modules/x` → `@modules/y`) sono **solo 16**. Il vero accoppiamento passa altrove:

| Sorgente | Import da `@database/*` | Import da `@shared/*` |
|---|---|---|
| game | 79 | 108 |
| admin | 73 | 100 |
| forum | 23 | 12 |
| auth | 10 | 20 |
| documents | 4 | 4 |
| tickets | 1 | 4 |

**Tutti passano dal barrel globale `@database/models`** (243 righe di re-export). È lì che va rotto l'accoppiamento, non negli import fra moduli.

Nota utile: `database/models/index.ts` **raggruppa già per feature nei commenti** (`// Corporation System`, `// Item and Shop System`, `// Location System`). L'intento c'è, manca la struttura.

### Cosa esiste già e va generalizzato, non inventato

Il progetto ha già costruito a mano, due volte, i pezzi del sistema:

- `SystemConfiguration` con `configSection: 'ai_features'` e `ConfigurationService` con cache Redis + invalidazione via pub/sub
- Flag `bot_management_enabled` e `keeper_qa_enabled`, entrambi default OFF
- `requireBotManagementEnabled` in `modules/admin/routes/botRoutes.ts:18` — un middleware di gating per feature
- `SystemConfigController` che espone i flag al frontend
- `apps/management/src/store/featureFlagsStore.ts` e `Sidebar.tsx:26` con `featureFlag?: 'botManagementEnabled' | 'keeperQaEnabled'` — le voci di menu sono **già** gated

Questo è il caso "rule of three": due implementazioni ad-hoc esistenti, una terza in arrivo. Generalizzare adesso è giustificato.

### Difetto da sanare per primo

`src/shared/` e `src/database/` hanno un `package.json` proprio e un `node_modules` installato, con copie duplicate di `express`, `winston`, `redis`, `mongoose`, `typescript`.

I range sono **già divergenti**: `src/shared/package.json` dichiara `redis: ^5.10.0`, la root `^5.11.0`.

Peggio: il deploy li mantiene attivamente.

```
deploy/scripts/install-all.sh:29      (cd "services/unified-backend/src/shared" && npm install || true)
.github/workflows/deploy.yml:179-180  if [ -f ".../src/shared/package.json" ]; then (cd ... && npm install)
```

E **nessuno importa `@tenpennynovels/shared`**: l'unica occorrenza è un commento in `ConfigurationService.ts:16`. È impalcatura morta che la pipeline installa a ogni deploy. In più `tsconfig.json` esclude `"node_modules"` (relativo alla root del progetto), quindi `src/shared/node_modules/**/*.ts` **rientra** in `include: ["src/**/*"]` e viene scansionato da `tsc`.

---

## 3. Architettura target

### 3.1 Principio di dipendenza

```
      bootstrap (app.ts)
             │  importa
             ▼
      features/*  ──importa──►  core/
             │
             └──importa──►  features/<altra>/api  (solo se dichiarata in dependsOn)

      core/  ──────────────────►  MAI verso features/
```

Tre regole, verificate da script in CI:

1. `core/` non importa mai da `features/`.
2. Una feature importa da un'altra feature **solo** attraverso il suo barrel pubblico `features/<nome>/api.ts`, e solo se la dichiara in `dependsOn`.
3. Nessuno importa `features/<nome>/internal/**` dall'esterno della feature.

### 3.2 Cosa sta nel core

Il confine è la decisione architetturale più importante del piano. Sbagliato il confine, il refactor produce lo stesso groviglio in cartelle più belle.

**Core** (stabile, ogni feature può dipenderci — il minimo indispensabile perché il gioco esista: un GDR via chat non regge senza personaggi, un posto dove stare, e un modo per parlarci):

```
src/core/
  auth/            autenticazione utente + sessione personaggio, middleware
  character/       Character, CharacterSession — l'entità attorno a cui ruota tutto
                    (include Prestavolto e Anagrafica: oggi campi sullo stesso
                    schema Mongoose, non collection separate — restano lì,
                    nessuna estrazione prevista)
  user/            User
  location/        Location — dove stanno i personaggi
  chat/            Chat, il trasporto — invio/persistenza messaggi in una location
  onGameMessages/  OnGameMessage, OnGameThread — sistema postale in-fiction
  permissions/     registry dei permessi
  config/          ConfigurationService, appConfig
  events/          bus Redis, RedisSubscriber, EventRouter, RedisChannel
  http/            apiResponse, errorHandler, middleware condivisi
  ai/              client verso il gateway AI (embedding, classify, summarize)
  features/        registry, manifest, bootstrap, feature flags
  extensions/      extension point registry
  logger/
```

**Feature** (tutto il resto — arricchisce il gioco ma non è indispensabile alla sua esistenza):

```
src/features/
  bibliotecario/      ← pilota fase 2
  bot/                ← fase 3
  corporazioni/       ← fase 4
  tickets/             ← fase 6.1, fatta
  occupazioni/  oggetti/  economia/
  forum/  documenti/
  offGameMessages/     meta-comunicazione fuori fiction (OffGameChat legacy, OffGameThread, OffGameMessage)
  fineSessione/        segmentazione della chat in scene narrative (ChatScene, CharacterChatScene, ChatSceneService) — sopra al trasporto core, non il trasporto stesso
```

**Decisione (2026-08-13, rivista rispetto alla bozza iniziale)**: `Location`, `Chat` (il trasporto) e i messaggi OnGame sono **core**, non feature — smentisce la classificazione originaria di questa sezione (che li aveva messi fra le feature "per ultime", contraddicendo peraltro §4.2 che già chiamava `Location` "un model del core"). Motivazione: senza personaggi, un posto dove stare, e un modo per parlarci non c'è gioco — sono le pareti portanti, non contenuto. Restano feature separabili sopra al trasporto: la segmentazione in scene (`fineSessione`, oggi `ChatSceneService`, già ben isolato — proprio model, proprio service) e la messaggistica OffGame (meta-comunicazione, non in-fiction). `Prestavolto` e `Anagrafica` restano dentro `character/`: sono campi sullo stesso schema Character, l'estrazione richiederebbe lo stesso debito già accettato per i campi bot su `Location` (Mongoose non supporta l'estensione di uno schema da parte di un altro modulo) — non ritenuto necessario.

**Nota**: questa sezione descrive il confine *logico* target. Nessuna fase fino ad ora sposta fisicamente `Character`/`User`/`auth`/`Location`/`Chat`/messaggi OnGame dentro `src/core/` — restano nei vecchi path per-layer (`database/models/`, `modules/game/`, `modules/auth/`) finché non si esegue la Fase 7 (§5), esplicitamente rimandata alla fine dopo tutte le estrazioni di feature. Fino a quel momento "core" è una classificazione, non una posizione nel filesystem: le feature continuano a importare questi model con i path esistenti, non da `@core/*`.

### 3.3 Anatomia di una feature

```
src/features/<nome>/
  manifest.ts          ← unico file che il registry conosce
  api.ts               ← barrel pubblico: l'unica superficie che altre feature possono importare
  models/              ← model Mongoose posseduti dalla feature
  services/
  controllers/
  routes/
    game.ts
    admin.ts
  extensions/          ← handler registrati sugli extension point del core
  events/              ← handler dei canali Redis
  jobs/                ← cron
  permissions.ts
  types.ts
  internal/            ← opzionale, esplicitamente non importabile dall'esterno
```

### 3.4 Il manifest

`src/core/features/types.ts`:

```typescript
import type { Router } from 'express';
import type { RedisChannel, IEventHandler } from '@core/events';
import type { PermissionDefinition } from '@core/permissions';

export type FeatureKey = string;

export interface FeatureRouteMount {
  /** Determina il prefisso: 'public' → /, 'game' → /game, 'admin' → /admin */
  scope: 'public' | 'game' | 'admin';
  /** Path relativo allo scope, es. '/corporations' */
  path: string;
  router: Router;
  /** Se true (default) le route rispondono 404 quando la feature è spenta */
  gated?: boolean;
}

export interface FeatureFlagSpec {
  /** configKey in SystemConfiguration, es. 'keeper_qa_enabled' */
  configKey: string;
  section: 'ai_features' | 'system' | 'economy' | 'moderation';
  default: boolean;
  /** Etichetta mostrata nel gestionale */
  label: string;
}

export interface FeatureJob {
  name: string;
  /** espressione node-cron */
  schedule: string;
  handler: () => Promise<void>;
}

export interface FeatureManifest {
  key: FeatureKey;
  title: string;
  description?: string;
  /** Assente = feature sempre attiva (non disattivabile) */
  flag?: FeatureFlagSpec;
  /** Feature di cui questa importa l'api.ts */
  dependsOn?: FeatureKey[];
  /** Ordine di registrazione degli hook. Default 100, più basso = prima */
  priority?: number;

  routes?: FeatureRouteMount[];
  permissions?: PermissionDefinition[];
  eventHandlers?: { channel: RedisChannel; handler: IEventHandler }[];
  jobs?: FeatureJob[];
  /** Registrazione sugli extension point del core */
  extensions?: (reg: ExtensionRegistrar) => void;
  /** Inizializzazione una-tantum al boot (registrazione model, warmup) */
  onBoot?: () => Promise<void>;
}
```

Il registry è un array di import statici. **Nessun caricamento dinamico, nessun filesystem scanning, nessun `require()` a runtime.**

```typescript
// src/features/index.ts
import { bibliotecario } from './bibliotecario/manifest';
import { bot } from './bot/manifest';
import { corporazioni } from './corporazioni/manifest';

export const FEATURES: readonly FeatureManifest[] = [
  bibliotecario,
  bot,
  corporazioni,
] as const;
```

### 3.5 Feature flag — a runtime, non al boot

Il flag va valutato **a ogni invocazione**, non all'avvio: il gestionale lo cambia a caldo e `ConfigurationService` già invalida la cache via pub/sub Redis (`system_config_updated`).

```typescript
// src/core/features/flags.ts
export class FeatureFlagService {
  /** Legge da ConfigurationService (cache Redis già esistente). Feature senza flag = sempre true. */
  static async isEnabled(key: FeatureKey): Promise<boolean>;
  /** Mappa completa per il gestionale — sostituisce l'hardcoded in SystemConfigController */
  static async getAll(): Promise<Record<FeatureKey, boolean>>;
}
```

Gating delle route: le route si montano sempre, il middleware decide.

```typescript
// src/core/features/middleware/requireFeature.ts
export const requireFeature = (key: FeatureKey): RequestHandler => async (req, res, next) => {
  if (await FeatureFlagService.isEnabled(key)) return next();
  return res.status(404).json(errorResponse('Risorsa non trovata', 'FEATURE_DISABLED'));
};
```

Generalizza `requireBotManagementEnabled` (`modules/admin/routes/botRoutes.ts:18`), che va eliminato.

**404 e non 403**: una feature spenta non deve rivelare la propria esistenza.

### 3.6 Extension point — il pezzo che rende il sistema utile

Due primitive, con semantiche diverse.

**Hook** — notifica. Nessun valore di ritorno, errori isolati, il flusso del core prosegue comunque.
**Filter** — trasformazione. Riceve un valore, ne restituisce uno; eseguiti in sequenza per priorità.

```typescript
// src/core/extensions/points.ts

/** Extension point di sola notifica */
export interface HookMap {
  'chat.message.persisted': {
    message: PersistedMessage;
    character: CharacterRef;
    locationId: string;
    actionType: string;
    io: SocketIOServer | null;
  };
  'chat.scene.closed':        { sceneId: string; locationId: string };
  'character.approved':       { characterId: string; approvedBy: string };
  'location.occupants.changed': { locationId: string; occupants: OccupantRef[] };
  /**
   * Streaming SSE della ricerca documenti.
   * Il core ha già inviato i risultati testuali; chi si aggancia può
   * inviare eventi aggiuntivi sullo stesso stream.
   * IMPORTANTE: il core resta proprietario di 'complete' e di res.end().
   * Un handler non deve MAI chiudere lo stream.
   */
  'documents.search.stream': {
    question: string;
    chunks: ContextChunk[];
    sse: SseWriter;
    signal: AbortSignal;
  };
}

/** Extension point di trasformazione */
export interface FilterMap {
  'documents.search.capabilities': { value: SearchCapabilities; ctx: { userId?: string } };
  'chat.message.beforePersist':    { value: DraftMessage; ctx: { locationId: string } };
  'character.sheet.sections':      { value: SheetSection[]; ctx: { characterId: string } };
}
```

```typescript
// src/core/extensions/registry.ts
class ExtensionRegistry {
  registerHook<K extends keyof HookMap>(
    feature: FeatureKey, point: K,
    fn: (ctx: HookMap[K]) => Promise<void>, priority?: number
  ): void;

  registerFilter<K extends keyof FilterMap>(
    feature: FeatureKey, point: K,
    fn: (value: FilterMap[K]['value'], ctx: FilterMap[K]['ctx']) => Promise<FilterMap[K]['value']>,
    priority?: number
  ): void;

  /**
   * Esegue gli hook registrati. Per ognuno verifica il flag della feature
   * proprietaria. Un errore viene loggato e NON propagato: il flusso del
   * core non deve mai rompersi per colpa di una feature.
   */
  async emit<K extends keyof HookMap>(point: K, ctx: HookMap[K]): Promise<void>;

  /**
   * Applica i filter in sequenza. Su errore di un filter si mantiene il
   * valore precedente e si prosegue con il successivo.
   */
  async apply<K extends keyof FilterMap>(
    point: K, value: FilterMap[K]['value'], ctx: FilterMap[K]['ctx']
  ): Promise<FilterMap[K]['value']>;
}

export const extensions = new ExtensionRegistry();
```

Vincoli non negoziabili sull'implementazione:

- `emit` non propaga mai un'errore verso il chiamante. `try/catch` per singolo handler, log con `feature` e `point` nel contesto strutturato.
- L'ordine è deterministico: `priority` crescente, a parità `key` alfabetica. Mai affidarsi all'ordine di registrazione.
- Il controllo del flag avviene dentro `emit`/`apply`, non nel codice della feature.
- Gli hook sono `await`-ati in sequenza, non in parallelo: il caso bot ha effetti su stato condiviso e la concorrenza introdurrebbe race.

---

## 4. I due casi guida, mappati

### 4.1 Bibliotecario

**Oggi.** `DocumentSearchAgent.run()` (`modules/documents/services/DocumentSearchAgent.ts:76-142`) controlla `isKeeperQaEnabled()`, poi `isAiAvailable()`, poi chiama `askQuestion()`. Nei quattro rami di uscita fa `sendSSE(res, 'complete', {})` e `res.end()` — la logica di chiusura dello stream è duplicata quattro volte dentro la feature invece di stare nel core.

`DocumentController.ts:647-710` ricontrolla il flag per calcolare `aiAvailable` nella response.

**Dopo.**

Il core (`features/documenti`) fa retrieval, invia i risultati, emette l'hook, chiude:

```typescript
// features/documenti/controllers/SearchController.ts
sse.send('results', { documents });
await extensions.emit('documents.search.stream', { question, chunks, sse, signal });
sse.send('complete', {});
sse.end();
```

Il bibliotecario si limita al suo lavoro:

```typescript
// features/bibliotecario/extensions/searchStream.ts
export async function onSearchStream({ question, chunks, sse, signal }: HookMap['documents.search.stream']) {
  if (signal.aborted) return;
  if (!await KeeperClient.isAiAvailable()) return;      // nessun res.end(): non è affar suo
  const answer = await KeeperClient.ask({ question, context: chunks, options: { maxTokens: 800, locale: 'it' } });
  if (!answer?.success || signal.aborted) return;
  sse.send('ai_answer', { answer: answer.answer, sources: answer.sources ?? [], model: answer.metadata?.model });
}
```

Il controllo di `keeper_qa_enabled` sparisce dal codice: lo fa `emit` leggendo il flag del manifest.

**Split obbligatorio di `EmbeddingService`** (341 righe, oggi in `modules/documents/services/`). Contiene tre gruppi di metodi che appartengono a tre posti diversi:

| Metodo | Destinazione |
|---|---|
| `generateEmbedding`, `semanticSearch`, `isAiAvailable` | `features/documenti/services/EmbeddingService.ts` — servono alla ricerca anche a bibliotecario spento |
| `isKeeperQaEnabled`, `askQuestion`, `extractKeywords`, `extractInsight` | `features/bibliotecario/services/KeeperClient.ts` (`isKeeperQaEnabled` sparisce: diventa il flag del manifest) |
| `classifySceneContinuation`, `summarizeScene` | `core/ai/AiGatewayClient.ts` — **non c'entrano nulla con i documenti**, li usa la chat |

Quest'ultima riga è un esempio esatto del problema che il refactor risolve: due metodi della chat vivono in un service dei documenti perché condividono il trasporto HTTP.

### 4.2 Bot giocate

**Oggi.** Tre punti scollegati:

1. `ChatController.ts:631-~750` — blocco `// ========== BOT ROUND GATE ==========`, ~120 righe inline nel path di invio messaggio, con `await import('../services/AIGatewayClient')` dinamico, query dirette su `Location` e `Character`, gestione dello stato `botRound`.
2. `modules/admin/routes/botRoutes.ts` + `BotController.ts` + `admin/services/BotGenerationBridge.ts` — generazione bot dal gestionale, gated da `requireBotManagementEnabled`.
3. `modules/game/controllers/CharacterController.ts:278-493` — creazione del personaggio-bot, con `SYSTEM_BOT_USER_ID`.

**Dopo.** Una sola feature `features/bot/`:

```
features/bot/
  manifest.ts                      flag: bot_management_enabled → key 'bot'
  api.ts
  extensions/chatRound.ts          ← le ~120 righe estratte da ChatController
  controllers/BotAdminController.ts
  controllers/BotCharacterController.ts
  services/BotGenerationBridge.ts
  services/AiBotClient.ts          ← wrapper sui soli endpoint /botai/* di AIGatewayClient
  routes/admin.ts
```

In `ChatController` resta una riga:

```typescript
await extensions.emit('chat.message.persisted', {
  message: savedAction, character, locationId, actionType, io
});
```

`requireBotManagementEnabled` viene eliminato: il manifest dichiara `flag`, `bootstrapFeatures` applica `requireFeature('bot')` a tutte le route con `gated: true`.

**Debito accettato e da documentare.** I campi `bot_enabled`, `botCharacterId` e `botRound` stanno sullo schema `Location`, che è un model del core. Mongoose non permette a una feature di estendere lo schema di un'altra senza discriminator. Per ora restano dove sono; l'alternativa pulita (collection `LocationBotState` posseduta da `features/bot`) è un refactor a sé, da valutare dopo la Fase 6. Va scritto nel manifest come commento, non lasciato implicito.

---

## 5. Fasi

Ogni fase è **indipendentemente mergiabile in master** e non cambia il comportamento osservabile. Raccomandazione forte: **mergiare ogni fase in master appena verde**, non tenere questo branch aperto per settimane — con lo sviluppo che continua in parallelo, un branch di lunga durata produce conflitti su file da 3000 righe.

### Fase 0 — Rete di sicurezza e pulizia

Nessun cambiamento funzionale. È il prerequisito di tutto il resto.

**0.1 — Inventario delle route (strumento di regressione)**

Creare `src/scripts/dump-routes.ts`: monta l'app Express senza avviare il server, cammina lo stack dei router, stampa `METHOD PATH` ordinato alfabeticamente.

```bash
npx tsx src/scripts/dump-routes.ts > docs/refactor/routes-baseline.txt
```

Committare il baseline. **A ogni fase successiva, rigenerare e verificare `diff` vuoto.** Senza test, questo è l'unico controllo automatico che una route non sia sparita o cambiata di path.

**0.2 — Rimozione dei `node_modules` annidati**

```bash
git rm -r --cached services/unified-backend/src/shared/package.json \
                   services/unified-backend/src/shared/package-lock.json \
                   services/unified-backend/src/database/package.json \
                   services/unified-backend/src/database/package-lock.json
rm -rf services/unified-backend/src/shared/node_modules \
       services/unified-backend/src/database/node_modules
```

Poi aggiornare i due punti che li mantengono in vita:

- `deploy/scripts/install-all.sh:29` — rimuovere la riga
- `.github/workflows/deploy.yml:179-180` — rimuovere il blocco condizionale
- `services/unified-backend/src/shared/services/ConfigurationService.ts:16` — correggere il commento che cita `@tenpennynovels/shared`

Verificare che le dipendenze citate nei package.json rimossi (`express`, `redis`, `winston`, `ua-parser-js`) siano tutte presenti nel `package.json` root di unified-backend. `ua-parser-js` va controllato in particolare.

**0.3 — tsconfig**

`services/unified-backend/tsconfig.json`, campo `exclude`: sostituire `"node_modules"` con `"**/node_modules"`.

**Correzione rispetto alla stesura originale di questo piano**: qui si affermava che il pattern bare `"node_modules"` fosse relativo alla root e non coprisse le cartelle annidate. Verificato empiricamente (progetto di prova con un tipo rotto dentro un `node_modules` annidato, compilato prima e dopo la modifica): **il claim era sbagliato**. TypeScript tratta un identificatore senza wildcard come se avesse un prefisso implicito `**/`, quindi il pattern originale escludeva già correttamente anche i `node_modules` annidati — non stava scansionando `src/shared/node_modules` prima della 0.2. Il cambio resta comunque nel piano perché rende esplicito un comportamento che altrimenti è implicito e non ovvio da documentazione, a costo praticamente nullo — ma non va presentato come un fix di un bug reale.

**0.4 — Verifica**

```bash
cd services/unified-backend
npm run type-check && npm run build
npx tsx src/scripts/dump-routes.ts | diff - docs/refactor/routes-baseline.txt
```

**Criterio di uscita**: build verde, diff route vuoto, misurare il tempo di `tsc` prima/dopo (dovrebbe calare in modo visibile).

**Commit**:
- `chore(unified-backend): aggiunge script di inventario route come baseline di regressione`
- `fix(unified-backend): rimuove node_modules annidati in src e aggiorna il deploy`

⚠️ La 0.2 tocca la pipeline di deploy. **Verificare con un deploy reale prima di procedere alla Fase 1.**

---

### Fase 1 — Scaffolding del core, nessuna feature migrata

Creare l'infrastruttura con il registry **vuoto**. Zero cambiamenti di comportamento.

File da creare sotto `services/unified-backend/src/core/`:

```
features/types.ts               FeatureManifest e tipi correlati (§3.4)
features/registry.ts            FeatureRegistry: register, getAll, getByKey
features/flags.ts               FeatureFlagService su ConfigurationService (§3.5)
features/bootstrap.ts           bootstrapFeatures(app): monta route, permessi, event handler, job, extension
features/middleware/requireFeature.ts
extensions/points.ts            HookMap e FilterMap (§3.6)
extensions/registry.ts          ExtensionRegistry + istanza `extensions`
index.ts                        barrel
```

Aggiungere l'alias `@core/*` → `./src/core/*` in `tsconfig.json` **e** `_moduleAliases` in `package.json` (`"@core": "./dist/core"`). Dimenticare il secondo rompe solo la produzione — è esattamente il tipo di errore che questa codebase ha già incontrato.

Creare `src/features/index.ts` con `export const FEATURES = [] as const;`.

In `app.ts`, dopo i mount esistenti (riga ~121) e **prima** di `notFoundHandler`:

```typescript
await bootstrapFeatures(app);
```

**Criterio di uscita**: build verde, `dump-routes` identico al baseline (il registry è vuoto, non monta nulla).

**Commit**: `feat(core): introduce feature registry ed extension point registry`

---

### Fase 2 — Pilota: bibliotecario

Scelto come primo perché è **piccolo, già flag-gated e spento in produzione**: il rischio è quasi nullo e valida l'intero meccanismo end-to-end.

**2.1** Split di `EmbeddingService` secondo la tabella in §4.1. Tre commit separati, non uno.

**2.2** Creare `src/features/bibliotecario/`:

```typescript
// manifest.ts
export const bibliotecario: FeatureManifest = {
  key: 'bibliotecario',
  title: 'Bibliotecario',
  description: 'Risposte AI sui documenti tramite RAG',
  flag: { configKey: 'keeper_qa_enabled', section: 'ai_features', default: false, label: 'Bibliotecario (Q&A documenti)' },
  extensions: (reg) => {
    reg.hook('documents.search.stream', onSearchStream);
  },
};
```

**2.3** Introdurre l'hook `documents.search.stream` nel flusso di ricerca. Spostare la proprietà dello stream SSE (`complete` + `end()`) nel core, come da §4.1. Rimuovere le quattro chiusure duplicate da `DocumentSearchAgent`.

**2.4** `DocumentController.ts:647-710`: sostituire il calcolo inline di `aiAvailable` con il filter `documents.search.capabilities`.

**2.5** `SystemConfigController.ts:24-43`: sostituire la lettura hardcoded dei due flag con `FeatureFlagService.getAll()`.

**Criterio di uscita**:
- Flag **OFF**: risposta della ricerca identica byte per byte a prima. Verificare con `curl` su `/documents/semantic-search` e confronto del payload.
- Flag **ON** in locale: la risposta AI arriva sullo stream.
- `dump-routes` invariato.

**Commit**: 4-5, uno per sotto-fase.

---

### Fase 3 — Bot giocate

**3.1** Creare `src/features/bot/`, spostare `admin/controllers/BotController.ts`, `admin/routes/botRoutes.ts`, `admin/services/BotGenerationBridge.ts`.

**3.2** Estrarre il blocco `BOT ROUND GATE` da `ChatController.ts` (righe ~631-750) in `features/bot/extensions/chatRound.ts`. Sostituire con `extensions.emit('chat.message.persisted', ...)`.

Attenzione: il blocco usa `await import()` dinamico di `AIGatewayClient`. Nella feature diventa un import statico normale — il dynamic import era un workaround per un ciclo di dipendenze che con lo slicing non esiste più.

**3.3** Eliminare `requireBotManagementEnabled`, sostituito da `gated: true` sul manifest.

**3.4** Spostare la creazione del personaggio-bot da `CharacterController.ts:278-493` in `features/bot/controllers/BotCharacterController.ts`.

**3.5** Documentare nel manifest il debito su `Location.bot_enabled` / `botRound` (§4.2).

**Criterio di uscita**:
- Flag **OFF**: invio messaggio in chat identico a prima. Verificare che nessuna query aggiuntiva parta (il gate oggi entra solo se `location.bot_enabled`, il nuovo hook deve uscire altrettanto presto).
- Flag **ON** in locale con botai attivo: il round bot funziona come prima.
- `dump-routes` invariato.

**Commit**: 4-5.

---

### Fase 4 — Corporazioni: la prima feature "dati"

Le fasi 2 e 3 validano gli extension point. Questa valida la **proprietà dei model**, che è il problema più difficile.

Perimetro rilevato: 8 file in `database/models`, 7 controller in `game/controllers`, 4 in `admin/controllers`, 3 route game, 2 route admin, 3 file eventi + 2 handler, 7 file in `shared/types`, 1 permesso, il canale `corporation:events` — **più il leak in `modules/forum/services`**, che va risolto qui.

Sequenza:

1. Spostare i model in `features/corporazioni/models/`, mantenendo il re-export da `database/models/index.ts` come shim di compatibilità (deprecato con commento, rimosso alla Fase 6).
2. Unificare `CorporationController` + `CorporationManagementController` sotto la feature, mantenendo route separate per scope `game` e `admin`.
3. Risolvere il leak nel forum: la logica corporazioni dentro `modules/forum/services` va o nella feature (se è logica di corporazioni) o dietro `features/corporazioni/api.ts` con `dependsOn: ['corporazioni']` dichiarato dal forum.
4. Spostare il canale `corporation:events` e i suoi handler nel manifest via `eventHandlers`.

**Criterio di uscita**: `dump-routes` invariato — i path HTTP **non cambiano**, cambia solo dove vive il codice. `type-check` verde.

⚠️ **Prima di questa fase**, valutare seriamente l'aggiunta di test di integrazione (vedi §6).

---

### Fase 5 — Enforcement dei confini

Creare `services/unified-backend/scripts/check-boundaries.ts`. Fallisce con exit code 1 se:

- un file sotto `src/core/` importa da `@features/` o `../features/`
- un file sotto `src/features/<a>/` importa da `@features/<b>/` con un path diverso da `@features/<b>/api`
- una feature importa da `@features/<b>/api` senza dichiarare `b` in `dependsOn`
- un file esterno importa da `@features/<x>/internal/`

Agganciarlo a `npm run lint:boundaries` e al job `build-check` in `.github/workflows/deploy.yml`.

Preferito uno script custom rispetto a ESLint: **`services/unified-backend` non ha alcuna configurazione ESLint** e introdurla per questa sola regola è sproporzionato. `dependency-cruiser` è l'alternativa se lo script diventa non banale.

**Commit**: `ci: verifica i confini fra core e feature nel build-check`

---

### Fase 6 — Migrazione progressiva del resto

Una feature per PR. **Mai due feature in volo contemporaneamente.** Ordine deciso dall'utente (diverge dal rischio crescente quando serve — vedi nota su `bot`):

| # | Feature | Perimetro indicativo | Note |
|---|---|---|---|
| 1 | `tickets` | ~16 file, ~6100 righe | **fatta** (Fase 6.1) — stima iniziale errata ("3 file, banale"), perimetro reale vicino a corporazioni |
| 2 | `occupazioni` | ~9 file | **fatta** (Fase 6.2) — intrecciata con la creazione personaggio (core), niente flag, `characterCreationUtils.ts`/`CharacterCreationController.ts` restano fuori come debito dichiarato |
| 3 | `economia` | 14 file | **fatta** (Fase 6.3) — niente flag, `CharacterController.ts`/`characterRoutes.ts`/`server.ts` (cron) restano fuori come debito dichiarato. `economy.ts` ridotto alle sole route shop per la prossima fase |
| 4 | `oggetti` | 11 file | **fatta** (Fase 6.4) — prima feature del registro con `dependsOn` reale (`['economia', 'corporazioni']`), wrapper aggiunti a `economia/api.ts` e `corporazioni/api.ts`. `EconomyController.ts` rinominato `ShopController.ts`. Testato E2E su Docker: trovati e preservati (non corretti) due bug preesistenti che rendono non funzionante il negozio di location (`checkLocationAccess` legge `location.private/.visible` al livello sbagliato → sempre 404) e il restock corporativo (`Character` non ha un campo `corporations` → sempre 500). Il negozio generale (Londra) è l'unico percorso shop di fatto funzionante |
| 5 | `documenti` | 17 file | **fatta** (Fase 6.5) — nessun `dependsOn` in nessuna direzione: il bibliotecario si integra solo tramite gli extension point `documents.search.stream`/`documents.search.capabilities`, mai un import diretto. `EmbeddingService.ts` spostato verbatim (non split): 3 metodi morti scartati, `classifySceneContinuation`/`summarizeScene` (100% chat-only) restano come debito dichiarato in assenza di un `core/ai/AiGatewayClient.ts`. Bug preesistente confermato con test reale: `deleteDocument` non elimina nulla (campo `deleted` non nello schema, Mongoose strict lo scarta) — preservato su decisione dell'utente |
| 6 | `forum` | 34 file, ~6600 righe | **fatta** (Fase 6.6) — la più grande finora. `dependsOn: ['corporazioni', 'documenti']` (già presente come import diretti prima della migrazione, primo caso con 2 elementi). `modules/admin/controllers/ForumManagementController.ts` (mount `/admin/forum`) resta fuori dal perimetro: gestisce `OnGameMessage` (core), non uno dei 12 model forum, per decisione esplicita dell'utente. Confermate con test reali le due politiche di cascata asimmetriche (cancellare una categoria orfanizza i topic, cancellare un topic cancella fisicamente tutto il contenuto figlio) |
| 7 | `fineSessione` | 5 file, 608 righe | **fatta** (Fase 6.7) — la più piccola finora, nessun bug preesistente né codice morto trovato. `dependsOn: ['documenti']` per `EmbeddingService.summarizeScene`/`classifySceneContinuation`, i due metodi che il manifest di `documenti` (Fase 6.5) documentava come debito in attesa del consumer reale: `fineSessione` è quel consumer. Cron relocato dentro la feature (`services/sceneClosingCron.ts`), stesso schema di `economia`/`serviceCancellationCleanup` in Fase 6.3, innescato da `server.ts` via `appConfig.features.sceneClosing` (flag statico, separato dal meccanismo `FeatureManifest.flag`). Testato E2E su Docker: apertura/tag scena su messaggio "standard", riuso scena su messaggio successivo (ramo `alreadyIn`), chiusura via cron dopo backdating manuale di `lastActivityAt`, fork in `CharacterChatScene` con titolo/riassunto generati realmente dall'AI, permessi verificati (proprietario/master in lettura, solo proprietario in scrittura, 403 per estranei) |
| 8 | `offGameMessages` | 17 file | **fatta** (Fase 6.8, ULTIMA della Fase 6) — perimetro molto più grande del previsto: due sistemi OOC paralleli mai unificati, non uno solo. Legacy (`OffGameChat`/`OffGameChatMessage`/`OffGameChatParticipant`, pienamente funzionante) + nuovo (`OffGameThread`/`OffGameMessage`, mai completata la consegna realtime — TODO "Passo 5" preservati). `dependsOn: []`. `MessageService.ts`/`MessageBackupService.ts` restano fuori (core-adiacenti, condivisi col sistema postale onGame); `ChatModerationController.ts` (game+admin), `ChatMonitoringController.ts`, `ModerationAlertController.ts` restano fuori (moderazione condivisa location/onGame/offGame). 4 bug preesistenti confermati con test reali e preservati: collection raw sbagliata in `ChatMonitoringController` (fuori perimetro), param route/controller disallineato in `MessagingSystemController.moderateParticipant` (sempre 404), campo required vuoto in `OffGameThreadService.findOrCreateThread` (il sistema nuovo non ha mai creato un thread) e filtro su un campo `Character` inesistente in `OffGameChatService.createOrGetDirectChat` (le notifiche OOC di review personaggio non hanno mai funzionato). **Segnalato ma non corretto** (fuori scope refactor, non un bug introdotto da questa migrazione): le route `/admin/mail/*` (OnGame e OffGame) non hanno alcuna autenticazione in tutta la catena — azione urgente da programmare separatamente. Recon iniziale aveva erroneamente segnalato `shared/types/messaging.ts` come morto (mancava un grep sui path relativi `./messaging` nella stessa directory): il type-check post-switch ha trovato 2 importatori reali, ripristinato verbatim prima del commit. |
| 9 | `bot` | vedi §4.2 | **rimossa, non migrata** (decisione utente, 2026-08-14) — mai stata `features/bot/`: `§4.2` restava un piano mai eseguito. Tutti i punti lì elencati (blocco BOT ROUND GATE/TURN MANAGEMENT in `ChatController.ts`, creazione personaggio-bot in `CharacterController.ts`, pannello admin `BotController.ts`+`botRoutes.ts`+`BotGenerationBridge.ts`, webhook `AIWebhookController.ts`, scheduler `TurnManager.ts`) eliminati dal codice, non spostati. Campi bot tolti dagli schemi core (`Character`, `Location`, `Chat`, `GamingSession` — quest'ultimo resta comunque, è la feature viva di prenotazione sessioni master). `local-ai/services/botai` non toccato, resta scollegato. Nella stessa sessione, stessa decisione per `image-gen` (mai stata nel piano originario): pannello admin + client `AIGatewayClient` ridotto al solo `generateSeoDescription`. Verificato E2E su Docker: nessuna route bot/image-gen residua (404), nessun 500 sulle route superstiti, `dump-routes` confrontato a mano con la baseline (diff = esattamente le route rimosse) |

`luoghi` e `chat` (il trasporto) **rimossi dalla tabella**: riclassificati come core il 2026-08-13, vedi §3.2 — non si migrano più come feature.

**Fase 6 completa (2026-08-14)**: tutte le righe della tabella sono chiuse (8 feature migrate, `bot`/`image-gen` rimosse invece che migrate). **Shim rimosso (2026-08-14)**: lo shim di compatibilità in `database/models/index.ts` è stato eliminato — 5 feature avevano ancora consumer reali (in `modules/` e, in un caso, dentro `features/economia/**` stesso) che leggevano i model migrati dal barrel invece che dalla feature; tutti reindirizzati (2 commit separati) prima della rimozione. `src/modules/` risultava già privo di residui strutturali delle feature migrate (nessuna directory/file orfano trovato) — l'unico lavoro reale era il reindirizzamento import, non pulizia di file. Pronta per la Fase 7.

---

### Fase 7 — Consolidamento del core

Aggiunta il 2026-08-13, esplicitamente **rimandata alla fine** su richiesta dell'utente: si esegue solo dopo che tutte le feature della Fase 6 sono migrate e testate.

**Obiettivo**: rendere reale il confine solo logico descritto in §3.2 — spostare `Character`/`CharacterSession` (con Prestavolto e Anagrafica, che restano campi sullo stesso schema), `User`, `auth`, `Location`, `Chat` (il trasporto) e i messaggi OnGame (`OnGameMessage`, `OnGameThread`) da `database/models/`, `modules/game/`, `modules/auth/` dentro `src/core/`.

**Non pianificata in dettaglio ora**: a differenza delle feature di Fase 6, qui non c'è un piano fase-per-fase pronto. `Character.ts` da solo è importato da decine di file in tutto il repo (ogni feature già migrata lo consuma) — il perimetro reale va ricognito con lo stesso pattern già rodato (2-3 agenti Explore in parallelo + un agente Plan di validazione) quando si arriva a questa fase, non anticipato ora. Aspettative realistiche:

- Stesso pattern di shim già usato per le feature: re-export da `database/models/index.ts` verso `@core/character/models/Character`, ecc., rimosso solo a fine fase.
- A differenza di una feature, `core/` non ha `manifest.ts`/flag/route proprie da montare — è puro spostamento di file e aggiornamento import, verificato con `dump-routes` (deve restare a diff zero) e `type-check`.
- Rischio più alto delle fasi precedenti per superficie di impatto (tocca praticamente ogni feature esistente), non per complessità del singolo spostamento.

**Criterio di uscita**: `src/modules/` (quanto resta dopo la Fase 6) svuotato, `database/models/index.ts` rimosso, `dump-routes` a diff zero, `type-check`/`build`/`lint:boundaries` puliti.

**Sotto-fasi** (4, sequenziali): 7.1 auth+User+CharacterSession → 7.2 Character → 7.3 Location → 7.4 Chat+ChatBackup+OnGame+WebSocket+Actions (la più grande/rischiosa, risolve 5 dei 6 punti di accoppiamento core↔feature trovati in ricognizione, via nuovi extension point Hook/Filter — pattern dependency-inversion già rodato dal bibliotecario in Fase 2). Diversamente dallo shim ipotizzato sopra, in pratica si è confermato che il pattern "nessuno shim, redirect diretto di tutti i consumer nello stesso set di commit" (già validato nella pulizia shim di Fase 6) funziona anche per il core — niente re-export transitorio da `database/models/index.ts`.

**7.1 — auth + User: fatta (2026-08-14)**. `check-boundaries.ts` già generico su tutto `src/core/**` (non hardcoded su `core/features/`/`core/extensions/`), nessuna modifica necessaria. Spostati `User`, `CharacterSession` e l'intero `modules/auth/` (18 file) dentro `core/auth/`, stessa struttura interna. Eliminati `modules/auth/app.ts`+`index.ts`+`middleware/errorHandler.ts` (entrypoint standalone mai referenziato dal server reale, zero riferimenti confermati in tutto il repo). Primo caso in cui si corregge un bug invece di preservarlo (decisione esplicita dell'utente): `SessionCleanupJob` non veniva mai avviato — collection `character_sessions` cresceva senza pulizia — ora agganciato a `server.ts` dopo `db.connect()`. Asimmetria JWT issuer/audience fra `core/auth/middleware/auth.ts` e `modules/game/middleware/auth.ts` non toccata, rimandata alla Fase 7.4 quando entrambi convivono in core. `type-check`/`build`/`lint:boundaries` puliti, `dump-routes` diff zero. Testato E2E su Docker: login, selezione personaggio, refresh token, `/auth/session`, `/auth/effective-permissions`, logout (401 post-logout confermato) — tutti sul percorso reale, non JWT sintetico. Confermato nei log di boot: "Starting session cleanup job".

**7.2 — Character: fatta (2026-08-14)**. Spostato `database/models/Character.ts` (1020 righe) in `core/character/models/Character.ts`, ~60 consumer reindirizzati (barrel, deep alias, dynamic import, `require()`, import relativi — tutti i pattern trovati in ricognizione, incluso `core/auth/` stesso che importava Character dal barrel). Risolto l'unico vero punto di accoppiamento core↔feature: il blocco di auto-creazione ticket `character_approval` nel `pre('save')` (import statico di `@features/tickets/api`) è diventato l'extension point `'character.playerStatus.pending'` (nuovo `HookMap`), emesso da un nuovo `post('save')` dopo la persistenza reale — stesso pattern `WeakSet` pre/post-save già usato da `features/forum/models/ForumPost.ts` per un problema identico (agire su una transizione rilevata in pre-save ma con effetto che deve girare dopo il salvataggio). La logica relocata vive in `features/tickets/extensions/onCharacterPendingApproval.ts`, registrata dal manifest.

Il test E2E ha scoperto **due bug preesistenti, mai innescati fino ad ora** — entrambi corretti su decisione esplicita dell'utente (non il default "preserva" seguito nel resto del refactor): il payload di `Ticket.create()` passava `createdBy` come oggetto annidato `{characterId, characterName, characterAvatar}` invece dell'`ObjectId` + `createdByName` separato richiesti dallo schema reale — la creazione falliva **sempre**, silenziosamente catturata dal try/catch, e anche il controllo duplicati (`'createdBy.characterId'`) non ha mai funzionato per lo stesso motivo. Corretto: `createdBy: characterId, createdByName: characterName`. Il secondo: `NotificationService.notifyNewTicket()` riceveva `priority: 'normal'`, letterale non valido per l'enum `ticketPriority` (`low|medium|high|critical`) che quel campo alimenta internamente — la notifica staff falliva **sempre**, sempre silenziosamente. Corretto: `priority: ticket.priority`. Net effect prima della fix: "auto-crea ticket + notifica staff alla submission di un personaggio" non ha mai funzionato, in nessuna versione precedente di questo codice.

Verificato con un test end-to-end reale (non solo statico): un mini-bootstrap che registra `tickets` su `featureRegistry`+`extensions` (le due parti di `bootstrapFeatures()` rilevanti, senza il mount delle route) e chiama `Character.save()` per davvero contro MongoDB — confermato ticket creato con i campi giusti, notifica salvata con `ticketPriority: 'medium'`, e nessun ticket duplicato su una seconda transizione con un ticket già esistente. L'endpoint HTTP reale (`POST /game/characters/:id/submit`) non è stato usabile per il test: il personaggio di test esistente falliva la validazione "background completo" del wizard, una condizione preesistente del fixture, non legata a questo spostamento. `type-check`/`build`/`lint:boundaries` puliti, `dump-routes` diff zero.

**Nota sul feature flag**: l'hook è ora gated da `FeatureFlagService.isEnabled('tickets')` (via `ExtensionRegistry.emit()`) — se `tickets_enabled` viene disattivato da un admin, il ticket di approvazione smette di essere creato (`tickets_enabled` default `true`, quindi nessuna differenza osservabile finché nessuno lo disattiva esplicitamente). Comportamento intrinseco del meccanismo Hook già approvato per l'intera Fase 7, non specifico di questo punto — coerente con "se le route di una feature sono spente, perché un suo effetto collaterale dovrebbe restare attivo".

**7.3 — Location: fatta (2026-08-14)**. Spostato `database/models/Location.ts` in `core/location/models/Location.ts`, ~20 consumer reindirizzati. Nessun accoppiamento core↔feature da risolvere (a differenza di 7.2): gli unici `mongoose.model()` string-lookup dentro Location.ts puntano a `GamingSession`, ancora un model core, non una feature — conferma la caratterizzazione del piano generale ("pulita, meccanica").

Il punto segnalato dal piano generale ("possibile duplicazione fra `LocationController.checkLocationAccess` e `LocationService.checkLocationAccess`") si è confermato reale ma non banale: le due versioni non erano equivalenti. `LocationController` applicava il gate su `settings.visible` come primo controllo sempre valido — comportamento corretto, dato che i suoi 3 call site fanno `Location.findById` senza pre-filtro, quel gate è l'unico punto che nega l'accesso a una location non visibile. `LocationService` non aveva questo gate esplicito, ma il suo unico call site (`getAccessibleLocations`) pre-filtra già via query Mongo su `settings.visible: true`, rendendolo lì un no-op. Su richiesta esplicita dell'utente ("dagli un senso, e rimuoviamo i duplicati") le due versioni sono state consolidate in `core/location/services/checkLocationAccess.ts`, riprendendo la struttura di `LocationController` (l'unica realmente esposta a location non pre-filtrate) e correggendo due bug reali che aveva: crash su `location.settings` mancante (gestito esplicitamente, come già faceva `LocationService`, per le location legacy) e mancata verifica di `access.ownerType === 'character'` prima di confrontare `ownerId` (un owner di tipo diverso con lo stesso id avrebbe passato l'accesso). Verificato che la correzione non cambia comportamento per il call path di `LocationService`: l'edge case teorico (query che include un doc con `settings` presente ma `settings.visible` assente) risultava già in un `return false` nella versione originale di `LocationService`, non una regressione introdotta qui.

Testato con 8 casi via chiamata diretta della funzione pura (nessun DB necessario, a differenza del test Hook-based di 7.2) più un fumo su HTTP reale (`GET /game/locations`, `GET /game/locations/:id/access`) sul percorso `LocationService`/`LocationController` autentico. `type-check`/`build`/`lint:boundaries` puliti, `dump-routes` diff zero. Rimossa anche una `require()` ridondante in `ChatController.ts` (Location era già importata staticamente in testa al file).

---

### Fase 8 — Frontend (branch separato, fuori da questo piano)

Non toccare in questo branch. Da pianificare dopo:

- `apps/management`: generalizzare `featureFlagsStore` da due flag hardcoded a mappa dinamica letta da `/admin/system/feature-flags`; `Sidebar.tsx:26` ha già il campo `featureFlag`, va tipizzato su `FeatureKey`.
- `apps/game`: registry di componenti per feature (l'integrazione bot ↔ chat lato UI).
- Next.js Pages Router non supporta registrazione dinamica di route: i file pagina restano statici, si gatta la visibilità e il rendering.

---

## 6. Rischi

| Rischio | Gravità | Mitigazione |
|---|---|---|
| **Nessuna suite di test** — 3 file in tutto il repo | Alta | `dump-routes` + `type-check` a ogni fase. Ma il compilatore non verifica il comportamento. **Raccomandazione: prima della Fase 4, aggiungere vitest + supertest e 15-20 test di integrazione sui path critici** (login, selezione personaggio, invio messaggio, ricerca documenti, CRUD corporazioni). È l'investimento con il ROI più alto dell'intero piano |
| Branch di lunga durata → conflitti su file da 3000 righe | Alta | Mergiare ogni fase in master appena verde. Nessuna fase deve durare più di qualche giorno |
| Ordine di registrazione dei model Mongoose | Media | Mantenere `database/models/index.ts` come barrel/shim durante tutta la transizione. Rimuoverlo solo alla fine |
| Import ciclici fra feature | Media | Script di Fase 5. Anticiparlo se emergono problemi prima |
| Regressione silenziosa in produzione | Media | Fasi 2 e 3 riguardano feature **spente in produzione**: rischio quasi nullo. Le fasi successive vanno su feature attive — verificare gli health check post-deploy |
| `_moduleAliases` disallineato da `tsconfig.paths` | Media | Ogni alias nuovo va aggiunto in **entrambi**. Rompe solo in produzione |
| Il refactor si ferma a metà | Media | Ogni fase ha valore autonomo. Anche fermandosi alla Fase 3, si è guadagnata la pulizia dei node_modules, il registry e due feature isolate |

---

## 7. Invarianti — non violare mai

Oltre alle 7 regole di `.claude/rules/00-critical.md`, che restano tutte valide:

1. **Nessun path HTTP cambia.** Il frontend è già scritto contro quelli. Se `dump-routes` mostra un diff, è un bug, non un miglioramento.
2. **Il core non importa mai una feature.** Se serve, si crea un extension point.
3. **Un hook non rompe mai il flusso del core.** Errore isolato, loggato, si prosegue.
4. **Chi apre lo stream lo chiude.** Nessun handler di feature chiama `res.end()` su uno stream che non ha aperto.
5. **404, non 403**, per una feature spenta.
6. **Registrazione a compile-time.** Nessun `require()` dinamico, nessuno scanning del filesystem, nessun caricamento a runtime.
7. **Una feature per PR** dalla Fase 4 in poi.

---

## 8. Checklist per ogni feature migrata

- [ ] `manifest.ts` con `key`, `title`, e `flag` se disattivabile
- [ ] `api.ts` che espone **solo** ciò che serve alle altre feature
- [ ] Model spostati sotto `models/`, re-export shim in `database/models/index.ts` con commento di deprecazione
- [ ] Controller game e admin unificati sotto la feature, route separate per scope
- [ ] Permessi dichiarati nel manifest, rimossi da `config/permissions/`
- [ ] Event handler Redis dichiarati nel manifest, rimossi da `RedisSubscriber`
- [ ] Cron dichiarati nel manifest
- [ ] Nessun import da `@modules/` residuo
- [ ] `dependsOn` dichiarato per ogni feature da cui si importa
- [ ] `npm run type-check` verde
- [ ] `dump-routes` diff vuoto
- [ ] Smoke test manuale documentato nella PR: cosa è stato provato, con quale flag
- [ ] `.claude/rules/20-backend.md` aggiornato se il pattern cambia

---

## 9. Nota per chi esegue

Due avvertenze sul contesto di questo codebase, entrambe verificate:

**La regola scritta in `.claude/rules/20-backend.md` è in drift.** Dice *"Controller statici, logica di business nei service. I controller non fanno query dirette."* La realtà è 84 controller contro 33 service, con `ChatController` a 55 query dirette. Non fidarsi della rule: leggere il codice. La rule va corretta — idealmente nello stesso commit in cui si tocca l'area, come prescrive `CLAUDE.md`.

**Questo refactor non risolve il problema del modello dati.** Sposta il codice, non scioglie le `ref` incrociate fra collection. Se durante la Fase 4 emerge che le corporazioni non si staccano davvero da `CharacterFinances` e dal forum, quella è un'informazione preziosa: significa che il confine va rinegoziato lì, non che il piano è sbagliato. Annotarlo e portarlo avanti, non forzare la separazione a costo di duplicare logica.
