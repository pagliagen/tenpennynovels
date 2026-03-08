# Local AI Platform — Documentazione

Piattaforma AI locale indipendente per TenPennyNovels.

## Indice

1. [Architettura](architecture.md) — Principi fondamentali, struttura, flusso dati, coda richieste, test UI
2. [Sicurezza](security.md) — Autenticazione multi-client, HMAC, rate limiting, validazione
3. [API Reference](api-reference.md) — Contratti, endpoint, payload, risposte (tutte asincrone)
4. [Setup e Sviluppo Locale](setup.md) — Installazione, configurazione, test UI interattivo
5. [Deployment](deployment.md) — Messa in produzione, ngrok, integrazione con il VPS

## Principio fondamentale

```
local-ai NON SA NULLA del gioco.
NON ha accesso al database del gioco.
NON chiama il game-backend.
NON importa tipi o modelli da unified-backend.

Il mondo esterno gli dice cosa fare, lui lo fa.
```

## Caratteristiche principali

- **Sempre asincrono**: `POST /botai/respond` e `POST /botai/bots/generate` rispondono `202 Accepted` e processano in background. Il risultato arriva via callback
- **Coda richieste**: p-queue con concurrency 1 serializza le richieste a Ollama
- **Memoria e relazioni**: ogni bot ricorda le interazioni passate e modula il comportamento
- **Test UI separato**: servizio React + Express su `http://localhost:3100` (avviabile con `--profile test`)
- **Multi-client**: autenticazione per API key con permessi e rate limit per-client

## Stato dei servizi

| Servizio | Porta | Stato |
|----------|-------|-------|
| Gateway | 9000 | Attivo |
| BotAI | 8080 | Attivo |
| Q&A | 8090 | Attivo |
| Item Image Gen | 8100 | Stub (501) |
| Location Image Gen | 8110 | Stub (501) |
| Avatar Gen | 8120 | Stub (501) |
| Test UI | 3100 | Profilo `test` |
