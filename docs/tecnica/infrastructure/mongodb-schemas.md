# MongoDB Schemas

**Navigation**: [Home](../../INDEX.md) > [Infrastructure](./README.md) > MongoDB Schemas

**Status**: ✅ Production Ready | **Last Updated**: 2026-07-25

Complete reference per tutti gli schema MongoDB di TenPennyNovels (56 collections).

---

## Overview

TenPennyNovels utilizza MongoDB 7.0 come database principale con **56 collections** organizzate per categoria funzionale. Tutti gli schema sono definiti con Mongoose 9.3.0 e includono indexes ottimizzati per performance.

**Database**: `tenpennynovels`
**ORM**: Mongoose 9.3.0
**Total Collections**: 56
**Auth Mode**: Enabled (`--auth`)

Fonte autorevole per l'elenco: `ls services/unified-backend/src/database/models/`. Questo documento raggruppa i 56 modelli per dominio; la sezione [Core Schemas Details](#core-schemas-details) più sotto entra nel dettaglio dei campi solo per i modelli più centrali — per gli altri, leggere il file del modello.

---

## Schema Categories

### Core User & Authentication (3)
```mermaid
flowchart LR
    subgraph Core["Core User & Authentication"]
        User[User - Utenti del sistema]
        CharacterSession[CharacterSession - Sessioni attive]
        SystemConfiguration[SystemConfiguration - Configurazioni]
    end
```

### Characters (5)
```mermaid
flowchart LR
    subgraph Characters["Characters"]
        Character[Character - Dati base personaggi]
        CharacterProgression[CharacterProgression - Stats, skills, experience]
        CharacterFinances[CharacterFinances - Credits, transactions]
        CharacterNotes[CharacterNotes - Note Master]
        CharacterRelation[CharacterRelation - Relazioni tra character]
    end
```

### Locations & Housing (2)
```mermaid
flowchart LR
    subgraph Locations["Locations & Housing"]
        Location[Location - Hierarchical locations]
        LocationProperty[LocationProperty - Proprietà immobiliari]
    end
```

### Chat & Messaging (11)
```mermaid
flowchart LR
    subgraph MsgComm["Chat & Messaging"]
        Chat[Chat - Messaggi chat location]
        ChatModerationAction[ChatModerationAction - Moderazione chat]
        MessageReport[MessageReport - Segnalazioni messaggi]
        MessageBackup[MessageBackup - Backup messaggi]
        OffGameChat[OffGameChat - Chat off-game]
        OffGameChatMessage[OffGameChatMessage - Messaggi chat OOC]
        OffGameChatParticipant[OffGameChatParticipant - Partecipanti chat OOC]
        OffGameMessage[OffGameMessage - Messaggistica off-game]
        OffGameThread[OffGameThread - Thread off-game]
        OnGameMessage[OnGameMessage - Postal system]
        OnGameThread[OnGameThread - Thread postal system]
    end
```

### Forum (12)
```mermaid
flowchart LR
    subgraph Forum["Forum"]
        ForumCategory[ForumCategory - Categorie]
        ForumTopic[ForumTopic - Topic]
        ForumTopicFavorite[ForumTopicFavorite - Preferiti topic]
        ForumTopicPermissionOverride[ForumTopicPermissionOverride - Permessi custom]
        ForumTopicReadState[ForumTopicReadState - Stato lettura]
        ForumDiscussion[ForumDiscussion - Discussioni]
        ForumDiscussionFavorite[ForumDiscussionFavorite - Preferiti discussione]
        ForumDiscussionSubscription[ForumDiscussionSubscription - Sottoscrizioni]
        ForumPost[ForumPost - Post]
        ForumBookmark[ForumBookmark - Bookmark sui post]
        ForumNotification[ForumNotification - Notifiche]
        ForumCharacterPreference[ForumCharacterPreference - Preferenze utente]
    end
```
Retrieval: `docs/tecnica/backend/unified-backend.md` §5 (modulo mounted su `/forum`).

