---
name: Shared Frontend Rules
description: Common patterns across all TenpennyNovels frontend apps (Next.js Pages Router, React Query, Zustand, SCSS modules)
type: app-specific
---

# Shared Frontend Rules

Regole comuni per tutte le applicazioni frontend: landing (4000), game (4001), documents (4002), management (4003).

---

## Next.js Pages Router (NOT App Router)

**Regola**: Il progetto usa **Pages Router** (Next.js 16), NON App Router.

**Perche**: Tutto il codebase e basato su `pages/` directory, getServerSideProps, e API routes classiche.

### Struttura Directory

```
apps/[app-name]/
├── pages/              # Route pages (NOT app/)
│   ├── _app.tsx       # App wrapper
│   ├── _document.tsx  # HTML document
│   ├── index.tsx      # Home page
│   └── api/           # API routes (solo per landing)
├── src/
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── lib/           # Utilities
│   ├── store/         # Zustand stores (game/management)
│   ├── contexts/      # React contexts (game only)
│   ├── services/      # API services (landing only)
│   └── types/         # TypeScript types
└── public/            # Static assets
```

### Path Aliases

```typescript
// tsconfig.json - Available in ALL apps
{
  "@/*": ["./src/*"],           // Main source directory
  "@/components/*": ["./src/components/*"],
  "@/hooks/*": ["./src/hooks/*"],
  "@/lib/*": ["./src/lib/*"],
  "@/types/*": ["./src/types/*"],
  "@/styles/*": ["./src/styles/*"]
}
```

---

## React Query (TanStack Query)

**Regola**: Usa React Query per **server state** (dati dal backend). Mai per client state.

**Perche**: React Query gestisce caching, refetching, invalidation, ottimizzazioni. Zustand gestisce client state.

### Query Keys Pattern

```typescript
// ✅ CORRETTO: Hierarchical query keys
export const queryKeys = {
  locations: ['locations'] as const,
  locationsList: () => [...queryKeys.locations, 'list'] as const,
  locationDetail: (id: string) => [...queryKeys.locations, 'detail', id] as const,

  documents: ['documents'] as const,
  documentsList: (type?: string) => [...queryKeys.documents, 'list', type] as const,
  documentDetail: (id: string) => [...queryKeys.documents, 'detail', id] as const,
};

// Usage in useQuery
const { data } = useQuery({
  queryKey: queryKeys.locationDetail(locationId),
  queryFn: () => locationsApi.getById(locationId),
});
```

### Standard Configuration

```typescript
// File: lib/api/queryClient.ts (management, documents, game)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes (cache retention)
      retry: 1,                       // Retry once on failure
      refetchOnWindowFocus: false,    // Don't refetch on window focus
      refetchOnReconnect: true,       // Refetch on network reconnect
    },
    mutations: {
      retry: 0,  // Don't retry mutations
    },
  },
});
```

### Invalidation Pattern

```typescript
// ✅ CORRETTO: Invalidate queries on mutation success
const updateMutation = useMutation({
  mutationFn: (data) => api.updateLocation(locationId, data),
  onSuccess: () => {
    // Invalidate ALL locations queries
    queryClient.invalidateQueries({ queryKey: queryKeys.locations });

    // OR: Invalidate only specific query
    queryClient.invalidateQueries({ queryKey: queryKeys.locationDetail(locationId) });
  },
});
```

---

## Zustand Store Patterns

**Regola**: Usa Zustand per **client state** (UI state, auth, game state). React Query per server state.

**Perche**: Separazione responsabilita: Zustand = local/ephemeral, React Query = server/cached.

### Store Structure

```typescript
// File: store/[name]Store.ts
interface StoreState {
  // State properties
  count: number;
  user: User | null;
}

interface StoreActions {
  // Action methods
  increment: () => void;
  setUser: (user: User) => void;
  reset: () => void;
}

type Store = StoreState & StoreActions;

export const useStore = create<Store>()((set, get) => ({
  // Initial state
  count: 0,
  user: null,

  // Actions
  increment: () => set((state) => ({ count: state.count + 1 })),
  setUser: (user) => set({ user }),
  reset: () => set({ count: 0, user: null }),
}));
```

