# TenPennyNovels - Documentazione Completa

**Victorian London Roleplaying Game** - Documentazione tecnica e funzionale

---

## 📚 Indice Principale

### [Documentazione Funzionale](./funzionale/README.md)
**Cosa fa il sistema** - Guide utente, feature, gameplay

- Autenticazione e gestione account
- Sistema personaggi (creazione, approvazione, gestione)
- Locations e navigazione
- Chat e comunicazione
- Documenti e knowledge base
- Pannello amministrazione

### [Documentazione Tecnica](./tecnica/README.md)
**Come funziona il sistema** - Architetture, API, implementazioni

#### Backend
- [WebSocket Events](./tecnica/backend/websocket-events.md) — catalogo eventi Socket.IO
- [Error Codes](./tecnica/backend/error-codes.md) — registry allineato a `ErrorCode` (~59 voci)
- [API Endpoints](./tecnica/backend/api-endpoints.md) - 90+ endpoints REST
- [Authentication](./tecnica/backend/authentication.md) — JWT, cookie e sessione personaggio

#### Frontend
- [Landing App](./tecnica/frontend/landing-app.md) — marketing e auth
- [Game App](./tecnica/frontend/game-app.md) — 12 tipi messaggio location chat, 9 store Zustand
- [Documents App](./tecnica/frontend/documents-app.md) — knowledge base e ricerca semantica (porta 4002)
- [Management App](./tecnica/frontend/management-app.md) — pannello admin (porta 4003)

#### Scripts
- [Seeders](./tecnica/scripts/seeders.md) — 10 seed TypeScript in `scripts/seeders`
- [Glass Ball](./tecnica/scripts/glass-ball.md) - Image processing

#### Infrastructure
- [Docker Compose](./tecnica/infrastructure/docker-compose.md)
- [MongoDB Schemas](./tecnica/infrastructure/mongodb-schemas.md)
- [Redis Pub/Sub](./tecnica/infrastructure/redis-pubsub.md)
- [Qdrant Vector DB](./tecnica/infrastructure/qdrant-vector-db.md)
- [Environment Variables](./tecnica/infrastructure/environment-variables.md)

---

## 🚀 Quick Start

**Per Developers**:
1. Leggi [tecnica/README.md](./tecnica/README.md)
2. Setup server: [deploy/docs/01-ubuntu-from-zero.md](../deploy/docs/01-ubuntu-from-zero.md)
3. Riferimenti API: [websocket-events.md](./tecnica/backend/websocket-events.md), [error-codes.md](./tecnica/backend/error-codes.md), [api-endpoints.md](./tecnica/backend/api-endpoints.md)
4. Bot / AI in locale (opzionale): [local-ai/README.md](../local-ai/README.md)

**Per Utenti/Players**:
1. Leggi [funzionale/README.md](./funzionale/README.md)
2. Guide gameplay (coming soon)

**Per Deploy**:
1. Leggi [deploy/README.md](../deploy/README.md)
2. Ubuntu setup: [01-ubuntu-from-zero.md](../deploy/docs/01-ubuntu-from-zero.md)
3. GitHub setup: [02-github-setup.md](../deploy/docs/02-github-setup.md)

---

## 📖 Glossario

Vedi [GLOSSARY.md](./GLOSSARY.md) per terminologia tecnica.

---

**Last Updated**: 2026-03-22  
**Version**: 2.1