### Documents & Content (3)
```mermaid
flowchart LR
    subgraph Documents["Documents & Content"]
        Document[Document - Ambientazione/regolamento]
        DocumentSubtype[DocumentSubtype - Sottotipi documento]
        DocumentChunk[DocumentChunk - Chunks semantic search]
    end
```

### Gaming Sessions (3)
```mermaid
flowchart LR
    subgraph Gaming["Gaming Sessions"]
        GamingSession[GamingSession - Sessioni di gioco]
        SessionManagement[SessionManagement - Gestione sessioni]
        SessionTemplate[SessionTemplate - Template sessioni]
    end
```

### Combat & Skill Checks (2)
```mermaid
flowchart LR
    subgraph Combat["Combat & Skill Checks"]
        CombatEncounter[CombatEncounter - Incontri di combattimento]
        SkillConfrontation[SkillConfrontation - Confronti/opposed check]
    end
```

### Tickets & Support (3)
```mermaid
flowchart LR
    subgraph Tickets["Tickets & Support"]
        Ticket[Ticket - Ticket supporto]
        TicketMessage[TicketMessage - Messaggi thread]
        TicketNotification[TicketNotification - Notifiche]
    end
```

### Corporations (1)
```mermaid
flowchart LR
    subgraph Corp["Corporations"]
        Corporation[Corporation - Clubs/aziende/gang]
    end
```

### Game Rules (3)
```mermaid
flowchart LR
    subgraph Rules["Game Rules"]
        Occupation[Occupation - 55 occupazioni CoC Victorian]
        Skill[Skill - Skill system]
        SocialClassConfig[SocialClassConfig - Classi sociali]
    end
```

### Items & Inventory (1)
```mermaid
flowchart LR
    subgraph Items["Items & Inventory"]
        Item[Item - Equipaggiamento, oggetti]
    end
```

### Moderation, Security & Audit (5)
```mermaid
flowchart LR
    subgraph Mod["Moderation, Security & Audit"]
        ModerationAlert[ModerationAlert - Alert moderazione]
        SecurityAlert[SecurityAlert - Alert sicurezza]
        UserReport[UserReport - Segnalazioni utenti]
        AuditLog[AuditLog - Log di audit]
        DeletedRecord[DeletedRecord - Archivio record eliminati]
    end
```

### System Events (2)
```mermaid
flowchart LR
    subgraph Events["System Events"]
        WebSocketEvent[WebSocketEvent - Eventi real-time]
        BroadcastMessage[BroadcastMessage - Messaggi broadcast]
    end
```

---

## Core Schemas Details

### User

**Purpose**: Autenticazione e dati utente

```typescript
interface IUser {
  _id: ObjectId;
  email: string;              // unique, lowercase, required
  password: string;           // bcrypt hashed
  username: string;           // unique, required
  role: 'user' | 'admin' | 'master';
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `email` (unique)
- `username` (unique)
- `emailVerificationToken`
- `passwordResetToken`

---

### Character

**Purpose**: Dati base personaggi (Call of Cthulhu Victorian)

```typescript
interface ICharacter {
  _id: ObjectId;
  userId: ObjectId;           // ref: User
  name: string;               // required
  slug: string;               // unique, URL-friendly
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  occupation: ObjectId;       // ref: Occupation
  socialClass?: ObjectId;     // ref: SocialClassConfig
  currentLocation?: ObjectId; // ref: Location

  // Biographical
  age?: number;
  gender?: string;
  residence?: string;
  birthplace?: string;

  // Appearance
  avatar?: string;            // URL image
  description?: string;

  // Background
  background?: string;
  notes?: string;

