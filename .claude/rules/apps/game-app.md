---
name: Game App Rules
description: Critical patterns for game app (WebSocket, Zustand, optimistic updates, real-time)
type: app-specific
---

# Game App Rules (Port 4001)

L'app piu complessa del progetto. Gestisce real-time gameplay, WebSocket, multi-tab sessions, Zustand stores.

**CRITICAL**: Questa e la app con piu pattern delicati. Leggi attentamente prima di modificare.

---

## WebSocket Single Reception Point (CRITICAL)

**Regola**: NEVER call `socket.on()` directly in components. ALWAYS use `WebSocketContext.onLocationEvent()`.

**Perche**: Prevents memory leaks, duplicate subscriptions, stale closures. Single source of truth for WebSocket events.

### Incidente Reale (2026-03-01)

**Problema**: Components chiamavano `socket.on()` direttamente → memory leak + duplicate handlers.

**Soluzione**: WebSocketContext come single reception point. Components subscribe via callbacks.

### ❌ SBAGLIATO: Direct socket.on() in component

```typescript
function LocationChat() {
  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    // ❌ BAD: Direct subscription, no cleanup, stale closure risk
    socket.on('location_message_notification', (data) => {
      console.log('New message:', data);
      setMessages((prev) => [...prev, data.message]);
    });
  }, [socket]);  // ❌ Missing cleanup, dependency issues
}
```

### ✅ CORRETTO: Subscribe via WebSocketContext

```typescript
function LocationChat() {
  const { onLocationEvent } = useWebSocket();

  useEffect(() => {
    // ✅ GOOD: Context handles subscription + cleanup
    const unsubscribe = onLocationEvent((event) => {
      if (event.type === 'location_message_notification') {
        console.log('New message:', event.data);
        setMessages((prev) => [...prev, event.data.message]);
      }
    });

    // ✅ GOOD: Automatic cleanup on unmount
    return unsubscribe;
  }, [onLocationEvent]);

  return <div>...</div>;
}
```

### Event Types Available

```typescript
// Location events (chat, actions, presence in current location)
onLocationEvent((event) => {
  switch (event.type) {
    case 'location_message_notification':  // New chat message
    case 'location_action_deleted':        // Action deleted by admin
    case 'player_entered':                 // Player joined location
    case 'player_left':                    // Player left location
    case 'user_typing':                    // Typing indicator
    case 'location_joined':                // Successfully joined location
  }
});

// Global events (presence across all locations, status changes)
onGlobalEvent((event) => {
  switch (event.type) {
    case 'global_presence_update':         // Character online/offline
    case 'user_status_change':             // Character status changed
    case 'character_active':               // Character became active
    case 'character_inactive':             // Character became inactive
    case 'character_ban_updated':          // Character ban status changed
  }
});

// Message events (offgame chat, postal system, tickets)
onMessageEvent((event) => {
  switch (event.type) {
    case 'offgame_message_received':       // New offgame message
    case 'offgame_typing_indicator':       // Typing in offgame chat
    case 'offgame_message_read':           // Message read receipt
    case 'offgame_chat_updated':           // Chat metadata updated
    case 'ongame:message_delivered':       // Postal message delivered
    case 'ongame:message_sent':            // Postal message sent
    case 'ongame:message_read':            // Postal message read
    case 'character_status_changed':       // Character approved/rejected
    case 'ticket:staff_replied':           // Staff replied to ticket
    case 'ticket:status_changed':          // Ticket status changed
    case 'ticket:closed':                  // Ticket closed
  }
});
```

**File di Riferimento**:
- `/apps/game/src/contexts/WebSocketContext.tsx` (lines 4-20, 319-594)

---

## Optimistic Updates Pattern (CRITICAL)

**Regola**: NO `invalidateQueries` in `onSuccess`. Use `onMutate` for optimistic update, `onError` for rollback.

**Perche**: `invalidateQueries` in `onSuccess` causes race condition → flicker (optimistic update overwritten by stale cache).

### Incidente Reale (2026-03-01)

**Problema**: Toggle visibility/draft showed correct state briefly then reverted (flicker).

**Root Cause**: `onSettled` invalidation triggered immediate refetch that overwrote optimistic update.

**Soluzione**: Removed `onSettled` invalidation. Trust optimistic update. Only rollback on error.

### ❌ SBAGLIATO: Invalidate in onSuccess causes race condition

```typescript
const toggleMutation = useMutation({
  mutationFn: (documentId) => api.toggleVisibility(documentId),
  onMutate: async (documentId) => {
    // Cancel ongoing queries
    await queryClient.cancelQueries({ queryKey: ['documents'] });

    // Snapshot current state
    const previousData = queryClient.getQueryData<Route[]>(['documents']);

    // Optimistic update
    queryClient.setQueryData<Route[]>(['documents'], (old) => {
      return updateDocumentInTree(old, documentId, { visible: !doc.visible });
    });

    return { previousData };
  },
  onSuccess: () => {
    // ❌ BAD: This triggers refetch that overwrites optimistic update
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  },
  onError: (err, variables, context) => {
    // Rollback on error
    if (context?.previousData) {
      queryClient.setQueryData(['documents'], context.previousData);
    }
  },
});
```

