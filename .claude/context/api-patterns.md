# API Patterns Standardizzati

## Formato Risposta API

Tutte le API di TenPennyNovels usano un formato di risposta standardizzato per consistenza e facilità di utilizzo.

### Struttura Standard

```typescript
interface ApiResponse<T = any> {
  result: boolean;           // true/false (NON 'success')
  data?: T;                   // Single record (per GET /:id, POST, PATCH)
  list?: T[];                 // Array per list responses (per GET list)
  pagination?: PaginationInfo; // Pagination info (solo per list)
  message?: string;           // Messaggio opzionale per POST/PATCH/DELETE
  error?: string;             // Messaggio errore se result = false
  code?: string;              // Codice errore standardizzato
  details?: ErrorDetails;      // Dettagli aggiuntivi errore
  timestamp: string;          // Sempre presente (ISO 8601)
  requestId?: string;         // ID richiesta per tracing (opzionale)
}
```

### Helper Functions

Usa sempre helper da `utils/apiResponse.ts`:

#### Success Response (Single Record)
```typescript
import { successResponse, getRequestId } from '../utils/apiResponse';

res.json(successResponse(data, message, getRequestId(req)));
```

#### List Response (con Paginazione)
```typescript
import { listResponse, getRequestId } from '../utils/apiResponse';

const pagination: PaginationInfo = {
  page: 1,
  pageSize: 20,
  total: 100,
  totalPages: 5,
  hasNext: true,
  hasPrev: false
};

res.json(listResponse(items, pagination, message, getRequestId(req)));
```

#### Error Response
```typescript
import { errorResponse, getRequestId } from '../utils/apiResponse';

res.status(400).json(errorResponse(
  'Error message',
  'ERROR_CODE',
  { additionalDetails: '...' }, // Opzionale
  400, // Status code
  getRequestId(req)
));
```

## Pattern Controller

### Struttura Standard Controller

```typescript
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, listResponse, getRequestId } from '../utils/apiResponse';

export class [ControllerName] {
  /**
   * GET /[endpoint]
   * [Descrizione endpoint]
   */
  static async [methodName](req: Request, res: Response): Promise<void> {
    try {
      // Validazione input
      // Business logic
      // Risposta standardizzata
      res.json(successResponse(data, message, getRequestId(req)));
    } catch (error: any) {
      logger.error('Error in [methodName]:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      res.status(500).json(errorResponse(
        'Error message',
        'ERROR_CODE',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
```

## Pattern Route

### Struttura Standard Route

```typescript
import { Router } from 'express';
import { [ControllerName] } from '../controllers/[ControllerName]';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// GET /[resource] - List
router.get('/[resource]', 
  AuthMiddleware,
  [ControllerName].[methodName]
);

// GET /[resource]/:id - Single
router.get('/[resource]/:id',
  AuthMiddleware,
  [ControllerName].[methodName]
);

// POST /[resource] - Create
router.post('/[resource]',
  AuthMiddleware,
  [ControllerName].[methodName]
);

// PATCH /[resource]/:id - Update
router.patch('/[resource]/:id',
  AuthMiddleware,
  [ControllerName].[methodName]
);

// DELETE /[resource]/:id - Delete
router.delete('/[resource]/:id',
  AuthMiddleware,
  [ControllerName].[methodName]
);

export default router;
```

## Error Handling

### Codici Errore Standardizzati

- `VALIDATION_ERROR` - Errore validazione input
- `NOT_FOUND` - Risorsa non trovata
- `UNAUTHORIZED` - Autenticazione richiesta
- `FORBIDDEN` - Permessi insufficienti
- `CONFLICT` - Conflitto (es. risorsa già esistente)
- `INTERNAL_ERROR` - Errore interno server

### Pattern Error Handling

```typescript
try {
  // Business logic
} catch (error: any) {
  logger.error('Error description:', { 
    error: error instanceof Error ? error.message : String(error),
    context: { /* additional context */ }
  });
  
  // Determina status code e codice errore
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'INTERNAL_ERROR';
  
  res.status(statusCode).json(errorResponse(
    error.message || 'An error occurred',
    errorCode,
    error.details,
    statusCode,
    getRequestId(req)
  ));
}
```

## Autenticazione

### Game Backend
- Usa `CharacterSessionMiddleware`
- Accesso a `req.character` dopo middleware
- Verifica character attivo e approvato

### Management Backend
- Usa `AdminAuthMiddleware`
- Verifica permessi admin
- Log tutte le operazioni

### Authentication Backend
- Gestisce autenticazione utente
- JWT tokens con HttpOnly cookies
- Character session management separato

## Best Practices

1. **Sempre usa helper functions** - Non creare risposte manualmente
2. **Gestisci errori** - Sempre try/catch con logging
3. **Valida input** - Valida sempre input prima di processare
4. **Log operazioni** - Log operazioni importanti con contesto
5. **Type safety** - Usa sempre TypeScript interfaces
6. **Consistency** - Segui sempre pattern standardizzati

