# Comando: draft-character

## Descrizione
Comando AI-driven per riportare un personaggio in stato DRAFT direttamente dal database MongoDB. Utile per permettere al giocatore di modificare e risalvare il personaggio con tutte le skill complete.

## Utilizzo
Quando l'utente chiede di riportare un personaggio in bozza con `/draft-character {id}`, usa questo comando per:
1. Connettersi automaticamente a MongoDB
2. Verificare che il personaggio esista
3. Impostare lo status a `DRAFT`
4. Rimuovere i campi di approvazione (approvedAt, approvedBy, reviewNote)
5. Aggiungere entry a reviewHistory con action 'draft'
6. Restituire conferma dell'operazione

## Credenziali MongoDB
- URI: `mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin`
- Database: `tenpennynovels`
- Le credenziali sono nel file `docker-compose.infrastructure.yml`

## Modelli Disponibili
**IMPORTANTE**: Leggi sempre il file `services/database/models/index.ts` per vedere tutti i modelli disponibili e i loro export.

Per questo comando servono:
- `Character` - Modello del personaggio
- `User` - Modello utente (per reviewedBy in reviewHistory)

## Campi Aggiornati nel Character

Quando un personaggio viene riportato in DRAFT, vengono aggiornati i seguenti campi:

1. **status** - Impostato a `'DRAFT'`
2. **approvedAt** - Impostato a `undefined` o rimosso
3. **approvedBy** - Impostato a `undefined` o rimosso
4. **reviewNote** - Impostato a `null` o rimosso
5. **reviewHistory** - Aggiunta entry con:
   - `action: 'draft'`
   - `reviewedBy` - ObjectId dell'utente sistema trovato (richiesto dallo schema)
   - `note: note` (opzionale, può essere null)
   - `reviewedAt: new Date()`

**NOTA IMPORTANTE**: Le skill vengono mantenute così come sono. Non vengono cancellate o modificate.

## Pattern di Implementazione

Quando l'utente chiede di riportare un personaggio in bozza:

1. **Connetti a MongoDB** usando:
   ```typescript
   import mongoose from 'mongoose';
   const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin';
   await mongoose.connect(MONGODB_URI);
   ```

2. **Importa i modelli necessari**:
   ```typescript
   import { Character, User } from '../../database/models';
   // Usa il path relativo corretto dal punto in cui stai lavorando
   ```
   
   **IMPORTANTE**: Devi importare `User` per trovare un utente da usare come `reviewedBy` (campo richiesto dallo schema).

3. **Trova utente sistema per reviewedBy**:
   - Cerca un utente admin/master nel database
   - Se non trovato, cerca un utente con email/username admin o system
   - Come fallback, usa il primo utente disponibile
   - Se nessun utente trovato, lancia errore (reviewedBy è richiesto dallo schema)

4. **Valida il personaggio**:
   - Trova il personaggio per ID
   - Verifica che esista
   - Verifica che NON sia già in stato `DRAFT` (opzionale, ma utile per feedback)
   - Se non valido, restituisci errore chiaro

5. **Aggiorna Character**:
   - Imposta `status = 'DRAFT'`
   - Imposta `approvedAt = undefined` (o rimuovi il campo)
   - Imposta `approvedBy = undefined` (o rimuovi il campo)
   - Imposta `reviewNote = null` (o rimuovi il campo)
   - Aggiungi entry a `reviewHistory` con `reviewedBy = systemUserId` (inizializza array se non esiste)
   - Salva il personaggio

6. **Chiudi la connessione** dopo l'operazione:
    ```typescript
    await mongoose.disconnect();
    ```

## Note Importanti

- **Sempre chiudere la connessione** dopo l'uso per evitare connessioni aperte
- **Usa try/catch** per gestire errori di connessione o query
- **Verifica che il personaggio esista** prima di procedere
- **Mantieni le skill** - non cancellarle o modificarle
- **Gestisci errori appropriatamente** con messaggi chiari per tutti i casi edge
- **reviewedBy è richiesto** dallo schema Character, quindi devi trovare un utente nel database da usare (cerca admin/master, altrimenti primo utente disponibile)
- **Non eliminare CharacterFinances** - il personaggio potrebbe essere riapprovato in futuro

## Esempio Completo

Richiesta: `/draft-character 693dda96dfe0250b25663311`

Implementazione:
```typescript
import mongoose from 'mongoose';
import { Character, User } from '../../database/models';

const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin';

try {
  await mongoose.connect(MONGODB_URI);
  
  const characterId = '693dda96dfe0250b25663311';
  const note = null; // Opzionale: nota per il motivo del riporto in bozza
  
  // Trova un utente admin o system da usare come reviewedBy
  let systemUserId = null;
  const adminUser = await User.findOne({ 
    $or: [
      { role: 'admin' },
      { role: 'master' },
      { email: 'admin@tenpennynovels.com' },
      { username: 'admin' },
      { username: 'system' }
    ]
  });
  
  if (adminUser) {
    systemUserId = adminUser._id;
  } else {
    // Fallback: prendi il primo utente disponibile
    const anyUser = await User.findOne();
    if (anyUser) {
      systemUserId = anyUser._id;
    } else {
      throw new Error('Nessun utente trovato nel database. Impossibile completare l\'operazione senza reviewedBy.');
    }
  }
  
  // Trova e valida il personaggio
  const character = await Character.findById(characterId);
  
  if (!character) {
    console.error('Personaggio non trovato');
    process.exit(1);
  }
  
  if (character.status === 'DRAFT') {
    console.log('Il personaggio è già in stato DRAFT');
    await mongoose.disconnect();
    process.exit(0);
  }
  
  // Aggiorna Character
  character.status = 'DRAFT';
  character.approvedAt = undefined;
  character.approvedBy = undefined;
  character.reviewNote = null;
  
  // Aggiungi a review history
  const reviewEntry = {
    action: 'draft',
    reviewedBy: systemUserId, // Richiesto dallo schema
    note: note || null,
    reviewedAt: new Date()
  };
  
  character.reviewHistory = character.reviewHistory || [];
  character.reviewHistory.push(reviewEntry);
  
  await character.save();
  
  console.log('Personaggio riportato in BOZZA con successo!');
  console.log(`ID: ${characterId}`);
  console.log(`Nome: ${character.name}`);
  console.log(`Status precedente: ${character.reviewHistory[character.reviewHistory.length - 2]?.action || 'N/A'}`);
  console.log(`Skill salvate: ${character.skills instanceof Map ? character.skills.size : Object.keys(character.skills || {}).length}`);
  
} catch (error: any) {
  console.error('Errore durante il riporto del personaggio in bozza:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
```

