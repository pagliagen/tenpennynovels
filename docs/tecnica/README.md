# Documentazione Tecnica

**Come funziona il sistema** - Architetture, API, patterns, implementazioni

---

## Backend Services

| Documento | Descrizione | Status |
|-----------|-------------|--------|
| [api-gateway](./backend/api-gateway.md) | Reverse proxy con rate limiting | ✅ Complete |
| [unified-backend](./backend/unified-backend.md) | Main backend (REST + WebSocket) | ✅ Complete |
| [embeddings-worker](./backend/embeddings-worker.md) | Semantic search worker | ✅ Complete |

---

## API Reference ⭐

| Documento | Descrizione | Status |
|-----------|-------------|--------|
| [websocket-events](./backend/websocket-events.md) | Catalogo eventi Socket.IO | Aggiornato |
| [error-codes](./backend/error-codes.md) | Registry `ErrorCode` (decine di codici) | Aggiornato |
| [api-endpoints](./backend/api-endpoints.md) | 90+ REST endpoints | ✅ Complete |
| [authentication](./backend/authentication.md) | Dual-token JWT | ✅ Complete |

---

## Frontend Apps ⭐

| Documento | Descrizione | Status |
|-----------|-------------|--------|
| [game-app](./frontend/game-app.md) | Gameplay, chat, sheet (12 tipi messaggio, 9 store) | Completo |
| [documents-app](./frontend/documents-app.md) | Knowledge base, ricerca semantica | Completo |
| [management-app](./frontend/management-app.md) | Admin, ConfigurableDataTable | Completo |
| [landing-app](./frontend/landing-app.md) | Marketing + auth | ✅ Complete |

---

## Scripts ⭐

| Documento | Descrizione | Status |
|-----------|-------------|--------|
| [seeders](./scripts/seeders.md) | 10 script seeder in `scripts/seeders` | Completo |
| [glass-ball](./scripts/glass-ball.md) | Processing immagini | Completo |

---

## Infrastructure

| Documento | Descrizione | Status |
|-----------|-------------|--------|
| [docker-compose](./infrastructure/docker-compose.md) | Services Docker | ✅ Complete |
| [mongodb-schemas](./infrastructure/mongodb-schemas.md) | Database schemas | ✅ Complete |
| [redis-pubsub](./infrastructure/redis-pubsub.md) | WebSocket channels | ✅ Complete |
| [qdrant-vector-db](./infrastructure/qdrant-vector-db.md) | Vector DB | ✅ Complete |
| [environment-variables](./infrastructure/environment-variables.md) | Env vars | ✅ Complete |

---

## Quick Reference

| Need | Document |
|------|----------|
| WebSocket payloads | [websocket-events.md](./backend/websocket-events.md) |
| Error codes | [error-codes.md](./backend/error-codes.md) |
| Message types | [game-app.md](./frontend/game-app.md#message-types-catalog-12-tipi) |
| Semantic search | [documents-app.md](./frontend/documents-app.md#semantic-search) |
| Admin tables | [management-app.md](./frontend/management-app.md#configurabledatatable-pattern-) |
| Database seeding | [seeders.md](./scripts/seeders.md) |

---

**Last Major Update**: 2026-03-22  

**Monorepo correlato**: stack AI opzionale in [local-ai/README.md](../../local-ai/README.md) (non è avviato da `docker compose` principale).
