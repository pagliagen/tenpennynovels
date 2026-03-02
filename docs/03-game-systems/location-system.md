# Location System

**Navigation**: [Home](../INDEX.md) > [Game Systems](./README.md) > Location System

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Sistema gerarchico di locations con real-time occupants tracking e access control.

---

## Overview

Il Location System di TenpennyNovels gestisce ambientazioni di gioco in cui i personaggi si muovono, esplorano e interagiscono. Implementa una struttura gerarchica a 3 livelli con controllo accessi e tracking real-time degli occupanti.

---

## Architecture

### Hierarchical Structure

```
Root Location (London)
    ↓
District (Whitechapel, Westminster, etc.)
    ↓
Location (The Crown Pub, Baker Street 221B, etc.)
```

**Levels**:
1. **Root**: City-level (es. London) - Non direttamente accessibile
2. **District**: Area/borough (es. Whitechapel, Westminster) - Può essere accessibile
3. **Location**: Specific place (es. The Crown Pub, 221B Baker Street) - Primary gameplay locations

---

### Database Schema

```typescript
interface Location {
  _id: ObjectId;
  slug: string;  // SEO-friendly URL (e.g., "the-crown-pub")
  name: string;
  description: string;

  // Hierarchy
  locationLevel: 'root' | 'district' | 'location';
  parentLocation: ObjectId | null;  // Link to parent
  sortOrder: number;  // Display order

  // Settings
  settings: {
    visible: boolean;  // Appears in location list
    chat: boolean;     // Enable location chat
    shop: boolean;     // Enable shop interface
    private: boolean;  // Requires access control
  };

  // Access Control (if private: true)
  access?: {
    ownerType: 'character' | 'corporation';
    ownerId: ObjectId;

    characterAccess: Array<{
      characterId: ObjectId;
      permissions: string[];  // ['view', 'enter', 'edit']
      duration: 'permanent' | 'temporary';
      expiresAt?: Date;
    }>;

    corporationAccess: Array<{
      corporationId: ObjectId;
      permissions: string[];
    }>;
  };

  // Physical positions for spatial chat system
  positions?: string[];  // ['tavern', 'street', 'indoor', 'outdoor']

  // Real-time occupants
  occupants: Array<{
    characterId: ObjectId;
    characterName: string;
    joinedAt: Date;
  }>;

  // Visual
  imageUrl?: string;

  // Game integration
  bot_enabled: boolean;  // Allow bot NPCs to respond

  createdAt: Date;
  updatedAt: Date;
}
```

**Example**:
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "slug": "the-crown-pub",
  "name": "The Crown Pub",
  "description": "A dimly lit Victorian tavern...",
  "locationLevel": "location",
  "parentLocation": "507f1f77bcf86cd799439012",
  "sortOrder": 1,
  "settings": {
    "visible": true,
    "chat": true,
    "shop": false,
    "private": false
  },
  "positions": ["tavern", "indoor"],
  "occupants": [
    {
      "characterId": "507f...",
      "characterName": "Lord Blackwood",
      "joinedAt": "2026-03-01T14:30:00Z"
    }
  ],
  "bot_enabled": true
}
```

---

## AccessibleLocation Response

### API Response Structure

```typescript
interface AccessibleLocation {
  _id: string;           // MongoDB ObjectId as string
  slug: string;          // SEO URL
  name: string;
  description: string;
  district?: string;
  parentLocation?: string;
  imageUrl?: string;

  // CRITICAL: Frontend expects this object
  settings: {
    visible: boolean;
    chat: boolean;
    shop: boolean;
    private: boolean;
  };

  locationLevel: 'root' | 'district' | 'location';
  sortOrder: number;

  // Physical positions
  positions?: string[];

  // Backward compatibility (computed from settings)
  hasShop: boolean;      // = settings.shop
  hasChat: boolean;      // = settings.chat
  isPrivate: boolean;    // = settings.private

