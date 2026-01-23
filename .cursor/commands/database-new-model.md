# /database-new-model

Genera un nuovo modello MongoDB Mongoose seguendo i pattern standardizzati.

## Uso

```
/database-new-model [ModelName] [Description]
```

## Esempi

```
/database-new-model Item "Game items and equipment"
/database-new-model Notification "User notifications"
/database-new-model AuditLog "System audit logs"
```

## Cosa fa

Quando viene chiamato `/database-new-model [ModelName] [Description]`:

1. **Crea modello** in `services/database/models/[ModelName].ts`
   - Definisce interface `I[ModelName]` che estende `Document`
   - Crea Schema Mongoose con validazione
   - Aggiunge index per performance
   - Export model e interface

2. **Pattern da seguire:**
   ```typescript
   import { Schema, Document, model, models } from 'mongoose';

   export interface I[ModelName] extends Document {
     // Campi del modello con tipi TypeScript
     fieldName: string;
     createdAt: Date;
     updatedAt: Date;
   }

   const [ModelName]Schema = new Schema<I[ModelName]>({
     fieldName: {
       type: String,
       required: true,
       trim: true,
       maxlength: 255
     },
     createdAt: {
       type: Date,
       default: Date.now
     },
     updatedAt: {
       type: Date,
       default: Date.now
     }
   }, {
     timestamps: true,
     collection: '[modelnames]' // Nome collection MongoDB
   });

   // Index per performance
   [ModelName]Schema.index({ fieldName: 1 });
   [ModelName]Schema.index({ createdAt: -1 });

   // Middleware pre-save se necessario
   [ModelName]Schema.pre('save', function(next) {
     // Logica pre-save
     next();
   });

   // Export model (evita re-compilazione in hot-reload)
   const [ModelName] = models.[ModelName] || model<I[ModelName]>('[ModelName]', [ModelName]Schema);

   export { [ModelName] };
   ```

3. **Aggiungi export** in `services/database/models/index.ts`
   ```typescript
   export { [ModelName], I[ModelName] } from './[ModelName]';
   ```

4. **Crea tipo shared** in `services/shared/types/[modelname].ts` (opzionale ma consigliato)
   - Definisce interface TypeScript per uso frontend/backend
   - Può differire leggermente dal modello Mongoose (es. ObjectId come string)

5. **Template da usare:**
   - `services/database/models/Character.ts` - Modello complesso con relazioni
   - `services/database/models/Location.ts` - Modello con validazione avanzata
   - `services/database/models/User.ts` - Modello base

## Checklist

Dopo la generazione, verifica:
- [ ] Interface `I[ModelName]` definita ed estende `Document`
- [ ] Schema Mongoose con validazione appropriata
- [ ] Index creati per query frequenti
- [ ] Timestamps abilitati se necessario
- [ ] Export aggiunto in `models/index.ts`
- [ ] Tipo shared creato se necessario
- [ ] Collection name definito correttamente

## Note importanti

- **Type Safety**: Usa sempre interfacce TypeScript
- **Validation**: Aggiungi validazione Mongoose per campi importanti
- **Index**: Crea index per campi usati in query frequenti
- **Relations**: Usa `Schema.Types.ObjectId` e `ref` per relazioni
- **Timestamps**: Abilita `timestamps: true` per createdAt/updatedAt automatici
- **Export Pattern**: Usa pattern `models.[ModelName] || model(...)` per evitare re-compilazione