### Persist Middleware

```typescript
// With persistence (auth, preferences)
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Store implementation
    }),
    {
      name: 'auth-storage',  // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### Selector Functions

```typescript
// ✅ CORRETTO: Use selectors to prevent re-renders
const user = useAuthStore((state) => state.user);
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

// ❌ SBAGLIATO: Destructuring causes re-render on ANY state change
const { user, isAuthenticated } = useAuthStore();
```

**File di Riferimento**:
- `/apps/game/src/store/authStore.ts`
- `/apps/game/src/store/gameStateStore.ts`

---

## API Client Setup

### Game/Management/Documents (Axios)

```typescript
// File: lib/api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  withCredentials: true,  // CRITICAL: Send HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Inject X-Session-Id header
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const sessionId = sessionStorage.getItem('character_session_id');
    if (sessionId) {
      config.headers['X-Session-Id'] = sessionId;
    }
  }
  return config;
});

// Response interceptor: Handle 401/403
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Landing (Fetch API)

```typescript
// Landing app uses native Fetch API, NOT Axios
export async function apiRequest<T>(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',  // CRITICAL: Send cookies
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.json());
  }

  return response.json() as Promise<ApiResponse<T>>;
}
```

**File di Riferimento**:
- `/apps/game/src/lib/api/client.ts` (Axios)
- `/apps/landing/src/lib/api/client.ts` (Fetch)

---

## SCSS Modules

**Regola**: Tutti gli stili devono essere SCSS modules (`.module.scss`). NO CSS globale tranne `globals.scss`.

### Naming Convention

```scss
// File: components/Button/Button.module.scss

.button {
  padding: 0.5rem 1rem;
  background: var(--color-primary);

  &:hover {
    background: var(--color-primary-dark);
  }
}

.buttonLarge {
  @extend .button;
  padding: 1rem 2rem;
  font-size: 1.25rem;
}

.buttonDisabled {
  opacity: 0.5;
  pointer-events: none;
}
```

### Usage in Components

```typescript
import styles from './Button.module.scss';

function Button({ size, disabled }) {
  return (
    <button
      className={`${styles.button} ${size === 'large' ? styles.buttonLarge : ''} ${disabled ? styles.buttonDisabled : ''}`}
    >
      Click me
    </button>
  );
}
```

### CSS Variables

```scss
// File: styles/globals.scss (root variables)
:root {
  --color-primary: #1a73e8;
  --color-primary-dark: #1557b0;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --font-family-base: 'Inter', sans-serif;
}
```

---

## Cookie Handling

**Regola**: Autenticazione via HTTP-only cookies. Frontend NON legge/scrive auth token.

### Backend Sets Cookie

```http
Set-Cookie: auth_token=jwt_token_here; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

### Frontend Configuration

```typescript
// CRITICAL: withCredentials/credentials must be true
const apiClient = axios.create({
  withCredentials: true,  // Axios
});

fetch(url, {
  credentials: 'include',  // Fetch API
});
```

### Session ID (Multi-Tab Support)

```typescript
// After character selection, backend returns sessionId (opaque UUID)
const sessionId = response.data.sessionId;

// Save in sessionStorage (NOT localStorage - different per tab)
sessionStorage.setItem('character_session_id', sessionId);

// Send in X-Session-Id header for all requests
config.headers['X-Session-Id'] = sessionId;
```

---

## ESLint 9 Flat Config

**Regola**: Il progetto usa ESLint 9 con flat config (eslint.config.mjs), NON `.eslintrc.json`.

### Configurazione

```javascript
// File: eslint.config.mjs
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
```

---

## Error Boundaries

**Regola**: Ogni app deve avere error boundary per evitare crash completo.

```typescript
// File: components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // Optional: Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Something went wrong</h1>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## TypeScript Strict Mode

**Regola**: Tutti gli apps usano TypeScript strict mode.

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

---

## Cross-References

- **Game App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/game-app.md`
- **Management App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/management-app.md`
- **Documents App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/documents-app.md`
- **Landing App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/landing-app.md`