  // Real-time data
  occupants: Array<{
    characterId: string;
    characterName: string;
  }>;

  // Optional: Child locations (for hierarchical display)
  children?: AccessibleLocation[];
}
```

**Critical Fix (Feb 25, 2026)**:
- ✅ Now returns `_id` (not `id`) - MongoDB standard
- ✅ Now includes `slug` field - SEO URLs functional
- ✅ Now includes `settings` object - Frontend no longer crashes on `location.settings.chat`
- ✅ Now includes `occupants: []` default - Avoid undefined errors

---

## API Endpoints

### GET /game/locations/accessible

**Purpose**: Get all locations accessible to character.

**Authentication**: Required (character_context JWT)

**Response**:
```json
{
  "success": true,
  "locations": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "slug": "the-crown-pub",
      "name": "The Crown Pub",
      "settings": {
        "visible": true,
        "chat": true,
        "shop": false,
        "private": false
      },
      "occupants": [
        {
          "characterId": "507f...",
          "characterName": "Lord Blackwood"
        }
      ],
      "hasShop": false,
      "hasChat": true,
      "isPrivate": false
    }
  ]
}
```

**Access Control Logic**:
1. **Public Locations**: `settings.private: false` AND `settings.visible: true` → Always accessible
2. **Private Locations**: Check character-specific access, corporation membership
3. **Temporary Access**: Check `expiresAt` timestamp
4. **Root Locations**: Excluded from response (not directly accessible)

---

### POST /game/locations/join

**Purpose**: Join a location (set as current location, add to occupants).

**Authentication**: Required (character_context JWT)

**Request**:
```json
{
  "locationId": "507f1f77bcf86cd799439011"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully joined The Crown Pub"
}
```

**Side Effects**:
1. `Character.currentLocation = locationId`
2. `Location.occupants += { characterId, characterName }`
3. WebSocket broadcast: `player_joined` event to all occupants
4. Cleanup: If character was in previous location, remove from old occupants

---

### POST /game/locations/leave

**Purpose**: Leave current location (cleanup occupants).

**Authentication**: Required (character_context JWT)

**Request**: None (uses character from JWT)

**Response**:
```json
{
  "success": true,
  "message": "Successfully left location"
}
```

**Side Effects**:
1. `Character.currentLocation = null`
2. `Location.occupants -= character`
3. WebSocket broadcast: `player_left` event to all remaining occupants

---

### GET /game/locations/:id

**Purpose**: Get specific location details.

**Authentication**: Required (character_context JWT)

**Response**:
```json
{
  "success": true,
  "location": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "The Crown Pub",
    "description": "A dimly lit Victorian tavern...",
    "settings": {...},
    "occupants": [...],
    "positions": ["tavern", "indoor"]
  }
}
```

---

### POST /game/locations/:id/action

**Purpose**: Post action in location (chat message, emote, etc.).

**Authentication**: Required (character_context JWT)

**Request**:
```json
{
  "content": "Lord Blackwood enters the tavern",
  "actionType": "action",  // 'action' | 'speak' | 'emote'
  "tags": ["tavern"]       // Physical position
}
```

**Response**:
```json
{
  "success": true,
  "action": {
    "id": "507f...",
    "characterId": "507f...",
    "characterName": "Lord Blackwood",
    "content": "Lord Blackwood enters the tavern",
    "actionType": "action",
    "tags": ["tavern"],
    "timestamp": "2026-03-01T14:30:00Z"
  }
}
```

**Side Effects**:
1. Save `LocationAction` to database
2. WebSocket broadcast: `action_created` event to all occupants
3. If `bot_enabled: true`, trigger BotAI webhook (async)

---

## Frontend Integration

### GameContext Pattern

**File**: `apps/game/src/contexts/GameContext.tsx`

```typescript
const { joinLocation, leaveLocation, currentLocation } = useGame();