### ✅ CORRETTO: Trust optimistic update, no invalidation

```typescript
const toggleMutation = useMutation({
  mutationFn: (documentId) => api.toggleVisibility(documentId),
  onMutate: async (documentId) => {
    // Cancel ongoing queries to prevent race
    await queryClient.cancelQueries({ queryKey: ['documents'] });

    // Snapshot current state for rollback
    const previousData = queryClient.getQueryData<Route[]>(['documents']);

    // Optimistic update (immediate UI feedback)
    queryClient.setQueryData<Route[]>(['documents'], (old) => {
      return updateDocumentInTree(old, documentId, { visible: !doc.visible });
    });

    // Return context for rollback
    return { previousData };
  },
  // ✅ GOOD: NO onSuccess invalidation - trust optimistic update
  onError: (err, variables, context) => {
    // ✅ GOOD: Rollback ONLY on error
    if (context?.previousData) {
      queryClient.setQueryData(['documents'], context.previousData);
    }

    toast.error('Errore durante il toggle');
  },
});
```

### Helper Function for Tree Updates

```typescript
/**
 * Update document node in nested Route[] → DocumentTreeNode[] hierarchy
 *
 * CRITICAL: Must traverse full tree to find document by ID.
 * Documents can be at any depth in the tree.
 */
function updateDocumentNodeInRoutes(
  routes: Route[],
  documentId: string,
  updates: Partial<DocumentTreeNode>
): Route[] {
  return routes.map((route) => ({
    ...route,
    children: updateDocumentNode(route.children, documentId, updates),
  }));
}

function updateDocumentNode(
  nodes: DocumentTreeNode[],
  documentId: string,
  updates: Partial<DocumentTreeNode>
): DocumentTreeNode[] {
  return nodes.map((node) => {
    if (node._id === documentId) {
      return { ...node, ...updates };
    }

    if (node.children) {
      return {
        ...node,
        children: updateDocumentNode(node.children, documentId, updates),
      };
    }

    return node;
  });
}
```

**File di Riferimento**:
- `/apps/game/src/store/gameStateStore.ts` (lines 90-109)
- MEMORY.md (2026-03-01)

---

## Zustand Stores Architecture

**Regola**: Separation of concerns tra stores. Ogni store ha responsabilita specifica.

### Store Hierarchy

```typescript
// 1. authStore - Identity & permissions (PERSISTED)
interface AuthStore {
  user: User | null;
  selectedCharacter: Character | null;
  isAuthenticated: boolean;
  gamePermissions: string[];  // NOT persisted - fetch fresh
  setUser: (user: User) => void;
  setSelectedCharacter: (character: Character) => void;
  hasGamePermission: (permission: string) => boolean;
  logout: () => void;
}

// 2. gameStateStore - Runtime gameplay state (NOT PERSISTED)
interface GameStateStore {
  currentLocationId: string | null;
  currentLocationName: string | null;
  enterLocation: (id: string, name: string) => Promise<void>;
  leaveLocation: () => Promise<void>;
  _setLocation: (id: string | null, name: string | null) => void;
  reset: () => void;
}

// 3. chatStore - Ephemeral chat messages (3h retention)
interface ChatStore {
  messages: Message[];
  addMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  clearOldMessages: () => void;
}

// 4. uiStore - UI state (toasts, modals)
interface UIStore {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
}

// 5. presenceStore - Real-time character presence
interface PresenceStore {
  onlineCharacters: Set<string>;
  setOnline: (characterId: string) => void;
  setOffline: (characterId: string) => void;
}
```

### Single Point of Write (gameStateStore)

```typescript
// ✅ CORRETTO: gameStateStore.enterLocation handles ALL side effects
export const useGameStateStore = create<GameStateStore>((set, get) => ({
  currentLocationId: null,
  currentLocationName: null,

  enterLocation: async (locationId: string, locationName: string) => {
    try {
      // 1. Optimistic update (local state)
      set({ currentLocationId: locationId, currentLocationName: locationName });

      // 2. Persist to backend (HTTP)
      await locationsApi.enter(locationId);

      // 3. Join WebSocket room
      wsClient.joinLocation(locationId);

    } catch (error) {
      // Rollback on error
      set({ currentLocationId: null, currentLocationName: null });
      throw error;
    }
  },

  leaveLocation: async () => {
    const { currentLocationId } = get();
    if (!currentLocationId) return;

    // 1. Emit WebSocket leave
    wsClient.leaveLocation(currentLocationId);

    // 2. Clear local state
    set({ currentLocationId: null, currentLocationName: null });
  },
}));
```

### ❌ SBAGLIATO: Multiple components updating same state

```typescript
// ❌ BAD: Component A directly sets location
function ComponentA() {
  const { _setLocation } = useGameStateStore();

  const handleEnter = () => {
    _setLocation(locationId, locationName);  // ❌ No backend sync
  };
}

// ❌ BAD: Component B also sets location differently
function ComponentB() {
  const { _setLocation } = useGameStateStore();

  const handleJoin = async () => {
    await api.enterLocation(locationId);
    _setLocation(locationId, locationName);  // ❌ No WebSocket sync
  };
}
```

