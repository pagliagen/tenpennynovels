# /backend-new-route

Genera un nuovo file di route per un controller esistente.

## Uso

```
/backend-new-route [routeName] [ServiceName] [ControllerName]
```

## Esempi

```
/backend-new-route items game-backend ItemController
/backend-new-route notifications game-backend NotificationController
/backend-new-route reports management-backend ReportController
```

## Cosa fa

Quando viene chiamato `/backend-new-route [routeName] [ServiceName] [ControllerName]`:

1. **Crea route file** in `services/[ServiceName]/src/routes/[routeName]Routes.ts`
   - Importa Router da express
   - Importa controller corrispondente
   - Importa middleware necessari (AuthMiddleware, AdminAuthMiddleware, etc.)
   - Definisce route seguendo pattern RESTful

2. **Pattern da seguire:**
   ```typescript
   import { Router } from 'express';
   import { [ControllerName] } from '../controllers/[ControllerName]';
   import { AuthMiddleware } from '../middleware/auth'; // o AdminAuthMiddleware per management
   import { logger } from '../utils/logger';

   const router = Router();

   // GET /[routeName] - List
   router.get('/[routeName]', 
     AuthMiddleware, // o AdminAuthMiddleware
     [ControllerName].[methodName]
   );

   // GET /[routeName]/:id - Single
   router.get('/[routeName]/:id',
     AuthMiddleware,
     [ControllerName].[methodName]
   );

   // POST /[routeName] - Create
   router.post('/[routeName]',
     AuthMiddleware,
     [ControllerName].[methodName]
   );

   // PATCH /[routeName]/:id - Update
   router.patch('/[routeName]/:id',
     AuthMiddleware,
     [ControllerName].[methodName]
   );

   // DELETE /[routeName]/:id - Delete
   router.delete('/[routeName]/:id',
     AuthMiddleware,
     [ControllerName].[methodName]
   );

   export default router;
   ```

3. **Registra route** in `services/[ServiceName]/src/routes/index.ts`
   - Importa il nuovo route file
   - Aggiungi `router.use('/[prefix]', [routeName]Routes);`

4. **Template da usare:**
   - Game Backend: vedi `services/game-backend/src/routes/index.ts` per pattern di registrazione
   - Management Backend: usa `AdminAuthMiddleware` invece di `AuthMiddleware`

## Checklist

Dopo la generazione, verifica:
- [ ] Route file creato con pattern corretto
- [ ] Route registrato in `routes/index.ts`
- [ ] Middleware corretto applicato (AuthMiddleware o AdminAuthMiddleware)
- [ ] Pattern RESTful seguito (GET, POST, PATCH, DELETE)
- [ ] Export default router presente

## Note importanti

- **Middleware**: Game backend usa `AuthMiddleware`, Management backend usa `AdminAuthMiddleware`
- **Prefix**: Considera il prefix quando registri in `routes/index.ts`
- **Consistency**: Segui pattern esistenti nel codebase

