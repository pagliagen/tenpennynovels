# Game Backend Context

## Scopo
Gestisce tutta la logica di gameplay: chat, messaggi, personaggi, location, corporazioni, housing, economia, esperienza e sessioni di gioco.

## Architettura
- **Controllers**: Gestiscono richieste HTTP e logica di business
- **Routes**: Definiscono endpoint REST e applicano middleware
- **Middleware**: Autenticazione, validazione, rate limiting
- **Utils**: Logica di business riutilizzabile (postal system, financial utils, etc.)
- **Types**: Interfacce TypeScript specifiche del servizio

## Pattern Comuni

### API Response Format
Tutti i controller usano formato API standardizzato:
```typescript
{
  result: boolean,
  data?: T,        // Single record
  list?: T[],      // Array per list
  pagination?: PaginationInfo,
  error?: string,
  code?: string,
  timestamp: string
}
```

### Autenticazione
- Usa `CharacterSessionMiddleware` per autenticazione basata su character session
- Richiede character attivo e approvato
- Accesso a `req.character` dopo middleware

### Logging
- Usa `logger` da `utils/logger.ts` per logging strutturato
- Log tutte le operazioni importanti con contesto

### Error Handling
- Sempre try/catch nei controller
- Usa `errorResponse` helper per risposte di errore standardizzate
- Include `requestId` per tracing

## Dipendenze

### Database
- `services/database/models` - Modelli MongoDB (Character, Location, Corporation, etc.)
- Accesso diretto ai modelli Mongoose

### Shared Code
- `services/shared` - Utility condivise, tipi, servizi
- `services/shared/types` - Tipi TypeScript condivisi
- `services/shared/utils` - Utility functions

### External Services
- **Redis**: Cache e pub/sub per eventi real-time
- **MongoDB**: Database principale
- **Embeddings Service**: Ricerca semantica documenti

## Endpoint Principali

### Characters
- `POST /game/characters/create` - Crea nuovo personaggio
- `GET /game/characters` - Lista personaggi utente
- `GET /game/characters/:id` - Dettagli personaggio
- `PATCH /game/characters/:id` - Modifica personaggio

### Locations
- `GET /game/locations` - Lista location disponibili
- `GET /game/locations/:id` - Dettagli location
- `POST /game/locations/:id/move` - Muovi personaggio

### Chat & Messages
- `GET /game/chats/:locationId` - Chat location
- `POST /game/chats/:locationId/messages` - Invia messaggio
- `GET /game/ongame-messages` - Messaggi postal system
- `POST /game/ongame-messages` - Invia messaggio postal

### Corporations
- `GET /game/corporations` - Lista corporazioni
- `POST /game/corporations` - Crea corporazione
- `GET /game/corporations/:id` - Dettagli corporazione

### Housing
- `GET /game/housing/properties` - Lista proprietà
- `POST /game/housing/properties/:id/rent` - Affitta proprietà
- `GET /game/housing/dashboard` - Dashboard housing

## Come Aggiungere Nuovo Endpoint

1. Crea controller method in `src/controllers/[Name]Controller.ts`
2. Usa helper da `utils/apiResponse.ts` per risposte
3. Aggiungi route in `src/routes/[name]Routes.ts`
4. Registra route in `src/routes/index.ts`
5. Applica middleware appropriato (CharacterSessionMiddleware)

## Note Importanti

- **Type Safety**: Usa sempre TypeScript strict mode
- **Validation**: Valida sempre input prima di processare
- **Authorization**: Verifica permessi character quando necessario
- **Audit Log**: Crea audit log per operazioni importanti
- **Error Messages**: Usa messaggi di errore user-friendly

