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
- [WebSocket Events](./tecnica/backend/websocket-events.md) ⭐ 27+ eventi
- [Error Codes](./tecnica/backend/error-codes.md) ⭐ 40+ codici errore
- [API Endpoints](./tecnica/backend/api-endpoints.md) - 90+ endpoints REST
- [Authentication](./tecnica/backend/authentication.md) - Dual-token JWT

#### Frontend
- [Game App](./tecnica/frontend/game-app.md) ⭐ 12 message types, 9 stores
- [Documents App](./tecnica/frontend/documents-app.md) ⭐ Semantic search
- [Management App](./tecnica/frontend/management-app.md) ⭐ ConfigurableDataTable

#### Scripts
- [Seeders](./tecnica/scripts/seeders.md) ⭐ 10 database seeders
- [Glass Ball](./tecnica/scripts/glass-ball.md) - Image processing

#### Infrastructure
- [Docker Compose](./tecnica/infrastructure/docker-compose.md)
- [MongoDB Schemas](./tecnica/infrastructure/mongodb-schemas.md)
- [Qdrant Vector DB](./tecnica/infrastructure/qdrant-vector-db.md)

---

## 🚀 Quick Start

**Per Developers**:
1. Leggi [tecnica/README.md](./tecnica/README.md)
2. Setup: [deploy/docs/01-ubuntu-from-zero.md](../deploy/docs/01-ubuntu-from-zero.md)
3. API Reference: [websocket-events.md](./tecnica/backend/websocket-events.md), [error-codes.md](./tecnica/backend/error-codes.md)

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

**Last Updated**: 2026-03-15
**Version**: 2.0
