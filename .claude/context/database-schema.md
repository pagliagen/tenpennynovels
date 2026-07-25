# Database schema — dove trovare la verità

Questo file **non** elenca più i modelli: la lista si de-sincronizzava a ogni aggiunta (documentava 41 modelli su 56 reali). Lo schema si muove spesso — il forum è in sviluppo attivo — quindi qui trovi solo come ottenere il dato aggiornato.

## Fonte autorevole: il codice

```bash
ls services/unified-backend/src/database/models/          # elenco completo, sempre esatto
cat services/unified-backend/src/database/models/index.ts # barrel export
```

## Documentazione descrittiva

`docs/tecnica/infrastructure/mongodb-schemas.md` — campi, indici e relazioni raggruppati per dominio.

⚠️ **È parziale**: copre ~42 collection su 56 modelli reali. Tra i non documentati:
`ForumCategory`, `ForumTopic*`, `ForumDiscussion*`, `ForumBookmark`, `ForumNotification`, `ForumCharacterPreference`,
`CombatEncounter`, `SkillConfrontation`, `SecurityAlert`, `ModerationAlert`,
`MessageBackup`, `OffGameThread`, `OnGameThread`, `OffGameChatParticipant`.

Se un modello non è nel doc, **non concludere che non esista**: verifica con `ls`.

## Relazioni principali

```
Character ──userId──────────────► User
          ──currentLocationId──► Location
          ──corporationId─────► Corporation  (opzionale)
          ──relations─────────► CharacterRelation
          └─ CharacterFinances · CharacterProgression · CharacterNotes  (1:1 / 1:N)

Location  ──occupants[]────────► Character
          └─ Chat · LocationProperty · Shop

Document  └─ DocumentChunk (1:N, per embedding) · DocumentSubtype
```

## Convenzioni non negoziabili

- **`_id`, mai `id`** in tutte le response → `.claude/rules/00-critical.md` §1
- **Soft delete** via `deletedAt`: escluso di default dalle query, `includeDeleted` per includerlo
- Codici errore: `services/unified-backend/src/shared/utils/errorCodes.ts` (registry: `docs/tecnica/backend/error-codes.md`)

## Quando aggiungi un modello

Aggiorna `docs/tecnica/infrastructure/mongodb-schemas.md` nello stesso commit: è l'unico modo per non allargare il divario di 14 modelli già accumulato.
