# Database Models

Questa directory contiene tutti i modelli MongoDB Mongoose per TenPennyNovels.

## Struttura

Ogni modello è un file TypeScript che definisce:
- **Interface** (es. `ICharacter`) - Tipi TypeScript per type safety
- **Schema** (es. `CharacterSchema`) - Validazione Mongoose e relazioni
- **Model export** (es. `Character`) - Modello Mongoose esportato

## Pattern

### Definizione Modello
```typescript
import { Schema, Document, model, models } from 'mongoose';

export interface I[ModelName] extends Document {
  fieldName: string;
  createdAt: Date;
  updatedAt: Date;
}

const [ModelName]Schema = new Schema<I[ModelName]>({
  fieldName: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true,
  collection: '[modelnames]'
});

// Index per performance
[ModelName]Schema.index({ fieldName: 1 });

// Export (evita re-compilazione in hot-reload)
const [ModelName] = models.[ModelName] || model<I[ModelName]>('[ModelName]', [ModelName]Schema);

export { [ModelName] };
```

### Best Practices

1. **Type Safety**: Usa sempre interfacce TypeScript (`I[ModelName]`)
2. **Validation**: Aggiungi validazione Mongoose per campi importanti
3. **Index**: Crea index per campi usati in query frequenti
4. **Relations**: Usa `Schema.Types.ObjectId` e `ref` per relazioni
5. **Timestamps**: Abilita `timestamps: true` per createdAt/updatedAt automatici
6. **Export Pattern**: Usa `models.[ModelName] || model(...)` per evitare re-compilazione

## Aggiungere Nuovo Modello

1. Crea file `[ModelName].ts` in questa directory
2. Definisci interface `I[ModelName]` che estende `Document`
3. Crea Schema Mongoose con validazione
4. Aggiungi index per performance
5. Export model usando pattern `models.[ModelName] || model(...)`
6. Aggiungi export in `index.ts` (o `index.js`)

## Modelli Principali

### Character
- Personaggi giocatori
- Include stats Call of Cthulhu, skills, background
- Relazioni: User, Location, Corporation

### Location
- Location del gioco (luoghi di Londra Vittoriana)
- Include chat, shop, visibility settings
- Relazioni: Characters (attualmente presenti)

### Corporation
- Corporazioni e organizzazioni
- Include membri, ruoli, finanziamenti
- Relazioni: Characters (membri)

### User
- Utenti del sistema
- Include autenticazione, ruoli, caratteri
- Relazioni: Characters

### Ticket
- Sistema di supporto/ticket
- Include assegnazione, reparti, messaggi
- Relazioni: Character (creatore), User (assegnato)

## Note Importanti

- **Naming**: File in PascalCase, interface con prefisso `I`, model senza prefisso
- **Relations**: Usa sempre `Schema.Types.ObjectId` per riferimenti
- **Validation**: Valida sempre campi obbligatori e formati
- **Performance**: Crea index per query frequenti
- **Migration**: Per modifiche schema esistenti, crea migration script in `scripts/migrations/`

