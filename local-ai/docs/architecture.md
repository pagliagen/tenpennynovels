# Architettura

## Principi

1. **Indipendenza totale**: local-ai non conosce il gioco. Non accede al suo database, non chiama le sue API, non importa i suoi tipi. Riceve dati grezzi, li elabora, restituisce risultati.

2. **Contesto fornito dal caller**: chi chiama local-ai deve includere tutto il contesto necessario nella richiesta. local-ai non va a cercare nulla autonomamente.

3. **Callback asincrono**: per operazioni lunghe (es. generazione bot response), il caller fornisce una callback URL. local-ai genera la risposta e la invia alla callback. Il caller non resta in attesa.

4. **Multi-client**: il gateway non distingue "locale" da "produzione". Ogni chiamante è un client con la sua API key, i suoi permessi, i suoi limiti. La stessa istanza può servire più consumatori.

5. **Standalone**: `docker compose up -d` avvia tutto. Nessuna dipendenza esterna.

## Flusso dati

```
caller (unified-backend, CLI, qualsiasi client)
  │
  │  HTTP + X-API-Key + X-Client-Id
  │  (opzionale: HMAC signature)
  │
  ▼
┌─────────────────────────────────────┐
│  Gateway (:9000)                    │
│  1. Autentica client (API key)      │
│  2. Verifica HMAC (se configurato)  │
│  3. Rate limit (per-client)         │
│  4. Verifica permessi (per-servizio)│
│  5. Valida payload (Zod)            │
│  6. Proxy al servizio backend       │
└──────────┬──────────────────────────┘
           │
     ┌─────┼─────┐
     ▼     ▼     ...
  BotAI   Q&A
  :8080   :8090
     │     │
     ▼     ▼
   Ollama (:11434)
   mistral:7b-instruct
```

## Struttura del progetto

```
local-ai/
├── gateway/                  # Entry point unico
│   └── src/
│       ├── index.ts          # Avvio server (porta 9000)
│       ├── app.ts            # Factory Express
│       ├── router.ts         # Routing + validation + proxy
│       ├── clients.ts        # Registry multi-client
│       ├── services.ts       # Registry servizi backend
│       └── middleware/
│           ├── apiKey.ts     # Autenticazione client
│           ├── hmac.ts       # Verifica HMAC (opzionale per-client)
│           ├── rateLimit.ts  # Rate limiting per-client
│           └── validate.ts   # Zod schemas per ogni endpoint
│
├── services/
│   ├── botai/                # NPC Bot — genera risposte RP
│   │   └── src/
│   │       ├── routes.ts     # POST /respond, CRUD /bots, POST /bots/generate
│   │       ├── agent/        # OllamaAgent, PromptBuilder, ResponseFormatter
│   │       ├── queue/        # RequestQueue (p-queue, concurrency 1)
│   │       ├── memory/       # MemoryStore, RelationshipStore
│   │       ├── models/       # Bot, Memory, Relationship (Mongoose)
│   │       └── callback/     # CallbackSender (retry con backoff)
│   │
│   └── qa/                   # Q&A RAG
│       └── src/
│           ├── routes.ts     # POST /ask
│           └── services/     # RAGPipeline, OllamaChat
│
├── shared/                   # Codice condiviso
│   ├── ollama.ts             # Client Ollama singleton
│   ├── logger.ts             # Winston logger factory
│   ├── health.ts             # Health endpoint standard/stub
│   └── types.ts              # Tipi condivisi
│
├── docs/                     # Questa documentazione
├── docker-compose.yml        # Stack completo standalone
├── .dockerignore             # Esclusioni build context Docker
├── clients.json              # Registry client (segreti, non committato)
├── clients.json.example      # Template client registry
├── .env.example              # Template variabili
├── ngrok.yml                 # Config tunnel
├── Makefile                  # Comandi rapidi
├── tsconfig.base.json        # Config TypeScript condivisa
└── package.json              # Workspace monorepo
```

## Scelte tecniche

### Perche Ollama e non un'API cloud

