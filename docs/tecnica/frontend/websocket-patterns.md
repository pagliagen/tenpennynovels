# WebSocket Patterns

**Navigation**: [Home](../INDEX.md) > [Frontend](./README.md) > WebSocket Patterns

**Status**: ⚠️ CRITICAL | **Last Updated**: 2026-03-01

Pattern architetturali per integrazione WebSocket in frontend React. **LEGGERE PRIMA DI USARE WEBSOCKET**.

---

## 🚨 CRITICAL RULE

**NEVER call `socket.on()` or `socket.emit()` directly in React components.**

**ALWAYS use WebSocketContext subscription methods.**

**Why**: Direct socket usage causes memory leaks, uncontrolled subscriptions, difficult cleanup, race conditions.

---

## Architecture Pattern

```
Frontend Component
    ↓ (subscription via useWebSocket hook)
WebSocketContext (React Context)
    ↓ (manages single Socket.IO instance)
Socket.IO Client
    ↓ (WebSocket connection)
API Gateway (Port 8000)
    ↓ (proxy WebSocket upgrade)
Unified Backend (Port 3001)
    ↓ (Socket.IO server)
Room-Based Broadcasting
    ↓
Component Receives Event (via callback)
```

**Key Principle**: **Single source of truth** for WebSocket connection in WebSocketContext.

---

## WebSocketContext API

### Connection Management

```typescript
import { useWebSocket } from '@/contexts/WebSocketContext';

function MyComponent() {
  const {
    status,      // ConnectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'
    isConnected, // boolean
    socket       // Socket.IO instance (use ONLY for direct emit if necessary)
  } = useWebSocket();

  return (
    <div>
      Status: {status}
      {isConnected && <span>✅ Connected</span>}
    </div>
  );
}
```

---

### Subscription Methods

#### subscribeToLocation

Subscribe to location-specific events (player join/leave, actions, turn progression).

```typescript
const { subscribeToLocation } = useWebSocket();

useEffect(() => {
  if (!locationId) return;

  const unsubscribe = subscribeToLocation(locationId, (event) => {
    switch (event.type) {
      case 'player_joined':
        console.log(`${event.data.characterName} joined`);
        setOccupants(prev => [...prev, event.data]);
        break;

      case 'player_left':
        console.log(`${event.data.characterName} left`);
        setOccupants(prev => prev.filter(o => o.characterId !== event.data.characterId));
        break;

      case 'action_created':
        console.log('New action:', event.data);
        setActions(prev => [...prev, event.data]);
        break;

      case 'turn_advanced':
        console.log('Turn advanced to:', event.data.currentCharacterId);
        setCurrentTurn(event.data);
        break;
    }
  });

  // Cleanup on unmount or locationId change
  return unsubscribe;
}, [locationId, subscribeToLocation]);
```

**Event Types**:
- `player_joined` - Character joined location
- `player_left` - Character left location
- `action_created` - New action posted in location
- `turn_advanced` - Turn progression (turn-based system)

---

#### subscribeToCharacter

Subscribe to character-specific events (XP granted, state changes).

```typescript
const { subscribeToCharacter } = useWebSocket();

useEffect(() => {
  if (!characterId) return;

  const unsubscribe = subscribeToCharacter(characterId, (event) => {
    switch (event.type) {
      case 'xp_granted':
        console.log(`XP granted: +${event.data.amount}`);
        setCharacter(prev => ({
          ...prev,
          experience: prev.experience + event.data.amount
        }));
        break;

      case 'state_changed':
        console.log('Character state updated:', event.data);
        setCharacter(prev => ({ ...prev, ...event.data }));
        break;
    }
  });

  return unsubscribe;
}, [characterId, subscribeToCharacter]);
```

---

#### subscribeToSession

Subscribe to gaming session events (started, ended).

```typescript
const { subscribeToSession } = useWebSocket();

useEffect(() => {
  if (!sessionId) return;

  const unsubscribe = subscribeToSession(sessionId, (event) => {
    switch (event.type) {
      case 'session_started':
        console.log('Session started:', event.data);
        setSessionStatus('active');
        break;

      case 'session_ended':
        console.log('Session ended:', event.data);
        setSessionStatus('completed');
        break;
    }
  });

  return unsubscribe;
}, [sessionId, subscribeToSession]);
```

---

#### subscribeToGlobal

Subscribe to global events (presence updates, broadcasts).

```typescript
const { subscribeToGlobal } = useWebSocket();

useEffect(() => {
  const unsubscribe = subscribeToGlobal((event) => {
    switch (event.type) {
      case 'presence_updated':
        console.log('User online/offline:', event.data);
        updatePresence(event.data);
        break;

      case 'system_broadcast':
        console.log('System message:', event.data.message);
        showNotification(event.data.message);
        break;
    }
  });

  return unsubscribe;
}, [subscribeToGlobal]);
```

---

## Common Patterns

### Pattern 1: Location Chat