  // Timestamps
  approvedAt?: Date;
  approvedBy?: ObjectId;      // ref: User
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `userId`
- `slug` (unique)
- `status`
- `currentLocation`

**Details**: [Personaggi (funzionale)](../../funzionale/personaggi.md)

---

### CharacterProgression

**Purpose**: Stats, skills, experience

```typescript
interface ICharacterProgression {
  _id: ObjectId;
  characterId: ObjectId;      // ref: Character

  // Call of Cthulhu Stats
  stats: {
    STR: number;              // Strength (20-100)
    CON: number;              // Constitution (20-100)
    SIZ: number;              // Size (20-100)
    DEX: number;              // Dexterity (20-100)
    INT: number;              // Intelligence (15-100)
    POW: number;              // Power (15-100)
    EDU: number;              // Education (15-100)
    CHA: number;              // Charisma (15-100)
  };

  // Derived Stats
  hitPoints: {
    max: number;
    current: number;
  };
  sanity: {
    max: number;
    current: number;
  };
  luck: number;
  magicPoints: {
    max: number;
    current: number;
  };

  // Skills (skill ObjectId → value)
  skills: Map<ObjectId, number>;

  // Experience
  experience: {
    total: number;
    available: number;        // Spendable XP
    lastGranted?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `characterId` (unique)

**Calculation**: HP = (CON + SIZ) / 10, Sanity = POW, MP = POW / 5, Luck = 3d6 * 5

---

### CharacterFinances

**Purpose**: Credit rating, transactions, saldo

```typescript
interface ICharacterFinances {
  _id: ObjectId;
  characterId: ObjectId;      // ref: Character

  // Credits
  creditRating: number;       // Call of Cthulhu Credit Rating (0-99)
  cashOnHand: number;         // Pounds Sterling (£)
  savings: number;            // Bank account
  assets: number;             // Property value, investments

  // Spending
  monthlyExpenses: number;    // Rent, servants, etc.

  // Credit Line (for purchases > cash)
  creditLine: {
    available: number;
    limit: number;
    used: number;
    resetDate: Date;          // Monthly reset
  };

  // Transactions history (embedded)
  transactions: Array<{
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    description: string;
    date: Date;
  }>;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `characterId` (unique)

**Details**: [Unified Backend](../backend/unified-backend.md) (modulo game / economia)

---

### Location

**Purpose**: Hierarchical locations (Londra, boroughs, locations)

```typescript
interface ILocation {
  _id: ObjectId;
  name: string;               // required
  slug: string;               // unique, URL-friendly

  // Hierarchy
  type: 'root' | 'district' | 'location';
  parentId?: ObjectId;        // ref: Location (null per root)

  // Geographic
  coordinates?: {
    lat: number;
    lng: number;
  };

  // Access Control
  isAccessible: boolean;      // Se visibile/entrabile
  accessRequirements?: {
    minCreditRating?: number;
    requiredItems?: ObjectId[]; // ref: Item
    allowedOccupations?: ObjectId[]; // ref: Occupation
  };

  // Settings
  settings: {
    visible: boolean;         // Visible on map
    chat: boolean;            // Chat abilitata
    shop: boolean;            // Shop disponibile
    private: boolean;         // Private (invito richiesto)
  };

  // State
  occupants: ObjectId[];      // ref: Character (current occupants)
  capacity?: number;          // Max occupants

  // Content
  description?: string;
  masterNotes?: string;       // Only for Masters

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `slug` (unique)
- `type`
- `parentId`
- `isAccessible`
- `occupants`

**Example Hierarchy**:
```text
London (root)
├── Westminster (district)
│   ├── Westminster Abbey (location)
│   └── Houses of Parliament (location)
└── Whitechapel (district)
    ├── Ten Bells Pub (location)
    └── Whitechapel Market (location)
```

**Details**: [Locations (funzionale)](../../funzionale/locations.md)

---

### LocationProperty

**Purpose**: Proprietà immobiliari (rental/purchase)

```typescript
interface ILocationProperty {
  _id: ObjectId;
  locationId: ObjectId;       // ref: Location
  name: string;
  description?: string;

  // Property Type
  propertyType: 'rent' | 'purchase';

  // Pricing
  monthlyRent?: number;       // If rental
  purchasePrice?: number;     // If purchase

  // Current Status
  isAvailable: boolean;
  currentTenantId?: ObjectId; // ref: Character (rental)
  ownerId?: ObjectId;         // ref: Character (purchase)

