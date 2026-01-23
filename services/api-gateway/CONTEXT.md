# API Gateway Context

## Scopo
Gateway centralizzato che instrada le richieste ai vari servizi backend. Fornisce un punto di ingresso unificato per tutte le API e gestisce routing, load balancing e aggregazione di risposte.

## Architettura
- **Routing**: Instrada richieste a servizi backend appropriati
- **Proxy**: Proxy HTTP verso servizi backend
- **Health Checks**: Monitora stato servizi backend
- **Request ID**: Genera e propaga request ID per tracing

## Pattern di Routing

### Route Mapping
- `/auth/*` → Authentication Backend (localhost:3000)
- `/game/*` → Game Backend (localhost:3001)
- `/admin/*` → Management Backend (localhost:3002)

### Request Flow
1. Richiesta arriva a API Gateway (porta 8000)
2. Gateway identifica servizio target dal path
3. Gateway instrada richiesta al servizio appropriato
4. Gateway propaga response al client

## Configurazione

### Port
- API Gateway: 8000
- Authentication Backend: 3000
- Game Backend: 3001
- Management Backend: 3002

### Environment Variables
- `AUTH_BACKEND_URL`: URL authentication backend
- `GAME_BACKEND_URL`: URL game backend
- `MANAGEMENT_BACKEND_URL`: URL management backend

## Health Check

Endpoint `/health` restituisce stato di tutti i servizi:
```json
{
  "status": "ok",
  "services": {
    "auth": "ok",
    "game": "ok",
    "management": "ok"
  },
  "timestamp": "2025-01-08T12:00:00.000Z"
}
```

## Note Importanti

- **Routing**: Mantieni mapping path → servizio chiaro e documentato
- **Error Handling**: Gestisci errori di connessione ai servizi backend
- **Timeout**: Configura timeout appropriati per proxy
- **Logging**: Log tutte le richieste per debugging

