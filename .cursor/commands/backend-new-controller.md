# /backend-new-controller

Genera un nuovo controller backend seguendo i pattern standardizzati di TenpennyNovels.

## Uso

```
/backend-new-controller [ControllerName] [ServiceName]
```

## Esempi

```
/backend-new-controller ItemController game-backend
/backend-new-controller NotificationController game-backend
/backend-new-controller ReportController management-backend
```

## Cosa fa

Quando viene chiamato `/backend-new-controller [ControllerName] [ServiceName]`:

1. **Crea controller** in `services/[ServiceName]/src/controllers/[ControllerName].ts`
   - Usa classe statica con metodi async che restituiscono `Promise<void>`
   - Importa helper da `utils/apiResponse.ts` (successResponse, errorResponse, listResponse, etc.)
   - Usa logger da `utils/logger.ts`
   - Segue formato API standardizzato: `{ result, data, list, pagination, error, timestamp }`

2. **Pattern da seguire:**
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

3. **Template da usare:**
   - Game Backend: `services/game-backend/src/controllers/CharacterController.ts`
   - Management Backend: `services/management-backend/src/controllers/UserManagementController.ts`

## Checklist

Dopo la generazione, verifica:
- [ ] Controller usa helper functions standardizzate da `utils/apiResponse.ts`
- [ ] Metodi sono statici e async con tipo di ritorno `Promise<void>`
- [ ] Error handling con try/catch e logger
- [ ] Formato API standardizzato con `result`, `data`/`list`, `pagination`
- [ ] Commenti JSDoc per ogni metodo pubblico
- [ ] Import corretti per il servizio specifico

## Note importanti

- **Type safety**: Usa sempre TypeScript interfaces per request/response
- **Error handling**: Gestisci sempre errori con try/catch e logger
- **API format**: Usa sempre formato standardizzato con `result` (non `success`)
- **Consistency**: Segui pattern esistenti nel codebase

