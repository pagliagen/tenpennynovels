# Comando: approve-character

## Descrizione
Comando AI-driven per approvare un personaggio direttamente dal database MongoDB. Replica la logica completa dell'endpoint `POST /admin/characters/:characterId/approve` del management-backend, aggiornando tutti i campi necessari e creando il record CharacterFinances.

## Utilizzo
Quando l'utente chiede di approvare un personaggio con `/approve-character {id}`, usa questo comando per:
1. Connettersi automaticamente a MongoDB
2. Verificare che il personaggio esista e sia in stato `PENDING_APPROVAL`
3. Recuperare starting items dall'occupazione
4. Calcolare la skill FINANZA e determinare la classe sociale
5. Creare il record CharacterFinances con ricchezza iniziale
6. Aggiornare il Character con tutti i campi di approvazione
7. Restituire conferma dell'operazione

## Credenziali MongoDB
- URI: `mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin`
- Database: `tenpennynovels`
- Le credenziali sono nel file `docker-compose.infrastructure.yml`

## Modelli Disponibili
**IMPORTANTE**: Leggi sempre il file `services/database/models/index.ts` per vedere tutti i modelli disponibili e i loro export.

Per questo comando servono:
- `Character` - Modello del personaggio
- `Occupation` - Modello dell'occupazione (per starting items)
- `CharacterFinances` - Modello delle finanze del personaggio
- `SocialClassConfig` - Configurazione classi sociali (per calcolo ricchezza iniziale)

## Campi Aggiornati nel Character

Quando un personaggio viene approvato, vengono aggiornati i seguenti campi:

1. **equipment** - Array di ObjectId degli starting items dall'occupazione
2. **status** - Impostato a `'APPROVED'`
3. **approvedAt** - Impostato a `new Date()`
4. **approvedBy** - Impostato all'ID di un utente admin trovato nel database (cerca admin/master, altrimenti primo utente disponibile)
5. **gameplayRoles** - Impostato a `['personaggio']`
6. **reviewNote** - Nota di approvazione (opzionale, può essere `null` o stringa)
7. **reviewHistory** - Aggiunta entry con:
   - `action: 'approve'`
   - `reviewedBy` - ObjectId dell'utente sistema trovato (richiesto dallo schema)
   - `note: note` (opzionale)
   - `reviewedAt: new Date()`

## Record CharacterFinances Creato

Viene creato un nuovo record CharacterFinances con:

- **characterId** - Riferimento al personaggio approvato
- **socialClass** - Nome della classe sociale basata sulla skill FINANZA
- **financeSkillValue** - Valore della skill FINANZA (1-99)
- **cash** - 30% della ricchezza iniziale calcolata
- **bankDeposit** - 70% della ricchezza iniziale calcolata
- **creditLine** - Configurato con:
  - `maxWeekly` - Credito settimanale massimo dalla classe sociale
  - `currentAvailable` - Credito disponibile (inizialmente uguale a maxWeekly)
  - `lastResetDate` - Data corrente
  - `nextResetDate` - Prossima domenica (calcolata con helper)
- **properties** - Array vuoto `[]`
- **lastCalculated** - Data corrente
- **createdAt** - Data corrente
- **updatedAt** - Data corrente

**IMPORTANTE**: Prima di creare il nuovo record, viene eliminato qualsiasi record CharacterFinances esistente per il personaggio (per sicurezza).

## Pattern di Implementazione

Quando l'utente chiede di approvare un personaggio:

1. **Connetti a MongoDB** usando:
   ```typescript
   import mongoose from 'mongoose';
   const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin';
   await mongoose.connect(MONGODB_URI);
   ```

2. **Importa i modelli necessari**:
   ```typescript
   import { Character, Occupation, CharacterFinances, SocialClassConfig, User } from '../../database/models';
   // Usa il path relativo corretto dal punto in cui stai lavorando
   ```
   
   **IMPORTANTE**: Devi anche importare `User` per trovare un utente da usare come `reviewedBy` (campo richiesto dallo schema).

3. **Trova utente sistema per reviewedBy**:
   - Cerca un utente admin/master nel database
   - Se non trovato, cerca un utente con email/username admin o system
   - Come fallback, usa il primo utente disponibile
   - Se nessun utente trovato, lancia errore (reviewedBy è richiesto dallo schema)

