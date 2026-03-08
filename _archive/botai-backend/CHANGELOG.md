# BotAI Backend - Changelog

All notable changes to the BotAI Backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.2.0] - 2026-02-09

### Added - Advanced Psychology System

#### Psychological Axes
- **6 Psychological Axes** (-3 to +3) che governano reazioni istintive:
  - `rationalEmotional`: Razionale ↔ Emotivo
  - `controlledImpulsive`: Controllato ↔ Impulsivo
  - `cynicalIdealist`: Cinico ↔ Idealista
  - `proudSubmissive`: Orgoglioso ↔ Remissivo
  - `prudentParanoid`: Prudente ↔ Paranoico
  - `directAllusive`: Diretto ↔ Allusivo

#### Central Wound (Ferita Centrale)
- Campo `centralWound` con:
  - `wound`: Bisogno/ferita psicologica profonda
  - `manifestation`: Come si manifesta nel comportamento

#### Duality (Dualità Pubblica/Privata)
- Campo `duality` con:
  - `publicMask`: Maschera sociale mostrata pubblicamente
  - `privateTruth`: Verità interiore (emerge solo con trust > 80)

#### Active Emotions (Emozioni Attive)
- Array `activeEmotions` con emozioni temporanee:
  - `emotion`: Nome dell'emozione
  - `intensity`: Intensità 1-10
  - `trigger`: Causa dell'emozione (opzionale)
  - `startedAt`: Timestamp inizio

### Added - Enhanced Relationship System

#### Relationship Archetypes
- Campo `relationshipArchetype`:
  - `type`: Tipo relazione (mentor, rival, romantic, business, suspicious, protective, apprentice)
  - `description`: Descrizione dell'archetipo
  - `canEvolve`: Se può evolvere in altro tipo

#### Source Credibility
- Campo `sourceCredibility`:
  - `reliability`: Affidabilità come fonte (-3 a +3)
  - `basedOn`: Motivo del giudizio

#### Latent Tensions (Tensioni Latenti)
- Array `latentTensions` con sospetti non confermati:
  - `subject`: Oggetto della tensione
  - `severity`: Gravità 1-10
  - `state`: 'dormant' | 'active' | 'resolved'
  - `source`: Come è emerso il sospetto
  - `discoveredAt`: Timestamp scoperta

### Added - Locked Bot AI Decision System

- Nuovo metodo `BotSelectionService.shouldLockedBotRespond()`
- Bot già assegnati a tag decidono tramite AI se rispondere
- Previene spam di risposte inappropriate
- Confidence scoring + reasoning per ogni decisione
- Flow:
  1. Azione arriva su tag con bot già assegnato
  2. AI analizza contenuto, storico, personalità
  3. AI decide se bot deve rispondere
  4. Fornisce reasoning della decisione

### Added - Anti-Repetition System

- **Session History Analysis**: Bot riceve storico completo e evita ripetizioni
- **Information Dosing**: Istruzioni per dosare informazioni personali
- **Blacklist di Concetti**: Elenco concetti vietati dopo prima menzione:
  - Viaggi/esperienze all'estero
  - "Ho visto molte cose", "esperienza internazionale"
  - Anni di commercio/esperienza
  - "Ho imparato che...", "So per esperienza che..."
  - Riferimenti ripetuti al background
- **Focus sul Presente**: Concentrazione sul "qui e ora" invece che sul passato

### Added - Victorian Narrative Style

- Stile narrativo ispirato ad **Agatha Christie**
- Appellativi d'epoca corretti:
  - "signore", "signora", "giovanotto", "mia cara"
  - Uso del cognome quando conosciuto: "Signor Feldon"
- **Guillemets francesi obbligatori** per dialoghi: « »
  - ❌ NON usare virgolette "", trattini, o altri simboli
- Descrizioni narrative in terza persona:
  - ✅ "il giovane gentiluomo", "il signore"
  - ❌ "tu", "te", "ti" (troppo moderno)

### Changed

