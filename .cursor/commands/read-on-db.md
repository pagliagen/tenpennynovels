# Comando: read-on-db

## Descrizione
Comando AI-driven per interrogare e modificare il database MongoDB in modo autonomo. L'AI interpreta richieste in linguaggio naturale e le traduce in query MongoDB usando i modelli Mongoose disponibili.

## Utilizzo
Quando l'utente chiede informazioni o modifiche sul database, usa questo comando per:
1. Connettersi automaticamente a MongoDB
2. Identificare il modello corretto dalla richiesta
3. Eseguire query complesse (find, update, aggregate, etc.)
4. Restituire risultati formattati

## Credenziali MongoDB
- URI: `mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin`
- Database: `tenpennynovels`
- Le credenziali sono nel file `docker-compose.infrastructure.yml`

## Modelli Disponibili
**IMPORTANTE**: Non elencare i modelli qui. Leggi sempre il file `services/database/models/index.ts` per vedere tutti i modelli disponibili e i loro export.

Il file `services/database/models/index.ts` è il punto centrale dove vengono esportati tutti i modelli Mongoose. Quando devi identificare quale modello usare:

1. Leggi `services/database/models/index.ts` per vedere tutti i modelli esportati
2. Identifica il modello corretto dalla richiesta dell'utente (es. "personaggi" → `Character`, "utenti" → `User`)
3. Importa il modello usando: `import { ModelName } from '../../database/models'` o il path relativo corretto dal punto in cui stai lavorando

## Esempi di Richieste Supportate

### Query semplici
- "Dammi i nomi di tutti i personaggi"
- "Mostrami tutti gli utenti attivi"
- "Verifica se il character XXX ha il campo currentOccupation"
- "Conta quanti personaggi sono in stato DRAFT"

### Query con filtri
- "Dammi tutti i personaggi approvati creati nell'ultimo mese"
- "Trova tutti gli utenti con email che contiene '@example.com'"
- "Mostrami i personaggi con più di 50 punti forza"

### Query con proiezione
- "Dammi solo nome e cognome di tutti i personaggi"
- "Mostrami ID, nome e status di tutti i personaggi DRAFT"

### Aggiornamenti
- "Aggiorna il campo currentOccupation del character XXX con valore YYY"
- "Imposta lo status di tutti i personaggi DRAFT a PENDING_APPROVAL"

### Query complesse
- "Dammi i personaggi con le loro occupazioni popolate"
- "Mostrami gli utenti con i loro personaggi attivi"
- "Trova tutti i personaggi che hanno skills con valore maggiore di 50"

## Pattern di Implementazione

Quando l'utente fa una richiesta sul database:

1. **Connetti a MongoDB** usando:
   ```typescript
   import mongoose from 'mongoose';
   const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin';
   await mongoose.connect(MONGODB_URI);
   ```

2. **Leggi i modelli disponibili** dal file `services/database/models/index.ts` e importa quelli necessari:
   ```typescript
   // Prima leggi services/database/models/index.ts per vedere tutti i modelli disponibili
   // Poi importa quelli necessari:
   import { Character, User, Location, Occupation } from '../../database/models';
   // Usa il path relativo corretto dal punto in cui stai lavorando
   ```

3. **Identifica il modello** dalla richiesta dell'utente:
   - "personaggi" / "characters" → `Character`
   - "utenti" / "users" → `User`
   - "luoghi" / "locations" → `Location`
   - etc.

4. **Costruisci la query** in base alla richiesta:
   - Trova campi menzionati nella richiesta
   - Applica filtri se specificati
   - Usa proiezione se servono solo alcuni campi
   - Usa populate se servono riferimenti

5. **Esegui e formatta i risultati**:
   - Converti in JSON se necessario
   - Formatta per leggibilità
   - Evidenzia campi mancanti o problemi

6. **Chiudi la connessione** dopo l'operazione:
   ```typescript
   await mongoose.disconnect();
   ```

## Note Importanti

- **Sempre chiudere la connessione** dopo l'uso per evitare connessioni aperte
- **Usa try/catch** per gestire errori di connessione o query
- **Verifica che il modello esista** prima di fare query
- **Per query complesse**, usa `aggregate()` invece di `find()`
- **Per aggiornamenti**, usa `updateOne()`, `updateMany()`, o `findByIdAndUpdate()`
- **Per popolamento**, usa `.populate()` per riferimenti ObjectId

## Esempio Completo

Richiesta: "Verifica se il character 693dda96dfe0250b25663311 ha il campo currentOccupation"

Implementazione:
```typescript
import mongoose from 'mongoose';
import { Character } from '../../database/models';

const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin';

try {
  await mongoose.connect(MONGODB_URI);
  const character = await Character.findById('693dda96dfe0250b25663311');
  
  if (!character) {
    console.log('Character non trovato');
  } else {
    const hasField = 'currentOccupation' in character.toObject();
    const value = character.currentOccupation;
    console.log(`Campo currentOccupation: ${hasField ? 'presente' : 'mancante'}`);
    if (hasField) {
      console.log(`Valore: ${value || '(vuoto/null)'}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
```
