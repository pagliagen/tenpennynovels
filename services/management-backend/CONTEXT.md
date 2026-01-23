# Management Backend Context

## Scopo
Gestisce tutte le funzionalità amministrative: gestione utenti, approvazione personaggi, gestione location, corporazioni, documenti, ticket system, analytics e configurazione sistema.

## Architettura
- **Controllers**: Gestiscono richieste HTTP per operazioni admin
- **Routes**: Definiscono endpoint REST con prefisso `/admin`
- **Middleware**: `AdminAuthMiddleware` per autenticazione e autorizzazione admin
- **Utils**: Utility per audit logging, permissions, API responses
- **Types**: Interfacce TypeScript per management operations

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

### Autenticazione e Autorizzazione
- Usa `AdminAuthMiddleware` per tutte le route
- Verifica permessi admin tramite `requireViewPermission`, `requireEditPermission`, etc.
- Log tutte le operazioni admin con `logAdminAction`

### Audit Logging
- Tutte le operazioni admin creano audit log
- Usa `AuditLogger` da `utils/auditLogger.ts`
- Include informazioni su chi, cosa, quando, perché

### Permissions System
- Sistema di permessi basato su ruoli (master, moderatore, amministratore)
- Mapping reparti → ruoli in `utils/permissions.ts`
- Verifica permessi prima di operazioni sensibili

## Dipendenze

### Database
- `services/database/models` - Modelli MongoDB
- Modelli specifici in `src/models/` per management (User, Character)

### Shared Code
- `services/shared` - Utility condivise
- `services/shared/types` - Tipi TypeScript condivisi

### External Services
- **Redis**: Cache e pub/sub per aggiornamenti real-time
- **MongoDB**: Database principale

## Endpoint Principali

### Users Management
- `GET /admin/users` - Lista utenti con filtri
- `GET /admin/users/:id` - Dettagli utente
- `PATCH /admin/users/:id` - Modifica utente
- `POST /admin/users/:id/ban` - Banna utente

### Characters Approval
- `GET /admin/characters` - Lista personaggi
- `GET /admin/characters/pending` - Personaggi in attesa approvazione
- `POST /admin/characters/:id/approve` - Approva personaggio
- `POST /admin/characters/:id/reject` - Rifiuta personaggio

### Locations Management
- `GET /admin/locations` - Lista location
- `POST /admin/locations` - Crea location
- `PATCH /admin/locations/:id/settings` - Modifica impostazioni location

### Tickets Management
- `GET /admin/tickets` - Lista ticket
- `GET /admin/tickets/:id` - Dettagli ticket
- `POST /admin/tickets/:id/assign` - Assegna ticket
- `POST /admin/tickets/:id/close` - Chiudi ticket

### System Configuration
- `GET /admin/system/config` - Configurazione sistema
- `PATCH /admin/system/config` - Aggiorna configurazione

## Come Aggiungere Nuovo Endpoint Admin

1. Crea controller method in `src/controllers/[Name]ManagementController.ts`
2. Usa helper da `utils/apiResponse.ts` per risposte
3. Applica `AdminAuthMiddleware` e verifica permessi
4. Crea audit log con `logAdminAction`
5. Aggiungi route in `src/routes/[name]Routes.ts`
6. Registra route in `src/routes/index.ts` con prefisso `/admin`

## Note Importanti

- **Security**: Tutte le route richiedono autenticazione admin
- **Audit**: Log tutte le operazioni admin
- **Permissions**: Verifica sempre permessi prima di operazioni
- **Validation**: Valida sempre input e motivo per modifiche
- **Error Messages**: Usa messaggi di errore chiari per admin

