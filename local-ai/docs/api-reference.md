# API Reference

Tutti gli endpoint passano attraverso il gateway sulla porta 9000. Le richieste richiedono `X-API-Key` (e opzionalmente `X-Client-Id`, `X-HMAC-Signature`, `X-HMAC-Timestamp`).

---

## Health

### `GET /health`

Endpoint pubblico (no autenticazione). Controlla lo stato di tutti i servizi.

**Risposta (con servizi image-gen avviati):**

```json
{
  "status": "healthy",
  "services": {
    "gateway": { "status": "up" },
    "botai": { "status": "up", "service": "botai", "mongodb": "connected" },
    "qa": { "status": "up", "service": "qa" },
    "item-image-gen": { "status": "stub", "service": "item-image-gen" },
    "location-image-gen": { "status": "stub", "service": "location-image-gen" },
    "avatar-gen": { "status": "stub", "service": "avatar-gen" },
    "ollama": { "status": "up", "models": ["mistral:7b-instruct"] }
  }
}
```

**Risposta tipica (senza profilo `image-gen`):**

```json
{
  "status": "degraded",
  "services": {
    "gateway": { "status": "up" },
    "botai": { "status": "up", "service": "botai", "mongodb": "connected" },
    "qa": { "status": "up", "service": "qa" },
    "item-image-gen": { "status": "down" },
    "location-image-gen": { "status": "down" },
    "avatar-gen": { "status": "down" },
    "ollama": { "status": "up", "models": [] }
  }
}
```

Lo `status` globale e `"healthy"` se tutti i servizi sono `up` o `stub`. Se uno o piu servizi sono `down` (es. gli stub image-gen non avviati — sono nel profilo Docker `image-gen`), lo status diventa `"degraded"`. I servizi image-gen si avviano solo con `docker compose --profile image-gen up -d`.

---

## BotAI

### `POST /botai/respond`

Genera una risposta NPC. L'endpoint e **sempre asincrono**: risponde immediatamente `202 Accepted` e processa la richiesta in background. Il campo `callback` e **obbligatorio**.

La gestione del turno (quando il bot deve rispondere) e responsabilita del caller — local-ai riceve il contesto e risponde, senza decidere "se" rispondere.

Le richieste vengono inserite in una **coda** con concurrency 1 (Ollama gestisce una richiesta alla volta). Se arrivano richieste parallele da piu chat, vengono elaborate in sequenza.

**Request:**

```json
{
  "requestId": "uuid-generato-dal-caller",
  "bot": {
    "id": "bot-id-in-local-ai",
    "name": "Detective Morrison"
  },
  "context": {
    "location": {
      "id": "loc-abc123",
      "name": "The Rusty Anchor Pub",
      "description": "Un pub fumoso nel quartiere portuale..."
    },
    "actions": [
      {
        "characterId": "char-002",
        "characterName": "Mary",
        "content": "*si avvicina al bancone e ordina una birra*",
        "timestamp": "2026-03-08T10:00:00Z"
      },
      {
        "characterId": "char-001",
        "characterName": "John Smith",
        "content": "*entra nel pub* Buonasera, avete del whisky?"
      }
    ],
    "presentCharacters": [
      { "id": "char-001", "name": "John Smith" },
      { "id": "char-002", "name": "Mary" },
      { "id": "bot-char-003", "name": "Detective Morrison" }
    ]
  },
  "callback": {
    "url": "https://api.tenpennynovels.it/game/webhooks/bot-response",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer webhook-secret",
      "Content-Type": "application/json"
    }
  }
}
```

Il campo `actions` contiene le azioni recenti in ordine cronologico (almeno 1 richiesta). Il bot risponde al contesto complessivo. Memoria e relazioni vengono aggiornate in base all'ultimo personaggio nell'array.

**Risposta immediata `202`:**

```json
{
  "success": true,
  "requestId": "uuid",
  "status": "queued",
  "queue": { "pending": 0, "size": 2 }
}
```

- `queue.pending`: richieste attualmente in elaborazione da Ollama
- `queue.size`: richieste in attesa nella coda

Il bot processa in background e invia il risultato alla callback URL:

```json
{
  "requestId": "uuid",
  "botId": "bot-id",
  "botName": "Detective Morrison",
  "botCharacterId": "bot-char-003",
  "locationId": "loc-abc123",
  "response": "*alza lo sguardo* Whisky? Certo.",
  "metadata": {
    "model": "mistral:7b-instruct",
    "tokensUsed": 847,
    "processingMs": 3200
  }
}
```

Gli ID (`botCharacterId`, `locationId`, ecc.) sono **stringhe opache**: local-ai li riceve dal contesto, li conserva, li restituisce nella callback. Non li interpreta.

#### Memoria e relazioni

Il servizio BotAI gestisce automaticamente la **memoria** e le **relazioni** di ogni bot:

- **Memoria**: ogni interazione viene salvata con tipo (interaction, observation, emotional, event), importanza (0-100) e luogo. Il sistema recupera automaticamente i ricordi piu rilevanti per contesto.
- **Relazioni**: il bot traccia fiducia, familiarita e sentimento verso ogni personaggio con cui interagisce. Questi valori influenzano direttamente il tono e il comportamento nelle risposte.
- **Personaggi sconosciuti**: quando il bot interagisce con un personaggio mai incontrato, il prompt lo istruisce a comportarsi come farebbe con uno sconosciuto, coerentemente con la sua personalita.

### `POST /botai/bots`

Crea un bot manualmente.

