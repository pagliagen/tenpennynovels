# /management-newcrud

Genera automaticamente un CRUD completo per un modello del database nel management panel.

## Uso

```
/management-newcrud [ModelName]
```

## Esempi

```
/management-newcrud HousingProperty
/management-newcrud Character
/management-newcrud Item
/management-newcrud EstateTransaction
```

## Cosa fa

Quando viene chiamato `/management-newcrud [ModelName]`:

1. **Analizza il modello** da `packages/database/models/[ModelName].ts`
   - Legge i campi, tipi, relazioni
   - Identifica campi obbligatori vs opzionali
   - Determina i tipi per le colonne della tabella

2. **Genera/aggiorna backend controller** in `services/management-backend/src/controllers/[ModelName]ManagementController.ts`
   - Usa helper functions da `services/management-backend/src/utils/apiResponse.ts`
   - Implementa GET (list), GET (single), POST, PATCH, DELETE
   - Usa formato API standardizzato: `result`, `list`, `data`, `pagination`

3. **Genera/aggiorna routes** in `services/management-backend/src/routes/[modelName]Routes.ts`
   - Applica `AdminAuthMiddleware`
   - Usa `requireViewPermission`, `logAdminAction`
   - Registra routes in `services/management-backend/src/routes/index.ts`

4. **Aggiunge API helper** in `apps/management/src/lib/api.ts`
   - Crea oggetto `[modelName]API` con metodi standardizzati
   - Usa `ApiResponse<T>` interface
   - Metodi: `get[Models]`, `get[Model]`, `create[Model]`, `update[Model]`, `delete[Model]`

5. **Genera table configuration JSON** in `apps/management/public/config/tables/[model-name]-list.json`
   - Definisce colonne basate sui campi del modello
   - Configura filtri, ordinamento, paginazione
   - Imposta azioni (view, edit, delete)
   - Configura bulk actions se applicabile

6. **Genera frontend page** in `apps/management/src/pages/[model-name]/[model-name]-list.tsx`
   - Usa `ManagementLayout` wrapper
   - Usa `ConfigurableDataTable` component
   - Usa `useTableConfig` hook
   - Implementa fetch function usando nuovo formato API:
     ```typescript
     const response = await fetch(`${API_GATEWAY_URL}/admin/endpoint`);
     const data = await response.json();
     const items = data.list || []; // Usa list, NON data.items
     const pagination = data.pagination || {};
     ```

7. **Genera SCSS module** in `apps/management/src/styles/pages/[ModelName]List.module.scss`
   - Importa design system: `@import 'main';`
   - Usa variabili condivise da `apps/shared-ui/src/styles/variables/`
   - Segue pattern esistenti da altre list pages

## Standard API Response Format

Tutti i file generati DEVONO usare il formato standardizzato:

### Backend Response Structure
```typescript
interface ApiResponse<T = any> {
  result: boolean;           // true/false (NON 'success')
  data?: T;                  // Single record data
  list?: T[];                // Array for list responses (NON data.items)
  pagination?: PaginationInfo; // Pagination info at root level
  message?: string;          // Optional message for POST/PATCH/DELETE
  error?: string;            // Error message if result = false
  code?: string;             // Error code (e.g., 'USER_NOT_FOUND')
  details?: ErrorDetails;     // Additional error details
  timestamp: string;         // Always present
  requestId?: string;        // Optional for request tracing
}
```

### Helper Functions da usare
Da `services/management-backend/src/utils/apiResponse.ts`:
- `successResponse<T>(data: T, message?: string, requestId?: string)` - Single record
- `listResponse<T>(list: T[], pagination: PaginationInfo, message?: string, requestId?: string)` - List with pagination
- `errorResponse(error: string, code?: string, details?: ErrorDetails, statusCode?: number, requestId?: string)` - Errors
- `createResponse<T>(data: T, message?: string, requestId?: string)` - POST responses
- `updateResponse<T>(data: T, message?: string, requestId?: string)` - PATCH responses
- `deleteResponse(message?: string, requestId?: string)` - DELETE responses
- `getRequestId(req: Request)` - Extract request ID

### Frontend API Helper
Il `apiRequest` function in `apps/management/src/lib/auth.ts` gestisce automaticamente il nuovo formato:
```typescript
const response = await apiRequest('/admin/endpoint');
// response.result (boolean)
// response.list (array for lists)
// response.data (single record)
// response.pagination (pagination info)
// response.error (error message)
```

## Template da seguire

### Backend Controller Template
Usa `UserManagementController.ts` o `CharacterApprovalController.ts` come template.

### Frontend Page Template
Usa `apps/management/src/pages/characters/character-list.tsx` come template.

### Table Configuration Template
Usa `apps/management/public/config/tables/character-list.json` come template.

### SCSS Module Template
Usa `apps/management/src/styles/pages/CharacterList.module.scss` come template.

## Checklist

Dopo la generazione, verifica:
- [ ] Backend controller usa helper functions standardizzate
- [ ] Backend routes registrate in `routes/index.ts`
- [ ] Frontend API helper aggiunto a `api.ts`
- [ ] Table configuration JSON creato
- [ ] Frontend page usa `data.list` e `data.result` (NON `data.success` o `data.data.items`)
- [ ] SCSS module importa design system
- [ ] Tutti i file seguono naming conventions
- [ ] Build passa senza errori
- [ ] Linting passa senza errori

## Documentazione completa

Vedi `docs/agents/management-crud-generator.md` per dettagli completi.

## Note importanti

- **NO backward compatibility**: Solo nuovo formato (`result`, `list`, `data`)
- **Type safety**: Usa sempre TypeScript interfaces
- **Consistency**: Segui pattern esistenti nel codebase
- **Testing**: Verifica build e linting dopo generazione