- **Costo zero**: nessun abbonamento, nessun costo per token
- **Privacy**: i dati del gioco non lasciano la macchina locale
- **Nessun rate limit esterno**: il limite e solo la potenza hardware
- **Offline-capable**: funziona senza connessione internet (eccetto ngrok per l'esposizione)

### Perche un gateway e non chiamate dirette ai servizi

- **Punto di ingresso unico**: un solo URL/porta da configurare
- **Sicurezza centralizzata**: autenticazione, rate limiting, validazione in un posto solo
- **Estensibile**: aggiungere un servizio = una riga nel registry + cartella + docker-compose entry
- **Trasparente**: i servizi backend non sanno nulla di autenticazione o rate limiting

### Perche callback e non polling

- **Efficienza**: il caller non tiene connessioni aperte
- **Resilienza**: se la generazione impiega 10 secondi, il caller non va in timeout
- **Disaccoppiamento**: local-ai decide quando e pronto, non il caller

### Perche MongoDB separato

Il MongoDB di local-ai (porta 27030) e completamente isolato dal database del gioco. Contiene solo dati interni: definizioni bot, memorie, relazioni. Nessun rischio di contaminazione o dipendenza circolare.

### Perche multi-stage build Docker

Ogni servizio usa un **multi-stage build**:

1. **Stage builder**: installa tutte le dipendenze (incluse devDependencies come `typescript`), compila TypeScript
2. **Stage produzione**: installa solo le dipendenze runtime, copia il codice compilato dallo stage builder

Il build context nel `docker-compose.yml` e la root di `local-ai/` (non la cartella del singolo servizio) per permettere l'accesso a `shared/` e `tsconfig.base.json`. Un symlink `/app/node_modules → /app/services/<nome>/node_modules` consente a TypeScript di risolvere i moduli importati dai file in `shared/`.

### Memoria contestuale e relazioni

Il servizio BotAI mantiene un sistema di **memoria** e **relazioni** che evolve ad ogni interazione, rendendo i bot progressivamente piu "umani".

**Memoria** — Ogni interazione viene salvata con:

- **tipo**: `interaction` (dialogo), `observation` (qualcosa che il bot nota), `emotional` (reazione emotiva forte), `event` (avvenimento rilevante)
- **importanza** (0-100): determina la priorita nel recupero
- **locationId**: associa il ricordo al luogo in cui e avvenuto

Il metodo `getContextualMemories()` seleziona i ricordi piu rilevanti combinando tre fonti:

1. Ricordi recenti con il personaggio che sta parlando (max 3)
2. Ricordi importanti globali (importanza >= 70, max 3)
3. Ricordi legati al luogo corrente (max 2)

I duplicati vengono eliminati. Il risultato e un set compatto di ricordi che il PromptBuilder inserisce nel system prompt.

**Relazioni** — Per ogni personaggio con cui il bot interagisce, si tracciano:

- **trust** (0-1): quanto il bot si fida. Influenza apertura vs cautela
- **familiarity** (0-1): quanto si conoscono. Cresce automaticamente ad ogni interazione
- **sentiment** (-1 a +1): simpatia vs antipatia. Influenza tono e cordialita
- **interactionCount**: numero di incontri
- **significantEvents**: fino a 5 eventi importanti ricordati (FIFO)

Il PromptBuilder usa questi dati per generare istruzioni precise: con un personaggio fidato il bot si apre, con uno sconosciuto resta riservato, con uno sgradito diventa freddo o sarcastico.

**Filosofia "meno struttura nel modello, piu qualita nel prompt"** — Un modello 7B come Mistral non riesce a sfruttare campi strutturati complessi (assi psicologici, ferite interiori codificate). La strategia adottata e codificare tutta la complessita psicologica nel `systemPrompt`: un testo ricco in linguaggio naturale (300+ parole) generato da Ollama stesso durante la creazione del bot, che descrive identita, psicologia, reazioni emotive, segreti, abitudini e stile di parlata come istruzioni per un attore.

### Coda richieste (p-queue)

Ollama puo processare una sola richiesta alla volta. Senza serializzazione, richieste parallele da piu chat causerebbero timeout o errori.

Il servizio BotAI usa `p-queue` con `concurrency: 1`. Ogni chiamata a `POST /botai/respond`:

1. Valida il bot e risponde immediatamente `202 Accepted` con lo stato della coda
2. Inserisce la generazione nella coda
3. Quando tocca, processa con Ollama e invia il risultato alla callback URL

La risposta 202 include `queue: { pending, size }` per visibilita:

- `pending`: richieste in elaborazione (0 o 1)
- `size`: richieste in attesa

Non esiste modalita sincrona. `callback` e obbligatorio.

### Perche Zod per la validazione

- Type-safe: gli schemi sono TypeScript, errori di compilazione se il payload cambia
- Descrittivo: messaggi di errore leggibili con path esatti dei campi invalidi
- Nel gateway: le richieste malformate vengono rifiutate prima di raggiungere i servizi
