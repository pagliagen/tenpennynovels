---
name: docker-services
description: Manage Docker services: start, stop, restart, rebuild, logs, status. Use when the user asks to restart backend, start services, rebuild containers, check logs, stop Docker, or any Docker/container operation.
user-invocable: true
---

## Overview

Gestisce i servizi Docker del progetto TenPennyNovels. Interpreta richieste in linguaggio naturale (italiano o inglese) e le traduce nei comandi Docker Compose corretti.

Tutti i comandi vanno eseguiti dalla root del progetto.

## Stack

### Principale (`docker-compose.yml` in root)

| Servizio | Container | Porta |
|----------|-----------|-------|
| unified-backend | tenpennynovels-unified-backend | 3001 |
| api-gateway | tenpennynovels-api-gateway | 8000 |
| mongodb | tenpennynovels-mongodb | 27017 |
| redis | tenpennynovels-redis | 6379 |
| embeddings-worker | tenpennynovels-embeddings-worker | 5001 |
| qdrant | tenpennynovels-qdrant | 6333 |
| elasticsearch | tenpennynovels-elasticsearch | 9200 |

`unified-backend` monta i sorgenti in volume (hot-reload con tsx watch). Un semplice `restart` applica le modifiche al codice senza rebuild.

### bot-service
Non è in Docker: gira in locale con `npm run bot-service:dev` (vedi `bot-service/README.md`). Usa Ollama dell'host e il Redis del compose (porta 6379).
`ai-gateway/` (ingresso dei servizi AI, porta 8787) e `bot-service` (servizi `editorial` e `character-bot`, HTTP interno 8788) girano in locale, non in Docker: `npm run ai-gateway:dev`, `npm run bot-service:dev`. Il backend in Docker raggiunge il gateway con `AI_GATEWAY_URL=http://host.docker.internal:8787`.

## Alias servizi

Riconosci questi nomi informali:

| L'utente dice | Servizio Docker |
|---------------|-----------------|
| unified, backend, server | unified-backend |
| gateway, proxy, api gateway | api-gateway |
| mongo, database, db | mongodb |
| elastic, search | elasticsearch |
| embeddings, worker | embeddings-worker |

## Operazioni -> Comandi

| Richiesta | Comando |
|-----------|---------|
| Riavvia i backend | `docker compose restart unified-backend api-gateway` |
| Riavvia tutto | `docker compose restart` |
| Builda e riavvia [servizio] | `docker compose up -d --build [servizio]` |
| Avvia tutto / Start | `docker compose up -d` |
| Ferma tutto / Stop | `docker compose down` |
| Stato / Status | `docker compose ps` |
| Log di [servizio] | `docker compose logs --tail=50 [servizio]` |

## Procedura

1. **Interpreta** la richiesta dell'utente usando la tabella alias e operazioni
2. **Esegui** il comando con Shell tool (working_directory: root del progetto)
3. **Verifica** lo stato con `docker compose ps`
4. **Mostra** il risultato all'utente

Per i log, usa `block_until_ms: 5000` e leggi l'output dal file terminale.

## Note

- Se l'utente chiede di riavviare "i backend" senza specificare, riavvia `unified-backend` e `api-gateway`
- Se l'utente chiede di riavviare "tutto", riavvia tutti i servizi dello stack principale
- Le **variabili d'ambiente** (`environment:` nel compose, `.env` della root) si rileggono solo ricreando il container: `docker compose up -d <servizio>`. `restart` non le rilegge. Il codice invece si ricarica da solo (volume + `tsx watch`)
- Il rebuild (`--build`) serve solo quando cambia il Dockerfile o le dipendenze, non per modifiche al codice sorgente
