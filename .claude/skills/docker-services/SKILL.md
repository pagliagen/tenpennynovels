---
name: docker-services
description: Manage Docker services: start, stop, restart, rebuild, logs, status. Use when the user asks to restart backend, start services, rebuild containers, check logs, stop Docker, activate local-ai, or any Docker/container operation.
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

### Local-AI (`local-ai/docker-compose.yml`)

| Servizio | Porta |
|----------|-------|
| gateway | 9000 |
| botai | 8080 |
| character-gen | 8130 |
| mongodb | 27030 |

Profili opzionali: `ollama-docker`, `image-gen`, `test`.

## Alias servizi

Riconosci questi nomi informali:

| L'utente dice | Servizio Docker |
|---------------|-----------------|
| unified, backend, server | unified-backend |
| gateway, proxy, api gateway | api-gateway |
| mongo, database, db | mongodb |
| elastic, search | elasticsearch |
| embeddings, worker | embeddings-worker |
| local-ai, ai, local ai | stack local-ai (compose separato) |

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
| Avvia local-ai | `docker compose -f local-ai/docker-compose.yml up -d` |
| Ferma local-ai | `docker compose -f local-ai/docker-compose.yml down` |
| Riavvia local-ai | `docker compose -f local-ai/docker-compose.yml restart` |
| Log local-ai | `docker compose -f local-ai/docker-compose.yml logs --tail=50` |
| Stato local-ai | `docker compose -f local-ai/docker-compose.yml ps` |

## Procedura

1. **Interpreta** la richiesta dell'utente usando la tabella alias e operazioni
2. **Esegui** il comando con Shell tool (working_directory: root del progetto)
3. **Verifica** lo stato con `docker compose ps` (o il corrispettivo per local-ai)
4. **Mostra** il risultato all'utente

Per i log, usa `block_until_ms: 5000` e leggi l'output dal file terminale.

## Note

- Se l'utente chiede di riavviare "i backend" senza specificare, riavvia `unified-backend` e `api-gateway`
- Se l'utente chiede di riavviare "tutto", riavvia tutti i servizi dello stack principale
- Per local-ai, usa sempre `-f local-ai/docker-compose.yml`
- Il rebuild (`--build`) serve solo quando cambia il Dockerfile o le dipendenze, non per modifiche al codice sorgente
