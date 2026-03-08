# Sicurezza

## Modello di autenticazione multi-client

Non esiste una distinzione "locale vs produzione" a livello di gateway. Ogni chiamante e un **client** registrato, identificato dalla sua API key.

### Client registry

I client sono definiti nel file `clients.json` (array JSON, montato nel gateway come volume Docker):

```json
[
  {
    "id": "tpn-prod",
    "name": "TenPennyNovels VPS",
    "apiKey": "a1b2c3d4...",
    "hmacSecret": "e5f6g7h8...",
    "permissions": ["botai", "qa", "item-image-gen", "location-image-gen", "avatar-gen"],
    "rateLimit": { "maxPerMinute": 30 }
  },
  {
    "id": "tpn-dev",
    "name": "Local Development",
    "apiKey": "x9y8z7w6...",
    "permissions": ["botai", "qa", "item-image-gen", "location-image-gen", "avatar-gen"],
    "rateLimit": { "maxPerMinute": 120 }
  }
]
```

Ogni client ha:

| Campo | Obbligatorio | Descrizione |
|-------|-------------|-------------|
| `id` | Si | Identificativo unico del client |
| `name` | Si | Nome leggibile |
| `apiKey` | Si | Chiave segreta per autenticazione |
| `hmacSecret` | No | Se presente, le richieste devono essere firmate HMAC |
| `permissions` | Si | Array di servizi a cui il client puo accedere |
| `rateLimit.maxPerMinute` | Si | Numero massimo di richieste al minuto |

### Flusso di autenticazione

```
Richiesta in arrivo
       │
       ▼
  X-API-Key presente?
  NO → 401 Missing API key
  SI ▼
       │
  API key corrisponde a un client?
  NO → 401 Invalid API key
  SI ▼
       │
  X-Client-Id fornito? (opzionale)
  SI → corrisponde alla key?
       NO → 401 Client mismatch
  ▼
       │
  Client ha hmacSecret?
  SI → X-HMAC-Signature valida?
       NO → 401 Invalid signature
       SI → Timestamp entro 5 min?
            NO → 401 Expired
  NO → skip (HMAC non richiesto per questo client)
  ▼
       │
  Rate limit superato?
  SI → 429 Too many requests
  ▼
       │
  Client ha permesso per questo servizio?
  NO → 403 Forbidden
  ▼
       │
  Payload valido (Zod)?
  NO → 400 Validation failed
  ▼
       │
  ✅ Proxy al servizio backend
```

### Headers richiesti

| Header | Obbligatorio | Descrizione |
|--------|-------------|-------------|
| `X-API-Key` | Si | API key del client |
| `X-Client-Id` | No | ID del client (cross-check con la key) |
| `X-HMAC-Signature` | Dipende | Firma HMAC-SHA256 (se il client ha `hmacSecret`) |
| `X-HMAC-Timestamp` | Dipende | Timestamp in ms per anti-replay |

## HMAC Signing

L'HMAC e **opzionale per-client**. Se il client ha `hmacSecret` configurato, ogni richiesta deve essere firmata.

### Algoritmo

```
signature = HMAC-SHA256(timestamp + "." + JSON.stringify(body), hmacSecret)
```

Dove:
- `timestamp` = `Date.now().toString()` (millisecondi)
- `body` = body della richiesta serializzato come JSON
- `hmacSecret` = segreto condiviso tra caller e gateway

### Anti-replay

Il gateway rifiuta richieste con timestamp che differisce di piu di **5 minuti** dall'ora corrente. Questo impedisce il riutilizzo di richieste intercettate.

### Timing-safe comparison

La verifica della firma usa `crypto.timingSafeEqual` per prevenire timing attacks.

## Rate limiting

Ogni client ha il suo rate limiter indipendente, configurato tramite `rateLimit.maxPerMinute`.

- I limiti sono per-client, non per-IP
- Le finestre sono di 60 secondi (rolling)
- Headers standard `RateLimit-*` nelle risposte

Valori consigliati:

| Tipo client | maxPerMinute | Ragionamento |
|-------------|-------------|--------------|
| Produzione | 30 | Traffico reale, protegge Ollama |
| Sviluppo | 120 | Testing rapido senza blocchi |
| Terze parti | 10 | Accesso limitato |

## Validazione input

Tutti i payload POST sono validati con schemi **Zod** nel gateway, prima che la richiesta raggiunga i servizi backend:

- `POST /botai/respond` → `botRespondSchema`
- `POST /botai/bots` → `botCreateSchema`
- `POST /botai/bots/generate` → `botGenerateSchema`
- `POST /qa/ask` → `qaAskSchema`
- `POST /*/generate` → `imageGenSchema`

Richieste malformate ricevono `400` con dettagli strutturati:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "path": "context.actions.0.content", "message": "Required" }
  ]
}
```

## Isolamento dei servizi

I servizi backend (botai, qa, ecc.) sono esposti solo sulla rete Docker interna (`expose`, non `ports`). Non sono raggiungibili dall'esterno. Solo il gateway e esposto sulla porta 9000.

## Generazione chiavi

```bash
# API key (32 byte hex = 64 caratteri)
openssl rand -hex 32

# HMAC secret
openssl rand -hex 32
```

## Checklist di sicurezza

- [ ] `clients.json` configurato con chiavi generate (`openssl rand -hex 32`)
- [ ] Nessuna chiave di default (`CHANGE_ME`) lasciata in `clients.json`
- [ ] ngrok configurato con URL persistente (piano a pagamento consigliato)
- [ ] CORS_ORIGIN ristretto se il gateway e accessibile da browser
- [ ] I servizi backend non espongono porte all'esterno (solo `expose`)
- [ ] Le callback URL usano HTTPS
