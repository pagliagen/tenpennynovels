# Backend - Documentazione Tecnica

Architettura e implementazione servizi backend.

---

## 🎯 Servizi

### [API Gateway](./api-gateway.md)
- Port: 8000 (cluster x2)
- Proxy REST + WebSocket upgrade
- Rate limiting, CORS

### [Unified Backend](./unified-backend.md)
- Port: 3001 (fork x1 - CRITICAL)
- Architettura modulare
- Socket.IO + Redis adapter

### [Embeddings Worker](./embeddings-worker.md)
- Bull queue worker
- Python ML service integration
- Qdrant vector indexing

---

## 📚 Reference

### [API Endpoints](./api-endpoints.md)
Tutti gli endpoint REST con JSON examples

### [WebSocket Events](./websocket-events.md)
Eventi real-time con payload schemas

### [Authentication](./authentication.md)
Sistema dual-token JWT

### [Error Codes](./error-codes.md)
Registry completo codici errore

---

Vedi anche: [Documentazione Funzionale](../../funzionale/README.md)
