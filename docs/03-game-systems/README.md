# Game Systems

**Navigation**: [Home](../INDEX.md) > Game Systems

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Documentazione dei sistemi di gioco: personaggi, locations, housing, experience, corporations, messaging.

---

## Overview

TenpennyNovels implementa un sistema di gioco completo basato su Call of Cthulhu 7th Edition adattato per ambientazione Victorian (Londra 1880s). I sistemi core includono creazione personaggi, esplorazione locations, gestione housing, advancement via XP, e gameplay turn-based.

---

## Core Systems

### Character System

Sistema di creazione e gestione personaggi basato su Call of Cthulhu d100.

**Features**:
- **Character Creation Wizard**: Multi-step (basic info, stats, skills, occupation, background)
- **Stats System**: 8 characteristics (STR, CON, DEX, INT, POW, APP, EDU, SIZ) con 400 punti totali
- **Skills**: 50+ skills con skill cap 75 (finale: 80 post-approval)
- **Occupations**: 55 occupazioni Victorian con bonus skills
- **Approval Workflow**: Admin review before character activation
- **Bot Characters**: Special NPC characters con bot_id field

**File**: [Character System](./character-system.md)

---

### Location System

Sistema gerarchico di locations con real-time occupants tracking.

**Features**:
- **Hierarchical Structure**: root → district → location
- **Settings**: `{ visible, chat, shop, private }`
- **Occupants Tracking**: Real-time via WebSocket
- **Access Control**: Public/private locations con character-specific access
- **Join/Leave API**: Optimistic updates via GameContext

**Key Endpoints**:
- `GET /game/locations/accessible` - Lista locations accessibili
- `POST /game/locations/join` - Entra in location
- `POST /game/locations/leave` - Esci da location

**File**: [Location System](./location-system.md)

---

### Housing System

Sistema di proprietà immobiliari con rental e purchase.

**Features**:
- **Property Types**: Rent (monthly) o Purchase (one-time)
- **Districts**: Vari quartieri di Londra con prezzi differenziati
- **Automated Rent Collection**: Cron job giornaliero (6am)
- **Eviction**: 14+ giorni overdue → automatic eviction
- **Guest Management**: Permetti accesso temporaneo ad altri characters
- **Admin Analytics**: Dashboard proprietà, transazioni, revenue

**Key Endpoints**:
- `GET /game/housing/available/:district` - Properties disponibili
- `POST /game/housing/rent` - Affitta proprietà
- `POST /game/housing/purchase` - Acquista proprietà
- `POST /game/housing/:id/pay-rent` - Paga affitto

**Status**: 100% working (12/13 tests passing)

**File**: [Housing System](./housing-system.md)

---

### Corporation Management

Sistema di organizzazioni (companies, clubs, secret societies).

**Features**:
- **Corporation Types**: Business, social club, secret society, guild
- **Membership System**: Roles (owner, manager, member)
- **Treasury**: Shared finances
- **Property Ownership**: Corporations can own housing properties
- **Membership Requests**: Approval workflow

**Key Endpoints**:
- `GET /game/corporations` - Lista corporations
- `POST /game/corporations` - Crea corporation
- `POST /game/corporations/:id/join-request` - Richiesta membership
- `GET /game/corporations/:id/members` - Lista membri

**File**: [Corporation Management](./corporation-management.md)

---

### Experience Points System

Sistema XP per skill advancement.

**Features**:
- **Daily Base XP**: 2 punti al giorno per tutti i characters attivi
- **Session XP**: Master grants XP al termine sessioni
- **Skill Advancement**: 1 skill point al giorno (daily base skill)
- **Automated Grants**: Cron job giornaliero (2am)
- **XP Spending**: Players allocano XP su skills
- **Skill Caps**: Max skill value 99 (realistic progression)

**Key Endpoints**:
- `GET /game/experience/grants` - Lista XP ricevuti
- `POST /game/experience/spend` - Spendi XP su skill
- `GET /game/experience/history` - Storico XP

**File**: [Experience Points](./experience-points.md)

---

### Session Management

Sistema turn-based per sessioni di gioco organizzate.

**Features**:
- **Session Templates**: Investigation, social, combat, exploration
- **Turn System**: Master-controlled turn progression
- **Turn Order**: Priority-based character ordering
- **Attendance Tracking**: Which characters participate
- **XP Grant**: Automatic XP at session end
- **Session Notes**: Master narrative notes

**Key Endpoints**:
- `POST /game/sessions` - Crea sessione
- `POST /game/sessions/:id/start` - Inizia sessione
- `POST /game/sessions/:id/advance-turn` - Avanza turno
- `POST /game/sessions/:id/end` - Termina sessione

**File**: [Session Management](./session-management.md)

---

### Messaging System

Dual messaging system: OffGame (OOC) e OnGame (IC postal).

**Features**:

#### OffGame Chat (OOC)
- **Private Chats**: 1-on-1 o group chats
- **Real-time**: Via WebSocket
- **Read Receipts**: Track read messages
- **Notifications**: Unread message counters

