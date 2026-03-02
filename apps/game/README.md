# TenpennyNovels - Game Frontend (V2)

**Production-ready architecture** con TypeScript strict, TanStack Query, Zustand, e testing completo.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
game/
├── src/
│   ├── components/      # UI components (presentational + features)
│   ├── hooks/          # Custom hooks (data + features + ui)
│   ├── lib/            # Core libraries (API, schemas, queries)
│   ├── store/          # Zustand stores (client state)
│   ├── contexts/       # React contexts (ONLY 2: WebSocket, Theme)
│   ├── pages/          # Next.js pages
│   ├── styles/         # SCSS modules
│   ├── types/          # TypeScript types
│   └── constants/      # Constants
│
├── __tests__/          # Tests
│   ├── setup.ts        # Jest setup
│   └── e2e/            # E2E tests (Playwright)
│
└── public/             # Static assets
```

## 🛠️ Tech Stack

### Core
- **Next.js 16** - SSR standalone mode
- **React 18.3** - Stable (not 19 bleeding edge)
- **TypeScript 5.9** - Strict mode

### State Management
- **TanStack Query v5** - Server state (cache, fetch, mutations)
- **Zustand v5** - Client state (UI, transient)
- **React Context** - ONLY 2: WebSocket, Theme

### Data & API
- **Axios** - HTTP client with interceptors
- **Zod** - Schema validation + type inference
- **Socket.io-client** - WebSocket

### Testing
- **Jest** - Unit + integration tests
- **Testing Library** - React component testing
- **Playwright** - E2E tests

### Code Quality
- **ESLint** - Linting (strict rules)
- **Prettier** - Formatting
- **Husky** - Pre-commit hooks
- **lint-staged** - Staged files only

## 📋 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (port 4001) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with --fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run type-check` | Run TypeScript compiler |
| `npm test` | Run tests in watch mode |
| `npm run test:ci` | Run tests in CI mode |
| `npm run test:e2e` | Run E2E tests |
| `npm run analyze` | Analyze bundle size |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- CharacterSheet.test.tsx

# Run tests with coverage
npm run test:ci

# Run E2E tests
npm run test:e2e
```

## 📦 Bundle Analysis

```bash
# Analyze bundle size
npm run analyze
```

Opens visualization in browser showing bundle composition.

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Then configure your local environment.

### TypeScript

Strict mode enabled with:
- `noUncheckedIndexedAccess`
- `noUnusedLocals`
- `noUnusedParameters`
- No `any` types allowed

### ESLint

Strict rules:
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unsafe-*`: error
- Import ordering enforced

## 🏗️ Architecture Principles

1. **Separation of Concerns**
   - Presentation (components)
   - Business Logic (hooks)
   - Data (API + queries)

2. **State Management**
   - Server state → TanStack Query
   - Client state → Zustand
   - Context → ONLY infrastructure (WebSocket, Theme)

3. **Type Safety**
   - Zod schemas for ALL API responses
   - Type inference from schemas
   - NO `any` types

4. **Testing**
   - Critical paths: 80%+ coverage
   - Business logic: 70%+ coverage
   - Overall: 60%+ coverage

5. **Performance**
   - Code splitting (dynamic imports)
   - Lazy loading (React.lazy)
   - Virtualization (long lists)
   - Image optimization (Next.js Image)

## 📚 Documentation

- [Architecture V2](../.claude/plans/GAME_ARCHITECTURE_V2.md)
- [Features Requirements](../.claude/plans/GAME_FEATURES_REQUIREMENTS.md)
- [Critical Analysis](../.claude/plans/ANALISI_CRITICA_GAME.md)

## 🤝 Contributing

1. Create feature branch from `main`
2. Write tests for new features
3. Ensure all tests pass (`npm test`)
4. Ensure no linting errors (`npm run lint`)
5. Create pull request

## 📄 License

MIT