#### Response Generation
- **Lunghezza risposte aumentata**: 500-1000 caratteri (vs 600-800 precedente)
- Adattamento dinamico basato su lunghezza media azioni giocatori
- Range dinamico: se giocatori scrivono lungo, bot risponde lungo
- Istruzioni più dettagliate per evitare tono moderno

#### Relationship Field Names (BREAKING CHANGE)
- `trust` → `trustLevel` (0-100)
- `familiarity` → `familiarityLevel` (0-100)
- `sentiment` → `sentimentScore` (0-100, before was -100 to 100)

### Migration Notes

#### Database Migration Required
```javascript
// Rename relationship fields
db.relationships.updateMany({}, {
  $rename: {
    "trust": "trustLevel",
    "familiarity": "familiarityLevel",
    "sentiment": "sentimentScore"
  }
});

// Convert sentiment from -100/100 to 0/100
db.relationships.updateMany({ sentimentScore: { $lt: 0 } }, [
  { $set: { sentimentScore: { $add: ["$sentimentScore", 100] } } }
]);
```

#### Code Updates Required
- Update all references to `trust` → `trustLevel`
- Update all references to `familiarity` → `familiarityLevel`
- Update all references to `sentiment` → `sentimentScore`
- Update sentiment value range from -100/100 to 0/100

---

## [1.1.0] - 2026-02-06

### Added

#### AI-Powered Bot Generation (BotGeneratorService)
- Generazione automatica bot tramite Claude AI
- Sistema a due fasi: generazione in inglese + traduzione italiana
- Contesto Victoria London 1889 integrato
- Generazione completa di personality, stats, background

#### Intelligent Bot Selection (BotSelectionService)
- Selezione AI-driven del bot più appropriato per ogni zona
- Analisi multi-tag context
- Confidence scoring e reasoning explanation
- First activation logic per sessioni multi-bot
- Nuovo metodo: `selectBotForFirstActivation()`

#### Enhanced Bot Model
- Campo `gender` (male/female) con pronomi corretti nei prompt
- Campo `surname` opzionale per nomi completi
- Campo `publicDescription` per descrizione fisica

#### Improved Context Building
- `recentActionsByCharacter`: Azioni raggruppate per personaggio
- `averagePlayerActionLength`: Adattamento dinamico lunghezza risposta
- `multiTagActions`: Context multi-zona per awareness completa
- `isFirstEncounter`: Detection prima interazione

#### New Services
- `ActionHistoryService`: Gestione storico azioni
- `CharacterSnapshotService`: Snapshot personaggi per riferimenti storici

### Changed

#### Dependencies Updated
- Node.js 18.x → 22.x
- `@anthropic-ai/sdk` updated to v0.72.1
- Express updated to 5.2.1
- Mongoose updated to 9.1.6

#### Environment Variables (BREAKING CHANGE)
- `CLAUDE_API_KEY` → `ANTHROPIC_API_KEY`
- Default model changed: `claude-opus-4-5-20251101` → `claude-3-5-sonnet-20241022`
- New required variable: `TRANSLATE_MODEL` for Italian translation

### Migration Notes

#### Environment File Updates
```bash
# OLD (.env v1.0):
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-5-20251101

# NEW (.env v1.1):
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-3-5-sonnet-20241022
TRANSLATE_MODEL=claude-sonnet-4-5-20250929
```

#### Bot Model Updates (Optional)
```javascript
// Add gender field to existing bots
db.bots.updateMany(
  { gender: { $exists: false } },
  { $set: { gender: 'male' } }  // Default for existing bots
);
```

---

## [1.0.0] - 2026-01-XX

Initial release with core features:

### Features
- Claude API integration for bot responses
- Bot personality system (traits, values, goals)
- Relationship tracking (trust, familiarity, sentiment)
- Bot memory system
- Sentiment analysis
- Turn-based system integration
- Tag-based spatial zones
- Webhook integration with Game Backend
- MongoDB separate database

### Technical Stack
- Node.js 18.x
- Express 5.1.0
- Mongoose 7.x
- @anthropic-ai/sdk
- Claude 3 Opus model

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements
- **BREAKING CHANGE**: Changes that break backward compatibility
