# Fix Character Ages Script

Aggiorna tutti i personaggi con `age = 0` a `age = 16` (valore minimo consentito dalla validazione Mongoose).

## Problema

Il modello `Character` ha una validazione `min: 16` sul campo `age`. Alcuni PNG/PG_MASTER creati senza età hanno `age = 0`, causando errori di validazione al salvataggio:

```json
{
  "error": "Character validation failed: age: Path `age` (0) is less than minimum allowed value (16)."
}
```

## Soluzione

Questo script aggiorna automaticamente tutti i personaggi con `age = 0` portandola a `16`.

## Uso

### 🐳 Locale (Docker MongoDB)

```bash
# Dry-run (mostra cosa verrebbe aggiornato senza modificare)
node scripts/fix-character-ages.js --dry-run

# Esecuzione reale
node scripts/fix-character-ages.js
```

Lo script carica automaticamente `.env` dalla root del progetto.

### 🌐 Produzione (MongoDB remoto)

```bash
# Dry-run su produzione
MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/botai-prod" \
  node scripts/fix-character-ages.js --dry-run --db=botai-prod

# Esecuzione reale su produzione
MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/botai-prod" \
  node scripts/fix-character-ages.js --db=botai-prod
```

### Opzioni

- `--dry-run` - Mostra cosa verrebbe aggiornato senza fare modifiche
- `--db=DATABASE_NAME` - Specifica il database (auto-rilevato dalla URI se omesso)

## Output

Lo script mostra:
1. Numero di personaggi con `age = 0`
2. Numero di personaggi con `age = null/undefined` (info, non verranno modificati)
3. Lista dettagliata dei personaggi da aggiornare
4. Conferma prima di procedere (3 secondi di pausa)
5. Risultato dell'aggiornamento

## Sicurezza

- **Dry-run consigliato** - Esegui sempre prima con `--dry-run` per verificare
- **Backup** - Fai backup del database prima di eseguire in produzione
- **Non modifica age null/undefined** - Solo `age = 0` viene aggiornata (null/undefined è valido perché il campo è opzionale)
- **Ignora soft-deleted** - I personaggi con `deleted: true` vengono ignorati

## Riferimenti

- [Character.ts:249-252](../services/unified-backend/src/database/models/Character.ts#L249-L252) - Definizione schema `age`