  // Rental Management
  rentPaidUntil?: Date;       // Ultimo pagamento affitto
  rentDueDate?: Date;         // Prossima scadenza

  // Features
  capacity?: number;          // Max occupants
  rooms?: number;
  amenities?: string[];

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `locationId`
- `isAvailable`
- `currentTenantId`
- `ownerId`
- `rentDueDate`

**Cron Jobs**:
- Rent collection: Daily at 6am UTC
- Eviction: 14+ days overdue

**Details**: [Housing (funzionale)](../../funzionale/housing.md)

---

### OnGameMessage

**Purpose**: Messaggi on-game (postal system Victorian)

```typescript
interface IOnGameMessage {
  _id: ObjectId;
  threadId: string;           // Group messages by thread

  // Sender/Recipient
  senderId: ObjectId;         // ref: Character
  recipientId: ObjectId;      // ref: Character

  // Content
  subject?: string;
  body: string;               // required

  // Delivery Status
  status: 'draft' | 'sent' | 'delivered' | 'read';
  deliveryDate?: Date;        // When delivered (postal delay)
  readAt?: Date;

  // Threading
  inReplyTo?: ObjectId;       // ref: OnGameMessage (parent message)

  // Flags
  isImportant?: boolean;
  isDeleted?: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `threadId`
- `senderId`
- `recipientId`
- `status`
- `deliveryDate`

**Postal Delivery**: Cron job daily (simula tempi di consegna vittoriani)

**Details**: [WebSocket Events](../backend/websocket-events.md)

---

### Document

**Purpose**: Documenti ambientazione/regolamento

```typescript
interface IDocument {
  _id: ObjectId;
  title: string;              // required
  slug: string;               // unique, URL-friendly

  // Type
  type: 'ambientazione' | 'regolamento';

  // Content
  content: string;            // Markdown

  // Hierarchy
  sectionId?: ObjectId;       // ref: DocumentSubtype
  parentDocumentId?: ObjectId; // ref: Document
  order: number;              // Sort order within section

  // Visibility
  isPublished: boolean;
  visibility: 'public' | 'authenticated' | 'admin';

  // Metadata
  tags?: string[];
  author?: ObjectId;          // ref: User

  // Embedding (for semantic search)
  hasEmbedding: boolean;      // Se embedding generato
  embeddingId?: string;       // UUID in Qdrant

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `slug` (unique)
- `type`
- `sectionId`
- `isPublished`
- `hasEmbedding`

**Embeddings**: Generati async via embeddings-worker → Qdrant

**Details**: [Embeddings Worker](../backend/embeddings-worker.md)

---

### DocumentChunk

**Purpose**: Chunking documenti per semantic search

```typescript
interface IDocumentChunk {
  _id: ObjectId;
  documentId: ObjectId;       // ref: Document

  // Chunk Data
  content: string;            // Text chunk (max 512 tokens)
  chunkIndex: number;         // 0-based index

  // Embedding
  embeddingId: string;        // UUID in Qdrant
  hasEmbedding: boolean;

  // Metadata
  metadata?: {
    heading?: string;
    sectionTitle?: string;
  };

  createdAt: Date;
}
```

**Chunking Strategy**:
- Max 512 tokens per chunk
- Overlap: 50 tokens tra chunks consecutivi
- Preserve paragraph boundaries

---

### Occupation

**Purpose**: 55 occupazioni Call of Cthulhu Victorian

```typescript
interface IOccupation {
  _id: ObjectId;
  name: string;               // unique, e.g., "Detective"
  description?: string;

  // Credit Rating Range
  creditRating: {
    min: number;              // e.g., 20
    max: number;              // e.g., 50
  };

  // Required Skills (must have at 40+)
  requiredSkills: ObjectId[]; // ref: Skill

  // Bonus Skills (choose from, +30 pts to distribute)
  bonusSkills: ObjectId[];    // ref: Skill
  bonusSkillPoints: number;   // Default: 30

  // Victorian Era Specifics
  era: 'victorian';
  socialClass?: string;       // Upper, Middle, Working

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `name` (unique)

**Examples**: Detective, Physician, Artist, Journalist, Antiquarian, Dilettante

**Details**: [Glossario — Occupation](../../GLOSSARY.md#game-system-terminology)

---

### Skill

**Purpose**: Sistema skills Call of Cthulhu

```typescript
interface ISkill {
  _id: ObjectId;
  name: string;               // unique, e.g., "Accounting"
  category: 'mental' | 'physical' | 'combat' | 'social';