```typescript
function LocationChat({ locationId }: { locationId: string }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const { subscribeToLocation } = useWebSocket();

  // Subscribe to location events
  useEffect(() => {
    const unsubscribe = subscribeToLocation(locationId, (event) => {
      if (event.type === 'action_created') {
        setActions(prev => [...prev, event.data]);
      } else if (event.type === 'player_joined') {
        setOccupants(prev => [...prev, event.data]);
      } else if (event.type === 'player_left') {
        setOccupants(prev =>
          prev.filter(o => o.characterId !== event.data.characterId)
        );
      }
    });

    return unsubscribe;
  }, [locationId, subscribeToLocation]);

  return (
    <div>
      <div>Occupants: {occupants.length}</div>
      <div>Actions: {actions.map(a => <div key={a.id}>{a.content}</div>)}</div>
    </div>
  );
}
```

---

### Pattern 2: Real-Time Character Updates

```typescript
function CharacterSheet({ characterId }: { characterId: string }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const { subscribeToCharacter } = useWebSocket();

  // Fetch initial data
  useEffect(() => {
    fetch(`/api/characters/${characterId}`)
      .then(res => res.json())
      .then(data => setCharacter(data.character));
  }, [characterId]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToCharacter(characterId, (event) => {
      if (event.type === 'xp_granted') {
        setCharacter(prev => prev ? {
          ...prev,
          experience: prev.experience + event.data.amount
        } : null);
      } else if (event.type === 'state_changed') {
        setCharacter(prev => prev ? { ...prev, ...event.data } : null);
      }
    });

    return unsubscribe;
  }, [characterId, subscribeToCharacter]);

  return character ? (
    <div>
      <h1>{character.name}</h1>
      <p>XP: {character.experience}</p>
    </div>
  ) : <div>Loading...</div>;
}
```

---

### Pattern 3: Notifications

```typescript
function NotificationListener() {
  const { subscribeToGlobal } = useWebSocket();
  const { showNotification } = useNotifications();

  useEffect(() => {
    const unsubscribe = subscribeToGlobal((event) => {
      if (event.type === 'system_broadcast') {
        showNotification({
          message: event.data.message,
          type: 'info'
        });
      }
    });

    return unsubscribe;
  }, [subscribeToGlobal, showNotification]);

  return null; // This component only listens
}
```

---

## ❌ Common Mistakes

### Mistake 1: Direct Socket Usage

```typescript
// ❌ WRONG - Direct socket.on() in component
import { io } from 'socket.io-client';

function BadComponent() {
  const [socket] = useState(() => io('ws://localhost:8000'));

  useEffect(() => {
    socket.on('player_joined', handlePlayerJoined); // Memory leak!

    // Cleanup often forgotten
    return () => socket.off('player_joined');
  }, []);

  // ...
}
```

**Problems**:
- Creates new socket instance per component
- Memory leak if cleanup forgotten
- No centralized connection management
- Reconnection logic duplicated

**Fix**: Use `useWebSocket()` hook instead.

---

### Mistake 2: Missing Cleanup

```typescript
// ❌ WRONG - No cleanup function
const { subscribeToLocation } = useWebSocket();

useEffect(() => {
  subscribeToLocation(locationId, (event) => {
    // Handle event
  });

  // MISSING: return unsubscribe;
}, [locationId]);
```

**Problem**: Subscription never removed, causes duplicate event handlers on re-render.

**Fix**: Always return `unsubscribe` function.

---

### Mistake 3: Stale Closures

```typescript
// ❌ WRONG - Stale closure over state
const [count, setCount] = useState(0);
const { subscribeToLocation } = useWebSocket();

useEffect(() => {
  const unsubscribe = subscribeToLocation(locationId, (event) => {
    // count is always 0 here (stale closure)
    console.log(`Count: ${count}`);
  });

  return unsubscribe;
}, [locationId]); // Missing count in dependencies!
```

**Problem**: `count` captured at initial render, never updates.

**Fix**: Use functional setState or include in dependencies.

```typescript
// ✅ CORRECT - Functional setState
useEffect(() => {
  const unsubscribe = subscribeToLocation(locationId, (event) => {
    setCount(prevCount => prevCount + 1); // Uses latest count
  });

  return unsubscribe;
}, [locationId, subscribeToLocation]);
```

---

### Mistake 4: Multiple Subscriptions to Same Event

```typescript
// ❌ WRONG - Subscribing multiple times
function Component() {
  const { subscribeToLocation } = useWebSocket();

  useEffect(() => {
    subscribeToLocation(locationId, handleEvent);
  }, [locationId]);

  useEffect(() => {
    subscribeToLocation(locationId, handleOtherEvent); // Duplicate subscription!
  }, [locationId]);
}
```

**Problem**: Same event handled twice, performance overhead.

**Fix**: Single subscription with switch/case on event.type.

```typescript
// ✅ CORRECT - Single subscription
useEffect(() => {
  const unsubscribe = subscribeToLocation(locationId, (event) => {
    switch (event.type) {
      case 'action_created':
        handleEvent(event);
        break;
      case 'player_joined':
        handleOtherEvent(event);
        break;
    }
  });

  return unsubscribe;
}, [locationId, subscribeToLocation]);
```

---

## Backend Room-Based Broadcasting

### How Rooms Work

