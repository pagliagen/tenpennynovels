# Frontend Applications

**Navigation**: [Home](../INDEX.md) > Frontend

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Documentazione delle 4 applicazioni frontend Next.js di TenpennyNovels.

---

## Overview

TenpennyNovels utilizza 4 applicazioni frontend separate costruite con Next.js 16, ciascuna con uno scope specifico e ottimizzata per il proprio use case.

---

## Applications

### 1. Landing App (Port 4000)

**Purpose**: Login, registration, character selection, onboarding.

**Technology**:
- Next.js 18.3.1
- React 19.2.4
- React Hook Form 7.54.2
- SCSS Modules

**Key Features**:
- User registration con email verification
- Login (remember-me optional)
- Forgot password / reset password flow
- Character selection (liste characters dell'utente)
- Character wizard redirect (per creazione)
- Victorian-themed landing page

**Routes**:
- `/` - Landing page
- `/register` - User registration
- `/login` - Login form (future: removed, directly on `/`)
- `/forgot-password` - Password reset request
- `/reset-password/:token` - Password reset
- `/character-select` - Character selection
- `/verify-email/:token` - Email verification
- `/delete-account/:token` - Account deletion
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/credits` - Credits page

**State Management**: Local component state + React Hook Form

**File**: [Landing App](./landing-app.md)

---

### 2. Game App (Port 4001)

**Purpose**: Main gameplay interface - locations, chat, sessions.

**Technology**:
- Next.js 16.1.6
- React 18.3.1
- Socket.IO Client 4.8.3
- Zustand 5.0.3
- TanStack Query 5.62.11
- SCSS Modules

**Key Features**:
- **Location Exploration**: Join/leave locations, view occupants
- **Location Chat**: Real-time chat con turn-based system
- **Character Sheets**: View/edit character details
- **Sessions**: Participate in gaming sessions
- **OffGame Chat**: Private messages with other players
- **OnGame Mail**: Victorian postal system (IC)
- **Admin Panel Access**: Link to management app (if admin)

**State Management**:
- Zustand store (game state, locations, characters)
- WebSocketContext (real-time events)
- TanStack Query (server state caching)

**WebSocket Integration**: [WebSocket Patterns](./websocket-patterns.md) (**CRITICAL**)

**Routes**:
- `/` - Game home (location list)
- `/locations/:slug` - Location detail with chat
- `/characters` - Character list
- `/characters/:id` - Character sheet
- `/sessions` - Gaming sessions list
- `/messages` - OnGame postal inbox
- `/offgame` - OffGame chat
- `/shop/:locationSlug` - Shop interface (if location hasShop)

**File**: [Game App](./game-app.md)

---

### 3. Documents App (Port 4003)

**Purpose**: Knowledge base, regolamento, ambientazione.

**Technology**:
- Next.js 16.1.6
- React 18.3.1
- Zustand 5.0.3
- TanStack Query 5.62.11
- Marked 16.0.0 (Markdown rendering)
- DOMPurify 3.2.6 (XSS protection)
- SCSS Modules

**Key Features**:
- **Document Browsing**: Hierarchical navigation (categories, documents)
- **Semantic Search**: Vector-based + full-text search
- **Favorites**: Save documents for quick access
- **Dark Mode**: Toggle dark/light theme
- **Responsive**: Mobile-optimized

**Routes**:
- `/` - Document home
- `/ambientazione` - Setting documents
- `/ambientazione/:slug` - Setting document detail
- `/regolamento` - Rules documents
- `/regolamento/:slug` - Rule document detail
- `/search` - Search results
- `/favoriti` - Saved favorites

**State Management**:
- Zustand store (favorites, theme)
- TanStack Query (document caching)

**File**: [Documents App](./documents-app.md)

---

### 4. Management App (Port 4004)

**Purpose**: Admin panel per gestione gioco.

**Technology**:
- Next.js 16.1.6
- React 18.3.1
- Zustand 5.0.3
- TanStack Query 5.62.11
- SCSS Modules

**Key Features**:
- **Character Approval**: Review pending characters
- **User Management**: Ban/unban, permissions
- **Corporation Management**: Oversee organizations
- **Housing Analytics**: Property management, revenue
- **Document Management**: CRUD documents
- **System Configuration**: Game settings
- **Audit Logs**: Track admin actions
- **Broadcast Messages**: System announcements

**Routes**:
- `/` - Admin dashboard
- `/characters/approval` - Pending approvals
- `/characters/character-list` - All characters
- `/users/user-list` - User management
- `/users/permissions` - User permissions
- `/corporations` - Corporation list
- `/corporations/:id` - Corporation detail
- `/housing` - Housing management
- `/documents` - Document CRUD
- `/system/configurations` - System config
- `/system/audit-logs` - Audit trail
- `/tickets/my-tickets` - Support tickets

**State Management**:
- Zustand store (auth, UI state)
- TanStack Query (admin data caching)

**Authentication**: Requires `canAccessAdminPanel: true` + specific userRoles

**File**: [Management App](./management-app.md)

---

## Shared UI System

### Shared UI Library

**Path**: `apps/shared-ui/`

**Purpose**: Centralized Victorian-themed design system condiviso tra tutte le app.

**Components**:
- Typography: Victorian fonts (Barrio, IMFeENsc28P, Thrifted Attire)
- Colors: Victorian palette (sepia, dark brown, gold accents)
- Buttons: Styled buttons with Victorian aesthetic
- Forms: Input fields, selects, checkboxes
- Modals: Modal dialogs
- Cards: Content containers

**SCSS Modules**:
- `_variables.scss` - Color palette, fonts, spacing
- `_mixins.scss` - Reusable style mixins
- `_layout.scss` - Layout utilities
- `components/` - Component styles

**Usage**:
```scss
// In any app
@import 'shared-ui/styles/variables';
@import 'shared-ui/styles/mixins';

.myComponent {
  @include victorian-button;
  color: $primary-color;
}
```

**File**: [Shared UI System](./shared-ui-system.md)

---

## WebSocket Integration

### CRITICAL PATTERN

**Rule**: NEVER call `socket.on()` or `socket.emit()` directly in components.

**Why**: Memory leaks, uncontrolled subscriptions, difficult cleanup.

**Pattern**: Use WebSocketContext subscription methods.

**Example**:

```typescript
// ❌ WRONG - Direct socket usage
import { io } from 'socket.io-client';

function MyComponent() {
  const socket = io('ws://localhost:8000');

  useEffect(() => {
    socket.on('player_joined', handlePlayerJoined); // Memory leak
    return () => socket.off('player_joined'); // Cleanup often forgotten
  }, []);
}

// ✅ CORRECT - WebSocketContext subscription
import { useWebSocket } from '@/contexts/WebSocketContext';

function MyComponent() {
  const { subscribeToLocation } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribeToLocation(locationId, (event) => {
      if (event.type === 'player_joined') {
        handlePlayerJoined(event.data);
      }
    });

    return unsubscribe; // Automatic cleanup
  }, [locationId]);
}
```

**Details**: [WebSocket Patterns](./websocket-patterns.md) (**READ THIS FIRST**)

---

## State Management Strategies

### Game App

**Zustand Store** (game state):
```typescript
interface GameState {
  currentLocation: Location | null;
  characters: Character[];
  sessions: Session[];
  setLocation: (location: Location) => void;
  // ...
}
```

**WebSocketContext** (real-time):
- Connection management
- Event subscriptions
- Automatic reconnection

**TanStack Query** (server state):
- API call caching
- Automatic refetch
- Optimistic updates

### Management App

**Zustand Store** (auth + UI):
```typescript
interface ManagementState {
  user: User | null;
  sidebarOpen: boolean;
  // ...
}
```

**TanStack Query** (admin data):
- Character approvals
- User list
- Analytics data

### Documents App

**Zustand Store** (favorites + theme):
```typescript
interface DocumentsState {
  favorites: string[]; // document IDs
  theme: 'light' | 'dark';
  toggleFavorite: (docId: string) => void;
  // ...
}
```

**TanStack Query** (document data):
- Document content
- Search results
- Route tree

---

## Routing & Navigation

### Next.js File-Based Routing

All apps use Next.js file-based routing:

```
pages/
├── index.tsx           → /
├── login.tsx           → /login
├── locations/
│   └── [slug].tsx      → /locations/:slug
└── api/                → API routes (rare, most API in backend)
```

### Cross-App Navigation

Apps link to each other via environment variables:

```typescript
// Landing → Game (after character select)
window.location.href = process.env.NEXT_PUBLIC_GAME_URL;