  // Base Value
  baseValue: number;          // Default starting value (e.g., 5)

  // Specializations
  isSpecializable: boolean;   // e.g., Art/Craft, Language
  predefinedValues?: string[]; // e.g., ["Painting", "Sculpture"] for Art/Craft

  // Rules
  description?: string;
  usageNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `name` (unique)

**Total Skills**: ~80 (base + specializations)

**Details**: [Glossario — Skills](../../GLOSSARY.md#game-system-terminology)

---

### Corporation

**Purpose**: Corporations (clubs, aziende, gang, società)

```typescript
interface ICorporation {
  _id: ObjectId;
  name: string;
  type: 'club' | 'company' | 'gang' | 'society';

  // Ownership
  founderId: ObjectId;        // ref: Character
  leaderId: ObjectId;         // ref: Character (current leader)

  // Members
  members: Array<{
    characterId: ObjectId;    // ref: Character
    role: 'leader' | 'officer' | 'member';
    joinedAt: Date;
  }>;

  // Housing Integration
  properties: ObjectId[];     // ref: LocationProperty (owned by corporation)

  // Finances
  treasury: number;           // Corporation funds (£)

  // Description
  description?: string;
  goals?: string;
  headquarters?: ObjectId;    // ref: Location

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes**:
- `founderId`
- `leaderId`
- `members.characterId`
- `isActive`

**Details**: [Corporazioni (funzionale)](../../funzionale/corporazioni.md)

---

### WebSocketEvent

**Purpose**: Eventi real-time per WebSocket broadcasting

```typescript
interface IWebSocketEvent {
  _id: ObjectId;
  eventType: 'character_updated' | 'location_action' | 'message_received' | 'turn_changed';

  // Target
  room?: string;              // Socket.IO room (e.g., "location:123")
  targetUserId?: ObjectId;    // ref: User (private event)
  targetCharacterId?: ObjectId; // ref: Character

  // Payload
  payload: any;               // Event-specific data

  // Status
  processed: boolean;
  processedAt?: Date;

  createdAt: Date;
}
```

**Indexes**:
- `processed`
- `room`
- `targetUserId`
- `createdAt` (TTL: 24h auto-delete)

**Details**: [WebSocket Patterns](../frontend/websocket-patterns.md)

---

## Common Patterns

### ObjectId References

```typescript
// Mongoose reference
userId: {
  type: Schema.Types.ObjectId,
  ref: 'User',
  required: true
}

// Population
const character = await Character.findById(id).populate('userId');
```

---

### Slugs (URL-friendly)

```typescript
// Generate slug
import slugify from 'slugify';

const slug = slugify(name, { lower: true, strict: true });

// Example: "Westminster Abbey" → "westminster-abbey"
```

**Uniqueness**: Aggiungere suffix numerico se duplicato (`westminster-abbey-2`)

---

### Soft Delete

```typescript
// Invece di hard delete
isDeleted: {
  type: Boolean,
  default: false
}

// Query
const activeCharacters = await Character.find({ isDeleted: false });
```

---

### Timestamps

```typescript
// Mongoose automatic timestamps
{
  timestamps: true  // Adds createdAt, updatedAt
}
```

---

### Embedded vs Referenced

**Embedded** (preferito se <16MB totale):
```typescript
transactions: [{
  type: String,
  amount: Number,
  date: Date
}]
```

**Referenced** (preferito se growing indefinitamente):
```typescript
messages: [{
  type: Schema.Types.ObjectId,
  ref: 'Message'
}]
```

---

## Indexes Strategy

### Primary Indexes

Tutti gli schema hanno `_id` index automatico (unique).

---

### Composite Indexes

```typescript
// Example: Location occupants query
schema.index({ type: 1, isAccessible: 1 });

// Query optimization
await Location.find({ type: 'location', isAccessible: true });
```

---

### Text Indexes

```typescript
// Full-text search
schema.index({ name: 'text', description: 'text' });

// Query
await Document.find({ $text: { $search: 'victorian london' } });
```

---

### TTL Indexes

```typescript
// Auto-delete dopo 24h
schema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// Use case: WebSocketEvent, temporary tokens
```

---

## Performance Optimization

### Connection Pooling

```typescript
// Mongoose 9.3.0 connection
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,      // Max connections
  minPoolSize: 2,       // Min connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
});
```

---

### Query Optimization

```typescript
// ❌ BAD - N+1 query problem
const characters = await Character.find();
for (const char of characters) {
  const user = await User.findById(char.userId);
}

// ✅ GOOD - Populate
const characters = await Character.find().populate('userId');

// ✅ BETTER - Lean (plain JS objects, no Mongoose overhead)
const characters = await Character.find().populate('userId').lean();
```

---

### Aggregation Pipeline

```typescript
// Complex queries
const stats = await Character.aggregate([
  { $match: { status: 'approved' } },
  { $group: {
    _id: '$occupation',
    count: { $sum: 1 },
    avgCreditRating: { $avg: '$creditRating' }
  }},
  { $sort: { count: -1 } }
]);
```

---

## Migrations

### Schema Changes

**Location**: `services/unified-backend/src/database/migrations/`

**Example**: `migrate-skills-to-objectid-keys.ts`

```typescript
// Migration script
export async function migrateSkillsToObjectId() {
  const progressions = await CharacterProgression.find();

  for (const prog of progressions) {
    // Convert skills Map keys from string to ObjectId
    const newSkills = new Map();
    for (const [key, value] of prog.skills.entries()) {
      newSkills.set(new Types.ObjectId(key), value);
    }
    prog.skills = newSkills;
    await prog.save();
  }
}
```

**Run**:
```bash
docker exec tenpennynovels-unified-backend npm run migrate:skills
```

---

## Backup & Restore

### Backup

```bash
# MongoDB dump
docker exec tenpennynovels-mongodb mongodump \
  --username=admin \
  --password=$MONGO_ROOT_PASSWORD \
  --authenticationDatabase=admin \
  --db=tenpennynovels \
  --out=/backups/$(date +%Y%m%d)

# Compress
tar -czf backup-20260301.tar.gz /backups/20260301
```

---

### Restore

```bash
# Extract
tar -xzf backup-20260301.tar.gz

# Restore
docker exec -i tenpennynovels-mongodb mongorestore \
  --username=admin \
  --password=$MONGO_ROOT_PASSWORD \
  --authenticationDatabase=admin \
  --db=tenpennynovels \
  --drop \
  /backups/20260301/tenpennynovels
```

**Details**: [Deploy README](../../deploy/README.md) (backup DB / volumi secondo ambiente)

---

## Related Documentation

- [Docker Compose](./docker-compose.md) - MongoDB container configuration
- [Environment Variables](./environment-variables.md) - MONGODB_URI setup
- [Personaggi (funzionale)](../../funzionale/personaggi.md)
- [Locations (funzionale)](../../funzionale/locations.md)
- [Housing (funzionale)](../../funzionale/housing.md)
- [WebSocket Events](../backend/websocket-events.md)

---

## Quick Reference

**Total Collections**: 56
**Database**: `tenpennynovels`
**MongoDB Version**: 7.0
**ORM**: Mongoose 9.3.0
**Auth**: Enabled (`--auth`)
**Connection URI**: `mongodb://username:password@mongodb:27017/tenpennynovels?authSource=admin`
**Backup**: Daily at 2am UTC (cron)