4. **Valida il personaggio**:
   - Trova il personaggio per ID
   - Verifica che esista
   - Verifica che sia in stato `PENDING_APPROVAL`
   - Se non valido, restituisci errore chiaro

5. **Recupera starting items dall'occupazione**:
   - Se il personaggio ha un'occupazione (`character.occupation`), trova l'Occupation
   - Estrai `occupation.benefits.startingItems` se presente
   - Mappa gli item per ottenere solo gli `itemId`: `startingItems.map(item => item.itemId)`

6. **Calcola skill FINANZA**:
   - Gestisci sia formato Map che object per `character.skills`
   - Supporta anche SkillBreakdown objects (con campo `total`)
   - Cerca chiavi: `'Finanza'`, `'FINANZA'`, `'finanza'`
   - Valore di default: `1` se non trovato
   - Limita tra 1 e 99: `Math.max(1, Math.min(99, finanzaSkill || 1))`

7. **Trova SocialClassConfig**:
   - Cerca configurazione dove `minFinanceSkill <= finanzaSkill <= maxFinanceSkill`
   - Se non trovata, lancia errore chiaro

8. **Calcola ricchezza iniziale**:
   - Usa `socialClassConfig.initialWealth.minCash` e `maxCash`
   - Default: `240` se non specificato
   - Calcola random: `Math.floor(Math.random() * (maxWealth - minWealth + 1)) + minWealth`
   - Cash: `Math.floor(baseWealth * 0.3)` (30%)
   - Bank: `Math.floor(baseWealth * 0.7)` (70%)

9. **Crea CharacterFinances**:
   - Elimina eventuale record esistente: `await CharacterFinances.deleteOne({ characterId: character._id })`
   - Crea nuovo record con tutti i campi calcolati
   - Usa `getNextSunday()` per `creditLine.nextResetDate`
   - Salva il record

10. **Aggiorna Character**:
   - Imposta `equipment = startingItems`
   - Imposta `status = 'APPROVED'`
   - Imposta `approvedAt = new Date()`
   - Imposta `approvedBy = systemUserId` (utente sistema trovato)
   - Imposta `gameplayRoles = ['personaggio']`
   - Imposta `reviewNote = note || null` (opzionale)
   - Aggiungi entry a `reviewHistory` con `reviewedBy = systemUserId` (inizializza array se non esiste)
   - Salva il personaggio

11. **Chiudi la connessione** dopo l'operazione:
    ```typescript
    await mongoose.disconnect();
    ```

## Funzione Helper: getNextSunday()

Calcola la prossima domenica per il reset del credit line:

```typescript
function getNextSunday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek; // Next Sunday
  
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0); // Reset to beginning of day
  
  return nextSunday;
}
```

## Note Importanti

- **Sempre chiudere la connessione** dopo l'uso per evitare connessioni aperte
- **Usa try/catch** per gestire errori di connessione o query
- **Verifica che il personaggio esista** prima di procedere
- **Verifica che sia in PENDING_APPROVAL** prima di approvare
- **Elimina CharacterFinances esistente** prima di crearne uno nuovo (per sicurezza)
- **Gestisci correttamente il formato delle skills** (Map vs object, con supporto per SkillBreakdown)
- **Valida che esista SocialClassConfig** per il valore FINANZA calcolato
- **Gestisci errori appropriatamente** con messaggi chiari per tutti i casi edge
- **reviewedBy è richiesto** dallo schema Character, quindi devi trovare un utente nel database da usare (cerca admin/master, altrimenti primo utente disponibile)

## Esempio Completo

Richiesta: `/approve-character 693dda96dfe0250b25663311`