// Game → Management (admin link)
window.location.href = process.env.NEXT_PUBLIC_MANAGEMENT_URL;
```

**Note**: Full page reload necessario per cross-app navigation (different Next.js instances).

---

## Environment Variables

### Common Variables

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# WebSocket (Game App only)
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8000

# Cross-app URLs
NEXT_PUBLIC_LANDING_URL=http://localhost:4000
NEXT_PUBLIC_GAME_URL=http://localhost:4001
NEXT_PUBLIC_DOCUMENTS_URL=http://localhost:4003
NEXT_PUBLIC_MANAGEMENT_URL=http://localhost:4004
```

**Details**: [Environment Variables](../01-infrastructure/environment-variables.md)

---

## Building & Deployment

### Development

```bash
# Start individual app
cd apps/game
npm run dev

# Or from root (runs all)
npm run frontend:all
```

### Production Build

```bash
# Build app
cd apps/game
npm run build

# Start production server
npm run start
```

### Docker (Production)

```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
CMD ["npm", "start"]
```

---

## Files in This Section

- [README.md](./README.md) - This file
- [WebSocket Patterns](./websocket-patterns.md) - **CRITICAL** real-time patterns
- [Game App](./game-app.md) - Main gameplay interface
- [Landing App](./landing-app.md) - Login and character selection
- [Documents App](./documents-app.md) - Knowledge base
- [Management App](./management-app.md) - Admin panel
- [Shared UI System](./shared-ui-system.md) - Design system

---

## Related Documentation

- [Backend API](../02-backend/api-reference.md) - API endpoints
- [Game Systems](../03-game-systems/README.md) - Gameplay mechanics
- [Infrastructure](../01-infrastructure/README.md) - Backend services
- [Getting Started](../00-getting-started/README.md) - Setup guide