#### OnGame Messages (IC Postal)
- **Victorian Postal System**: In-character mail delivery
- **Scheduled Delivery**: Messaggi arrivano con ritardo realistico
- **Delivery Tracking**: Read/unread status
- **Sender/Receiver**: Character-to-character only

**Key Endpoints**:
- `GET /game/chats` - Lista chats OffGame
- `POST /game/chats` - Crea chat OffGame
- `POST /game/messages/send` - Invia messaggio OnGame
- `GET /game/messages/inbox` - Inbox messaggi OnGame

**File**: [Messaging System](./messaging-system.md)

---

### Chat Monitoring

Sistema di moderazione chat con reporting e actions.

**Features**:
- **Message Reports**: Players reportano contenuti inappropriati
- **Moderation Actions**: Warning, mute, ban
- **Audit Trail**: Log tutte le azioni moderazione
- **Auto-flagging**: Keyword-based automatic flagging
- **Moderator Dashboard**: Review reported content

**Key Endpoints**:
- `POST /game/chat/report` - Reporta messaggio
- `GET /admin/chat/reports` - Lista reports (admin)
- `POST /admin/chat/moderate` - Azione moderazione

**File**: [Chat Monitoring](./chat-monitoring.md)

---

## Integration Between Systems

### Character ↔ Location
- Characters join locations via `joinLocation()`
- Location occupants updated real-time
- WebSocket events: `player_joined`, `player_left`

### Character ↔ Housing
- Characters own/rent properties
- Housing affects character wealth (rent payments)
- Properties can be character-owned or corporation-owned

### Character ↔ Corporation
- Characters are members of corporations
- Corporation roles affect permissions
- Corporation treasury shared among members

### Housing ↔ Corporation
- Corporations can own properties
- Corporation members have access to corporation properties

### Location ↔ Session
- Sessions happen in specific locations
- Turn-based actions posted in location chat
- Master controls turn order

### Experience ↔ Session
- XP granted at session end
- Session attendance tracked for XP eligibility

---

## Game Flow

### Typical Player Journey

```
1. Register User (Landing App)
2. Create Character (Character Wizard)
3. Wait for Admin Approval
4. Character Approved → Select Character
5. Join Location → Explore World
6. Participate in Sessions → Earn XP
7. Advance Skills → Character Growth
8. Join Corporation → Social Integration
9. Rent/Purchase Property → Establish Presence
10. Interact with NPCs/Bots → Narrative Development
```

---

## Database Models

### Core Models

**Character**:
```typescript
{
  userId: ObjectId,
  name: string,
  surname: string,
  occupation: string,
  stats: { STR, CON, DEX, INT, POW, APP, EDU, SIZ },
  skills: Map<string, number>,
  currentLocation: ObjectId | null,
  isApproved: boolean,
  bot_id: string | null
}
```

**Location**:
```typescript
{
  name: string,
  slug: string,
  description: string,
  locationLevel: 'root' | 'district' | 'location',
  parentLocation: ObjectId | null,
  settings: { visible, chat, shop, private },
  occupants: Array<{ characterId, characterName }>,
  positions: string[]
}
```

**HousingProperty**:
```typescript
{
  name: string,
  district: string,
  propertyType: 'rent' | 'purchase',
  monthlyRent: number | null,
  purchasePrice: number | null,
  currentTenantId: ObjectId | null,
  ownerId: ObjectId | null,
  ownerType: 'character' | 'corporation',
  rentPaidUntil: Date | null,
  isAvailable: boolean
}
```

**Details**: [MongoDB Schemas](../01-infrastructure/mongodb-schemas.md)

---

## Testing

### Test Scripts

```bash
# Test character endpoints
./scripts/test-character-endpoints.sh

# Test location endpoints
./scripts/test-location-endpoints.sh

# Test housing system (12/13 passing)
./scripts/test-housing-endpoints.sh

# Test experience system
./scripts/test-experience-endpoints.sh
```

**Details**: [API Testing Scripts](../07-testing/api-testing-scripts.md)

---

## Files in This Section

- [README.md](./README.md) - This file
- [Character System](./character-system.md) - Character creation and management
- [Location System](./location-system.md) - Hierarchical locations
- [Housing System](./housing-system.md) - Property rental and ownership
- [Corporation Management](./corporation-management.md) - Organizations
- [Experience Points](./experience-points.md) - XP and skill advancement
- [Session Management](./session-management.md) - Turn-based gameplay
- [Messaging System](./messaging-system.md) - OffGame and OnGame communication
- [Chat Monitoring](./chat-monitoring.md) - Moderation system

---

## Related Documentation

- [Backend API](../02-backend/unified-backend-architecture.md) - API endpoints
- [Database Schemas](../01-infrastructure/mongodb-schemas.md) - MongoDB models
- [WebSocket Patterns](../05-frontend/websocket-patterns.md) - Real-time events
- [Call of Cthulhu Rules](../08-reference/call-of-cthulhu-rules.md) - Game rules
- [Testing](../07-testing/api-testing-scripts.md) - Test scripts