Implementazione:
```typescript
import mongoose from 'mongoose';
import { Character, Occupation, CharacterFinances, SocialClassConfig, User } from '../../database/models';

const MONGODB_URI = 'mongodb://admin:password123@localhost:27017/tenpennynovels?authSource=admin';

// Helper function per calcolare prossima domenica
function getNextSunday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek; // Next Sunday
  
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0); // Reset to beginning of day
  
  return nextSunday;
}

try {
  await mongoose.connect(MONGODB_URI);
  
  const characterId = '693dda96dfe0250b25663311';
  const note = null; // Opzionale: nota di approvazione
  
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
      throw new Error('Nessun utente trovato nel database. Impossibile completare l\'approvazione senza reviewedBy.');
    }
  }
  
  // Trova e valida il personaggio
  const character = await Character.findOne({
    _id: characterId,
    status: 'PENDING_APPROVAL'
  }).lean(false);
  
  if (!character) {
    console.error('Personaggio non trovato o non in attesa di approvazione');
    process.exit(1);
  }
  
  // Recupera starting items dall'occupazione
  let startingItems = [];
  if (character.occupation) {
    const occupation = await Occupation.findById(character.occupation);
    if (occupation && occupation.benefits && occupation.benefits.startingItems) {
      startingItems = occupation.benefits.startingItems.map((item: any) => item.itemId);
    }
  }
  
  // Calcola skill FINANZA
  let finanzaSkill = 1; // Default fallback
  
  if (character.skills instanceof Map) {
    const finanzaValue = character.skills.get('Finanza') || character.skills.get('FINANZA') || character.skills.get('finanza');
    if (typeof finanzaValue === 'object' && finanzaValue !== null && 'total' in finanzaValue) {
      finanzaSkill = (finanzaValue as any).total;
    } else if (typeof finanzaValue === 'number') {
      finanzaSkill = finanzaValue;
    }
  } else if (character.skills && typeof character.skills === 'object') {
    const finanzaValue = (character.skills as any)['Finanza'] || (character.skills as any)['FINANZA'] || (character.skills as any)['finanza'];
    if (typeof finanzaValue === 'object' && finanzaValue !== null && 'total' in finanzaValue) {
      finanzaSkill = finanzaValue.total;
    } else if (typeof finanzaValue === 'number') {
      finanzaSkill = finanzaValue;
    }
  }
  
  // Limita tra 1 e 99
  finanzaSkill = Math.max(1, Math.min(99, finanzaSkill || 1));
  
  // Trova SocialClassConfig
  const socialClassConfig = await SocialClassConfig.findOne({
    minFinanceSkill: { $lte: finanzaSkill },
    maxFinanceSkill: { $gte: finanzaSkill }
  });
  
  if (!socialClassConfig) {
    throw new Error(`Nessuna classe sociale trovata per skill FINANZA: ${finanzaSkill}`);
  }
  
  const socialClassName = socialClassConfig.name;
  
  // Calcola ricchezza iniziale
  const minWealth = socialClassConfig.initialWealth?.minCash || 240;
  const maxWealth = socialClassConfig.initialWealth?.maxCash || 240;
  const baseWealth = Math.floor(Math.random() * (maxWealth - minWealth + 1)) + minWealth;
  
  // Elimina CharacterFinances esistente e crea nuovo
  await CharacterFinances.deleteOne({ characterId: character._id });
  
  const characterFinances = new CharacterFinances({
    characterId: character._id,
    socialClass: socialClassName,
    financeSkillValue: finanzaSkill,
    cash: Math.floor(baseWealth * 0.3), // 30% in cash
    bankDeposit: Math.floor(baseWealth * 0.7), // 70% in bank
    creditLine: {
      maxWeekly: socialClassConfig.weeklyCredit,
      currentAvailable: socialClassConfig.weeklyCredit,
      lastResetDate: new Date(),
      nextResetDate: getNextSunday()
    },
    properties: [],
    lastCalculated: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  await characterFinances.save();
  
  // Aggiorna Character
  character.equipment = startingItems;
  character.status = 'APPROVED';
  character.approvedAt = new Date();
  character.approvedBy = systemUserId; // Usa l'utente sistema trovato
  character.gameplayRoles = ['personaggio'];
  character.reviewNote = note || null;
  
  // Aggiungi a review history
  const reviewEntry = {
    action: 'approve',
    reviewedBy: systemUserId, // Richiesto dallo schema
    note: note || null,
    reviewedAt: new Date()
  };
  
  character.reviewHistory = character.reviewHistory || [];
  character.reviewHistory.push(reviewEntry);
  
  await character.save();
  
  console.log('Personaggio approvato con successo!');
  console.log(`ID: ${characterId}`);
  console.log(`Nome: ${character.name}`);
  console.log(`Starting items assegnati: ${startingItems.length}`);
  console.log(`Classe sociale: ${socialClassName}`);
  console.log(`Skill FINANZA: ${finanzaSkill}`);
  console.log(`Ricchezza iniziale: ${baseWealth}£ (Cash: ${characterFinances.cash}£, Bank: ${characterFinances.bankDeposit}£)`);
  
} catch (error: any) {
  console.error('Errore durante l\'approvazione del personaggio:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
```