```json
{
  "name": "Detective Morrison",
  "gender": "male",
  "publicDescription": "Un uomo sulla cinquantina, cappotto logoro e cappello a tesa larga...",
  "personality": {
    "traits": ["cinico", "osservatore", "solitario"],
    "speech_style": "frasi brevi, tono asciutto",
    "background": "Ex poliziotto, ora investigatore privato",
    "coreValues": ["giustizia", "lealta", "indipendenza"]
  },
  "systemPrompt": "Sei Detective Morrison, un investigatore privato..."
}
```

I campi `gender`, `publicDescription` e `coreValues` sono opzionali ma fortemente consigliati: arricchiscono significativamente la qualita delle risposte.

### `POST /botai/bots/generate`

Genera un bot con Ollama a partire da una descrizione. L'endpoint e **sempre asincrono**: risponde `202 Accepted` e processa in background. Il campo `callback` e **obbligatorio**.

Il campo `location` e opzionale ma consigliato: il personaggio generato sara coerente col luogo in cui opera.

**Request:**

```json
{
  "requestId": "gen-1234567890",
  "description": "Un barista irlandese, veterano di guerra, con un segreto oscuro",
  "location": {
    "name": "The Rusty Anchor Pub",
    "description": "Un pub fumoso nel quartiere portuale di Londra"
  },
  "style": "vittoriano",
  "locale": "it",
  "callback": {
    "url": "https://api.tenpennynovels.it/game/webhooks/bot-generated",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer webhook-secret",
      "Content-Type": "application/json"
    }
  }
}
```

**Risposta immediata `202`:**

```json
{
  "success": true,
  "requestId": "gen-1234567890",
  "status": "queued",
  "queue": { "pending": 0, "size": 1 }
}
```

**Callback payload:**

```json
{
  "requestId": "gen-1234567890",
  "type": "bot-generated",
  "data": {
    "_id": "665abc...",
    "name": "Padraig O'Sullivan",
    "gender": "male",
    "publicDescription": "Un uomo sulla sessantina...",
    "personality": { "traits": [...], "speech_style": "...", "background": "..." },
    "systemPrompt": "Sei Padraig O'Sullivan...",
    "isActive": true
  }
}
```

### `GET /botai/bots`

Lista tutti i bot attivi.

### `GET /botai/bots/:id`

Dettagli di un bot specifico.

### `PUT /botai/bots/:id`

Aggiorna un bot.

### `DELETE /botai/bots/:id`

Disattiva un bot (soft delete: `isActive: false`).

---

## Q&A

### `POST /qa/ask`

Il caller fornisce la domanda e il contesto (chunk di testo). Il servizio Q&A non cerca nulla.

**Request:**

```json
{
  "question": "Come funzionano le armi da fuoco nel gioco?",
  "context": [
    {
      "heading": "Armi da Fuoco",
      "content": "Le armi da fuoco richiedono un tiro su Firearms...",
      "source": { "documentId": "abc", "slug": "armi-da-fuoco" }
    },
    {
      "heading": "Combattimento",
      "content": "Durante il combattimento...",
      "source": { "documentId": "def", "slug": "combattimento" }
    }
  ],
  "options": {
    "maxTokens": 500,
    "locale": "it"
  }
}
```

**Risposta:**

```json
{
  "success": true,
  "answer": "Le armi da fuoco richiedono un tiro su Firearms [1]...",
  "sources": [
    { "heading": "Armi da Fuoco", "slug": "armi-da-fuoco", "used": true },
    { "heading": "Combattimento", "slug": "combattimento", "used": false }
  ],
  "metadata": {
    "model": "mistral:7b-instruct",
    "tokensUsed": 412
  }
}
```

---

## Image Generation (stub)

### `POST /item-image-gen/generate`
### `POST /location-image-gen/generate`
### `POST /avatar-gen/generate`

Tutti rispondono `501 Not Implemented` con un campo `todo` che descrive l'implementazione futura.

### `GET /*/styles`

Lista gli stili supportati (placeholder).

### `GET /location-image-gen/moods`

Lista i mood supportati per location.

### `POST /avatar-gen/regenerate`

Stub per rigenerazione con seed fissato. Risponde `501`.

---

## Test UI (servizio separato)

Il test UI e un servizio isolato (React + Express) che gira sulla porta `3100`. Si avvia solo con il profilo Docker `test`:

```bash
docker compose --profile test up -d test-ui
```

### Endpoint del servizio test-ui

| Endpoint | Descrizione |
|----------|-------------|
| `GET /` | App React (generazione bot + chat) |
| `GET /api/events` | SSE — riceve risposte in real-time |
| `GET /api/config` | Config (gateway URL, callback URL, API key) |
| `POST /api/callback` | Riceve callback da BotAI, le pusha via SSE |

Il flusso: il browser chiama direttamente il gateway per le API (`/botai/*`), passando come callback URL l'endpoint del test-ui (`http://test-ui:3100/api/callback`). Quando BotAI completa l'elaborazione, invia il risultato alla callback, che viene pushata al browser via SSE.

---

## Codici di errore comuni

| HTTP | Significato |
|------|-------------|
| 200 | Successo |
| 202 | Accettato (elaborazione asincrona) |
| 400 | Payload invalido (validazione Zod fallita) |
| 401 | API key mancante, invalida, o HMAC non valido |
| 403 | Client senza permesso per il servizio richiesto |
| 404 | Risorsa non trovata (es. bot ID inesistente) |
| 429 | Rate limit superato |
| 501 | Non implementato (servizi stub) |
| 502 | Servizio backend non raggiungibile |
| 503 | Gateway degradato (uno o piu servizi down) |
