# TenPennyNovels Management Panel

Management panel moderno per TenPennyNovels, costruito con Next.js 16, TypeScript, TanStack Query e Zustand.

## Stack Tecnologico

- **Framework**: Next.js 16.1.6 (SSR standalone mode)
- **Language**: TypeScript 5.9.3 (strict mode)
- **State Management**:
  - Zustand 5.0.3 (client state)
  - TanStack Query 5.62.11 (server state)
- **Forms**: React Hook Form 7.71.2 + Zod 3.25.1
- **HTTP Client**: Axios 1.7.9
- **WebSocket**: Socket.IO Client 4.8.3
- **Styling**: SCSS 1.97.3 (CSS Modules)
- **Testing**: Jest 29 + React Testing Library 14

## Architettura

### State Management

- **Zustand stores** (max 3):
  - `authStore`: autenticazione, token, permissions
  - `uiStore`: UI preferences (sidebar, column visibility)
  - `notificationStore`: toast queue, notifiche

- **TanStack Query**:
  - Cache automatica (staleTime 5min)
  - Optimistic updates con rollback
  - Retry automatico (3x exponential backoff)

### Validazione

- **Zod schemas** per JSON config validation
- **React Hook Form + Zod** per form validation
- **ZERO `any` types** tollerati

### Pattern Chiave

- **Cell Renderer Registry**: Plugin architecture per table cell renderers (NO mega-switch)
- **JSON-driven Config**: Table e panel configuration esternalizzata
- **Optimistic Updates**: UI percepita come istantanea con rollback automatico

## Sviluppo

```bash
# Install dependencies
npm install

# Run development server (port 4004)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run type checking
npm run type-check

# Run linting
npm run lint
```

## URL

- **Development**: http://localhost:4004/gestione
- **Production**: https://tenpennynovels.com/gestione

## Autenticazione

**CRITICAL**: Il management panel NON ha una pagina di login. L'autenticazione è gestita da `apps/landing`.

- Login: `NEXT_PUBLIC_LANDING_URL/auth/login`
- Cookie HTTP-only per JWT
- Redirect automatico a landing se cookie mancante o 401

## Struttura Progetto

```
src/
├── pages/                # Next.js pages (max 200 linee ciascuno)
├── components/
│   ├── shared/          # Componenti riusabili
│   ├── layout/          # Layout components
│   └── dashboard/       # Dashboard-specific
├── lib/
│   ├── api/            # API client + endpoints
│   ├── config/         # JSON config loader + Zod schemas
│   ├── cellRenderers/  # Cell renderer registry
│   └── storage/        # localStorage migrations
├── store/              # Zustand stores
├── contexts/           # React contexts
├── hooks/              # Custom hooks
│   └── api/           # TanStack Query hooks
├── types/              # TypeScript types
│   └── api/           # API response types
├── styles/             # SCSS modules
└── constants/          # Constants
```

## Code Quality

### Standards

- **Max 300 linee** per file
- **ZERO `any` types**
- **100% Zod validation** per JSON config
- **Optimistic updates** su tutte le mutations
- **Test coverage ≥20%** su pagine critiche

### Metriche di Successo

- ✅ `npm run build` <60s
- ✅ `npm run type-check` 0 errors
- ✅ `npm run lint` 0 errors
- ✅ Bundle size <500KB
- ✅ Lighthouse Performance >80

## Deployment

### Next.js Config

```javascript
{
  output: 'standalone',       // SSR production-ready
  basePath: '/gestione',      // Sub-path hosting
  reactStrictMode: true
}
```

### Nginx Reverse Proxy

```nginx
location /gestione/ {
  proxy_pass http://localhost:4004/gestione/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.tsx

# Update snapshots
npm test -- -u
```

### Coverage Target

- Statements: 20%
- Branches: 20%
- Functions: 20%
- Lines: 20%

## Contributing

### Before Commit

1. `npm run type-check` - Zero errori TypeScript
2. `npm run lint` - Zero errori ESLint
3. `npm test` - Tutti i test passano
4. Verificare che max linee per file sia rispettato (300)
5. Verificare che nessun `any` type sia presente

### Red Flags da Evitare

1. ❌ **NO `any` types** → Usare `unknown` + type guards
2. ❌ **NO browser confirm()** → Sempre `ConfirmDialog` custom
3. ❌ **NO manual setState per server data** → Sempre TanStack Query
4. ❌ **NO localStorage per JWT** → HTTP-only cookie ONLY
5. ❌ **NO componenti >300 linee** → Splittare SEMPRE
6. ❌ **NO mutation senza optimistic update** → Sempre implementare
7. ❌ **NO config JSON senza validation** → Sempre Zod validate

## License

Private - TenPennyNovels © 2026