// Join location (optimistic update)
const handleJoinLocation = async (locationId: string) => {
  try {
    await joinLocation(locationId);
    // On success: currentLocation updated, occupants tracked via WebSocket
  } catch (error) {
    // On error: Rollback optimistic update, show error
    showError('Failed to join location');
  }
};

// Leave location
const handleLeaveLocation = async () => {
  try {
    await leaveLocation();
    // On success: currentLocation = null, removed from occupants
  } catch (error) {
    showError('Failed to leave location');
  }
};
```

**Optimistic Updates**:
```typescript
// Before API call
setCurrentLocation(newLocation);
setOccupants(prev => [...prev, currentCharacter]);

// If API fails, rollback
try {
  await api.joinLocation(locationId);
} catch (error) {
  setCurrentLocation(previousLocation);  // Rollback
  setOccupants(prev => prev.filter(o => o.id !== currentCharacter.id));
}
```

---

### WebSocket Real-Time Updates

```typescript
import { useWebSocket } from '@/contexts/WebSocketContext';

function LocationView({ locationId }: { locationId: string }) {
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const { subscribeToLocation } = useWebSocket();

  // Subscribe to location events
  useEffect(() => {
    const unsubscribe = subscribeToLocation(locationId, (event) => {
      switch (event.type) {
        case 'player_joined':
          setOccupants(prev => [...prev, {
            characterId: event.data.characterId,
            characterName: event.data.characterName
          }]);
          break;

        case 'player_left':
          setOccupants(prev =>
            prev.filter(o => o.characterId !== event.data.characterId)
          );
          break;

        case 'action_created':
          // Handle new action
          break;
      }
    });

    return unsubscribe;  // Cleanup
  }, [locationId, subscribeToLocation]);

  return (
    <div>
      <h2>Occupants ({occupants.length})</h2>
      {occupants.map(o => <div key={o.characterId}>{o.characterName}</div>)}
    </div>
  );
}
```

**Details**: [WebSocket Patterns](../../05-frontend/websocket-patterns.md)

---

## Access Control System

### Public vs Private Locations

**Public Location**:
```typescript
{
  "settings": {
    "private": false,
    "visible": true
  }
  // No access field needed
}
```
→ All characters can access

**Private Location**:
```typescript
{
  "settings": {
    "private": true,
    "visible": true  // Still appears in list (but locked)
  },
  "access": {
    "ownerType": "character",
    "ownerId": "507f...",  // Owner has full access
    "characterAccess": [
      {
        "characterId": "507f...",
        "permissions": ["view", "enter"],
        "duration": "permanent"
      },
      {
        "characterId": "507f...",
        "permissions": ["view"],
        "duration": "temporary",
        "expiresAt": "2026-03-15T00:00:00Z"
      }
    ]
  }
}
```

→ Only owner + granted characters can access

---

### Access Check Logic

**Backend** (`LocationService.checkLocationAccess()`):

```typescript
async function checkLocationAccess(location: Location, character: Character): Promise<boolean> {
  // Missing settings = legacy location (allow access)
  if (!location.settings) return true;

  // Public locations
  if (!location.settings.private && location.settings.visible) return true;

  // Private locations
  if (location.settings.private) {
    // Owner check
    if (location.access?.ownerType === 'character' &&
        location.access?.ownerId?.toString() === character.id) {
      return true;
    }

    // Character-specific access
    const access = location.access?.characterAccess?.find(
      a => a.characterId.toString() === character.id
    );

    if (access) {
      // Check expiration
      if (access.duration === 'temporary' &&
          access.expiresAt &&
          new Date() > access.expiresAt) {
        return false;  // Expired
      }

      return access.permissions.includes('view');
    }

    // TODO: Corporation membership check
    // if (location.access?.corporationAccess && character.corporations) {
    //   const corpAccess = location.access.corporationAccess.find(ca =>
    //     character.corporations.some(corp => corp.id.toString() === ca.corporationId.toString())
    //   );
    //   if (corpAccess) return true;
    // }
  }

  return false;  // Deny access by default
}
```

---

## Spatial Chat System (Multi-Tag)

### Physical Positions

Locations can have multiple **positions** (tags) for spatial awareness:

**Example**:
```typescript
{
  "name": "The Crown Pub",
  "positions": ["tavern", "indoor", "ground-floor"]
}
```

**Action Tagging**:
```typescript
// Player posts action in specific position
POST /game/locations/:id/action
{
  "content": "Lord Blackwood sits at the bar",
  "tags": ["tavern", "indoor"]
}
```

**BotAI Integration**:
- Bots assigned to specific tags (e.g., bartender → ["tavern"])
- Bot responds only to actions with matching tags
- Multi-tag awareness: Bot sees all actions on assigned tags

---

## Common Patterns

### Pattern 1: Location Browser

```typescript
function LocationBrowser() {
  const [locations, setLocations] = useState<AccessibleLocation[]>([]);

  useEffect(() => {
    fetch('/api/game/locations/accessible')
      .then(res => res.json())
      .then(data => setLocations(data.locations));
  }, []);

  return (
    <div>
      {locations.map(location => (
        <LocationCard
          key={location._id}
          location={location}
          onClick={() => handleJoinLocation(location._id)}
        />
      ))}
    </div>
  );
}
```

---

### Pattern 2: Location Chat

```typescript
function LocationChat({ locationId }: { locationId: string }) {
  const [actions, setActions] = useState<Action[]>([]);
  const { subscribeToLocation } = useWebSocket();

  // Fetch initial actions
  useEffect(() => {
    fetch(`/api/game/locations/${locationId}/actions`)
      .then(res => res.json())
      .then(data => setActions(data.actions));
  }, [locationId]);

  // Subscribe to new actions (real-time)
  useEffect(() => {
    const unsubscribe = subscribeToLocation(locationId, (event) => {
      if (event.type === 'action_created') {
        setActions(prev => [...prev, event.data]);
      }
    });

    return unsubscribe;
  }, [locationId, subscribeToLocation]);

  return (
    <div>
      {actions.map(action => (
        <ChatMessage key={action.id} action={action} />
      ))}
    </div>
  );
}
```

---

## Bug Fixes History

### Feb 25, 2026 - Critical Backend Response Fix

**Problem**: `LocationService.getAccessibleLocations()` returned incomplete structure:
- Used `id` instead of `_id` (inconsistent with MongoDB standard)
- Missing `slug` field (SEO URLs broken)
- Missing `settings` object → **frontend crashed** on `location.settings.chat`
- Had redundant `accessible: true` field

**Solution**: Modified `LocationService.ts` (lines 101-126):
```typescript
// Fixed response
{
  _id: location._id.toString(),  // ✅ MongoDB standard
  slug: location.slug,            // ✅ SEO URLs
  settings: {                     // ✅ CRITICAL - frontend expects this
    visible: location.settings?.visible ?? true,
    chat: location.settings?.chat ?? true,
    shop: location.settings?.shop ?? false,
    private: location.settings?.private ?? false
  },
  hasShop: location.settings?.shop || false,
  hasChat: location.settings?.chat || false,
  isPrivate: location.settings?.private || false,
  occupants: []  // ✅ Avoid undefined errors
}
```

**Impact**: Locations/map system now fully functional. Runtime crash fixed.

---

## Related Documentation

- [WebSocket Patterns](../../05-frontend/websocket-patterns.md) - Real-time location events
- [Housing System](./housing-system.md) - Property ownership (uses location access control)
- [Session Management](./session-management.md) - Turn-based gameplay in locations
- [BotAI Backend](../../02-backend/botai-backend.md) - Bot NPCs in locations
- [MongoDB Schemas](../../01-infrastructure/mongodb-schemas.md) - Location model details