### ✅ CORRETTO: Single entry point

```typescript
// ✅ GOOD: Both components use enterLocation (single point of write)
function ComponentA() {
  const { enterLocation } = useGameStateStore();

  const handleEnter = async () => {
    await enterLocation(locationId, locationName);
  };
}

function ComponentB() {
  const { enterLocation } = useGameStateStore();

  const handleJoin = async () => {
    await enterLocation(locationId, locationName);
  };
}
```

**File di Riferimento**:
- `/apps/game/src/store/authStore.ts`
- `/apps/game/src/store/gameStateStore.ts`

---

## Session Management (Multi-Tab Support)

**Regola**: Use `sessionStorage.character_session_id` + `X-Session-Id` header for multi-tab character selection.

**Perche**: `localStorage` is shared across tabs. `sessionStorage` is per-tab. Each tab can have different character.

### Flow

```typescript
// 1. Character selection (landing app)
const response = await api.post('/auth/characters/select', { characterId });
const sessionId = response.data.sessionId;  // Opaque UUID from backend

// 2. Save in sessionStorage (per-tab)
sessionStorage.setItem('character_session_id', sessionId);

// 3. Redirect to game app with sessionId in query param (cross-origin)
window.location.href = `http://localhost:4001?sessionId=${sessionId}`;

// 4. Game app reads sessionId from query param and saves to sessionStorage
useEffect(() => {
  const { sessionId } = router.query;
  if (sessionId) {
    sessionStorage.setItem('character_session_id', sessionId);
    router.replace(router.pathname, undefined, { shallow: true });
  }
}, [router.query.sessionId]);

// 5. API client injects X-Session-Id header
apiClient.interceptors.request.use((config) => {
  const sessionId = sessionStorage.getItem('character_session_id');
  if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
  }
  return config;
});

// 6. Backend validates ownership (session.userId === auth_token.userId)
// Backend returns 401 if session doesn't belong to authenticated user
```

### Why sessionStorage, not localStorage?

```typescript
// ❌ PROBLEM: localStorage is shared across tabs
// Tab 1: Select Character A → localStorage['character'] = 'A'
// Tab 2: Select Character B → localStorage['character'] = 'B'
// Tab 1: Now sees Character B (wrong!)

// ✅ SOLUTION: sessionStorage is per-tab
// Tab 1: Select Character A → sessionStorage['character_session_id'] = 'uuid-A'
// Tab 2: Select Character B → sessionStorage['character_session_id'] = 'uuid-B'
// Each tab maintains independent session
```

**File di Riferimento**:
- `/apps/game/src/lib/api/client.ts` (lines 133-139)
- `/apps/management/src/pages/_app.tsx` (lines 50-80)

---

## Real-Time Chat Patterns

**Regola**: Location chat uses WebSocket for real-time updates. NO polling.

### Message Visibility Permissions

```typescript
// Backend sends event ONLY to authorized characters
// Frontend MUST NOT re-check permissions - trust backend filtering

onLocationEvent((event) => {
  if (event.type === 'location_message_notification') {
    const message = event.data.message;

    // ✅ GOOD: If we received it, we have permission to see it
    // Backend already filtered who receives this WebSocket event
    addMessage(message);

    // ❌ BAD: Don't re-check permissions in frontend
    // if (message.visibility === 'master_only' && !isMaster) return;
  }
});
```

### Typing Indicators

```typescript
// Emit typing event (throttled to 2s)
const handleTyping = useCallback(
  throttle(() => {
    if (currentLocationId) {
      wsClient.emitTyping(currentLocationId);
    }
  }, 2000),
  [currentLocationId]
);

// Listen for typing events
useEffect(() => {
  const unsubscribe = onLocationEvent((event) => {
    if (event.type === 'user_typing') {
      setTypingUsers((prev) => ({
        ...prev,
        [event.data.characterId]: {
          name: event.data.characterName,
          timestamp: Date.now(),
        },
      }));
    }
  });

  return unsubscribe;
}, [onLocationEvent]);

// Clear stale typing indicators (3s timeout)
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();
    setTypingUsers((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        if (now - updated[id].timestamp > 3000) {
          delete updated[id];
        }
      });
      return updated;
    });
  }, 1000);

  return () => clearInterval(interval);
}, []);
```

---

## Presence Tracking

**Regola**: Use `presenceStore` for real-time character online/offline status.

```typescript
// Subscribe to global presence events
useEffect(() => {
  const unsubscribe = onGlobalEvent((event) => {
    if (event.type === 'character_active') {
      presenceStore.getState().setOnline(event.data.characterId);
    } else if (event.type === 'character_inactive') {
      presenceStore.getState().setOffline(event.data.characterId);
    }
  });

  return unsubscribe;
}, [onGlobalEvent]);

// Check if character is online
const isOnline = presenceStore((state) => state.onlineCharacters.has(characterId));
```

---

## Cross-References

- **Shared Frontend**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/shared-frontend.md`
- **Management App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/management-app.md`
- **WebSocket Backend**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/backend/websocket.md`