Backend uses **Socket.IO rooms** for targeted broadcasting:

```typescript
// Backend: Join room on connection
socket.join(`user_${userId}`);
socket.join(`character_${characterId}`);
socket.join(`location_${locationId}`);
```

**Room Types**:
- `user_{userId}` - User-specific events (private messages, notifications)
- `character_{characterId}` - Character-specific events (XP, state changes)
- `location_{locationId}` - Location-scoped events (players, actions)
- `session_{sessionId}` - Session-scoped events (turn progression)
- `admin` - Admin-only broadcasts
- `staff` - Staff-only broadcasts

---

### Broadcasting Events

```typescript
// Backend: Broadcast to location
io.to(`location_${locationId}`).emit('player_joined', {
  characterId,
  characterName,
  timestamp: new Date()
});

// Backend: Broadcast to specific character
io.to(`character_${characterId}`).emit('xp_granted', {
  amount: 10,
  reason: 'Session completion'
});

// Backend: Broadcast to all
io.emit('system_broadcast', {
  message: 'Server maintenance in 10 minutes'
});
```

---

## Connection Lifecycle

### Connection States

1. **Connecting**: Initial WebSocket handshake
2. **Connected**: Socket.IO connected, authenticated
3. **Disconnected**: Connection lost (network issue, server restart)
4. **Reconnecting**: Auto-reconnect in progress (exponential backoff)
5. **Error**: Connection error (auth failed, server down)

---

### Auto-Reconnection

WebSocketContext handles reconnection automatically:

```typescript
// Auto-reconnect configuration
const socket = io(WEBSOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,        // Start with 1s
  reconnectionDelayMax: 5000,     // Max 5s
  timeout: 20000
});
```

**Exponential Backoff**: 1s → 2s → 4s → 5s → 5s

---

### Authentication

WebSocket authenticated via cookies:

```typescript
// Cookies automatically included
// - auth_token (user authentication)
// - character_context (character selection)

// Backend verifies on connection
socket.on('connection', async (socket) => {
  const authToken = socket.handshake.headers.cookie?.match(/auth_token=([^;]+)/)?.[1];
  const characterContext = socket.handshake.headers.cookie?.match(/character_context=([^;]+)/)?.[1];

  // Verify JWT
  const user = await verifyAuthToken(authToken);
  const character = await verifyCharacterContext(characterContext, user);

  socket.data.user = user;
  socket.data.character = character;

  // Join rooms
  socket.join(`user_${user.id}`);
  socket.join(`character_${character.id}`);
});
```

---

## Testing WebSocket Integration

### Manual Testing

```typescript
// In browser console
window.socket = io('ws://localhost:8000');

window.socket.on('connect', () => {
  console.log('Connected:', window.socket.id);
});

window.socket.on('player_joined', (data) => {
  console.log('Player joined:', data);
});

// Emit test event
window.socket.emit('join_location', { locationId: '123' });
```

---

### Unit Testing (React Testing Library)

```typescript
import { render, waitFor } from '@testing-library/react';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { io } from 'socket.io-client';

// Mock Socket.IO
jest.mock('socket.io-client');

test('subscribes to location events', async () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  };

  (io as jest.Mock).mockReturnValue(mockSocket);

  const { result } = renderHook(() => useWebSocket(), {
    wrapper: WebSocketProvider
  });

  const unsubscribe = result.current.subscribeToLocation('loc123', (event) => {
    expect(event.type).toBe('player_joined');
  });

  // Simulate event
  mockSocket.on.mock.calls[0][1]({ type: 'player_joined', data: {} });

  unsubscribe();
});
```

---

## Performance Considerations

### Debouncing Rapid Events

```typescript
import { useCallback } from 'react';
import { debounce } from 'lodash';

function Component() {
  const { subscribeToLocation } = useWebSocket();

  // Debounce rapid updates
  const handleAction = useCallback(
    debounce((action) => {
      setActions(prev => [...prev, action]);
    }, 300),
    []
  );

  useEffect(() => {
    const unsubscribe = subscribeToLocation(locationId, (event) => {
      if (event.type === 'action_created') {
        handleAction(event.data);
      }
    });

    return unsubscribe;
  }, [locationId, subscribeToLocation, handleAction]);
}
```

---

### Batching Updates

```typescript
function Component() {
  const [pendingActions, setPendingActions] = useState<Action[]>([]);
  const { subscribeToLocation } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribeToLocation(locationId, (event) => {
      if (event.type === 'action_created') {
        // Batch actions
        setPendingActions(prev => [...prev, event.data]);
      }
    });

    return unsubscribe;
  }, [locationId, subscribeToLocation]);

  // Flush batch every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingActions.length > 0) {
        setActions(prev => [...prev, ...pendingActions]);
        setPendingActions([]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingActions]);
}
```

---

## Related Documentation

- [Game App](./game-app.md) - WebSocket usage in game interface
- [Unified Backend](../02-backend/unified-backend-architecture.md) - WebSocket server
- [API Gateway](../02-backend/api-gateway.md) - WebSocket proxy
- [Location System](../03-game-systems/location-system.md) - Location events
