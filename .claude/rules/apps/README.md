---
name: Frontend Apps Overview
description: Overview of 4 Next.js applications and navigation guide
type: overview
---

# Frontend Apps Overview

TenpennyNovels ha 4 applicazioni frontend separate basate su Next.js.

---

## Applications

| App | Port | Purpose | Users | Key Features |
|-----|------|---------|-------|--------------|
| **landing** | 4000 | Auth & character selection | All users | Login, registration, character picker |
| **game** | 4001 | Main gameplay interface | Authenticated players | Chat, locations, real-time, WebSocket |
| **documents** | 4002 | Knowledge base / rules | Public + authenticated | Documentation, semantic search, SSR |
| **management** | 4003 | Admin panel | Admins only | User/character/content management |

---

## Shared Technology Stack

All apps share:

- **Next.js 16** (Pages Router, NOT App Router)
- **React 18.3.1**
- **TypeScript 5.9.3** (strict mode)
- **SCSS Modules** for styling
- **Zod** for runtime validation
- **date-fns** for date formatting

### App-Specific Stacks:

**game** (most complex):
- React Query (TanStack Query) for server state
- Zustand for client state
- Socket.IO client for real-time
- Victorian theme + responsive design

**management**:
- React Query + Zustand
- TipTap for rich text editing
- react-hook-form + Zod for forms
- dnd-kit for drag & drop

**documents**:
- React Query
- SSR for SEO
- Semantic search integration
- Read-only content

**landing** (simplest):
- Fetch API (NO React Query/Zustand)
- react-hook-form + Zod
- Victorian theme

---

## Architecture Diagram

```
                    ┌─────────────┐
                    │   Nginx     │
                    │   (443)     │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ landing │      │  game   │      │documents│      │management│
    │  :4000  │      │  :4001  │      │  :4002  │      │  :4003  │
    └────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
         │                │                 │                │
         └────────────────┼─────────────────┴────────────────┘
                          │
                    ┌─────▼──────┐
                    │ API Gateway│
                    │   :8000    │
                    └─────┬──────┘
                          │
                ┌─────────┴──────────┐
                │                    │
          ┌─────▼───────┐    ┌──────▼──────┐
          │  Unified    │    │ WebSocket   │
          │  Backend    │    │  (Socket.IO)│
          │   :3001     │    │             │
          └─────────────┘    └─────────────┘
```

---

## Navigation Flow

### User Journey:

1. **Landing** (unauthenticated)
   - Login / Register
   - Character selection
   - Redirect to game with `?sessionId=xxx`

2. **Game** (authenticated)
   - Main gameplay
   - Can open documents in new tab
   - Can open management (if admin)

3. **Documents** (public or authenticated)
   - Standalone knowledge base
   - Can be accessed without game session

4. **Management** (admin only)
   - Admin operations
   - Separate from gameplay

---

## Rules Organization

### Read ALWAYS:

- **[shared-frontend.md](./shared-frontend.md)** - Common patterns for ALL apps
  - Next.js Pages Router
  - React Query patterns
  - Zustand stores
  - API client setup
  - SCSS modules

### Read when working on specific app:

- **[game-app.md](./game-app.md)** - Game app (MOST COMPLEX)
  - WebSocket via WebSocketContext (CRITICAL)
  - Optimistic updates (NO invalidate in onSuccess)
  - State management with Zustand
  - Real-time presence and chat

- **[management-app.md](./management-app.md)** - Admin panel
  - Admin authentication
  - TipTap rich text editor
  - CRUD patterns with audit
  - Forms with react-hook-form

- **[documents-app.md](./documents-app.md)** - Knowledge base
  - SSR patterns
  - Semantic search integration
  - Build bypass header

- **[landing-app.md](./landing-app.md)** - Authentication
  - Fetch API (different from other apps)
  - Victorian theme
  - Character selection flow

---

## Common Patterns (All Apps)

### Path Aliases:

```typescript
import { Component } from '@/components/Component';
import { useHook } from '@/hooks/useHook';
import { apiClient } from '@/lib/api/client';
import type { Type } from '@/types/api/type';
```

### Environment Variables:

```bash
# .env.local (gitignored)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

**Note**: `NEXT_PUBLIC_` prefix required for client-side access.

### API Client Pattern:

```typescript
// lib/api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,  // Send cookies
  timeout: 10000
});

// Interceptors for error handling, auth, etc.
apiClient.interceptors.response.use(/* ... */);
```

### TypeScript Configuration:

All apps use strict mode + additional safety flags:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## Port Reference

### Development:

| Service | Port | URL |
|---------|------|-----|
| Landing | 4000 | http://localhost:4000 |
| Game | 4001 | http://localhost:4001 |
| Documents | 4002 | http://localhost:4002 |
| Management | 4003 | http://localhost:4003 |
| API Gateway | 8000 | http://localhost:8000 |
| Unified Backend | 3001 | http://localhost:3001 |

### Production:

| Service | URL |
|---------|-----|
| Landing | https://landing.tenpennynovels.com |
| Game | https://tenpennynovels.com |
| Documents | https://docs.tenpennynovels.com |
| Management | https://admin.tenpennynovels.com |

---

## Development Commands

### Start All Apps:

```bash
# From root
npm run dev:all

# Or individually
cd apps/landing && npm run dev
cd apps/game && npm run dev
cd apps/documents && npm run dev
cd apps/management && npm run dev
```

### Build:

```bash
# All apps
npm run build:frontend:all

# Individual
cd apps/game && npm run build
```

### Type Check:

```bash
# All apps
npm run type-check:all

# Individual
cd apps/game && npm run type-check
```

---

## Cross-References

- **Next.js patterns**: [shared-frontend.md](./shared-frontend.md)
- **Game WebSocket**: [game-app.md](./game-app.md)
- **Admin patterns**: [management-app.md](./management-app.md)
- **SSR patterns**: [documents-app.md](./documents-app.md)
- **Auth flow**: [landing-app.md](./landing-app.md)
- **Global rules**: [../00-project-wide.md](../00-project-wide.md)
