---
name: Node Environment & Dependencies
description: Node.js version management and dependency patterns
type: standard
---

# 02 - Node Environment & Dependencies

Standard per gestione Node.js version e dipendenze npm.

---

## Node Version Management

### Source of Truth: .nvmrc

**File**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.nvmrc`
**Current Version**: `v24.18.0`

```bash
# Always use nvm to switch to project version
cd /Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels
nvm use  # Reads .nvmrc automatically

# Verify
node --version  # Must output: v24.18.0
npm --version   # Should be npm bundled with Node 24.18.0
```

### Why v24.18.0?

- ESM support (import/export) nativo
- Performance improvements
- Fetch API built-in
- Test runner built-in
- Compatibility with latest npm packages

---

## npm vs npm ci

### Local Development:

```bash
# Initial setup
npm install

# Adding new package
npm install package-name
npm install --save-dev @types/package-name

# Updating packages
npm update

# Removing package
npm uninstall package-name
```

### CI/CD:

```bash
# ✅ ALWAYS use npm ci in CI/CD
npm ci

# Why?
# - Installs exact versions from package-lock.json
# - Faster than npm install
# - Fails if package.json and package-lock.json are out of sync
# - Removes node_modules before install (clean slate)
```

### ❌ WRONG in CI:
```bash
npm install  # ❌ Can install newer versions, inconsistent builds
```

---

## Production vs Dev Dependencies

### Rule:

**dependencies**: Required at runtime in production
**devDependencies**: Only needed during development or build

### ❌ WRONG:
```json
{
  "dependencies": {
    "express": "^5.2.1",
    "typescript": "^5.9.3",    // ❌ Not needed at runtime
    "@types/node": "^22.0.0",   // ❌ Only type definitions
    "eslint": "^9.0.0",         // ❌ Only for linting
    "jest": "^29.0.0"           // ❌ Only for testing
  }
}
```

### ✅ CORRECT:
```json
{
  "dependencies": {
    "express": "^5.2.1",        // ✅ Runtime dependency
    "mongoose": "^9.0.0",       // ✅ Runtime dependency
    "socket.io": "^4.8.3"       // ✅ Runtime dependency
  },
  "devDependencies": {
    "typescript": "^5.9.3",     // ✅ Compile-time only
    "@types/node": "^22.0.0",   // ✅ Type definitions
    "@types/express": "^5.0.0", // ✅ Type definitions
    "eslint": "^9.0.0",         // ✅ Development tool
    "jest": "^29.0.0",          // ✅ Testing tool
    "tsx": "^4.0.0"             // ✅ Dev server (hot reload)
  }
}
```

### Special Case: Build Tools

**IF build tool is used DURING deployment**, it MUST be in dependencies:

```json
{
  "dependencies": {
    "esbuild": "^0.20.2"  // ✅ YES if npm run build uses it in production
  },
  "scripts": {
    "build": "esbuild src/index.ts --outdir=dist",
    "start": "node dist/index.js"
  }
}
```

**See**: [00-project-wide.md](./00-project-wide.md#7-build-tools-in-production-dependencies)

---

## Package.json Scripts Standards

### Standard Scripts (All Projects):

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",              // Hot reload development
    "build": "tsc",                                // Compile TypeScript
    "start": "node dist/index.js",                // Production start
    "lint": "eslint src/**/*.ts",                 // Lint code
    "lint:fix": "eslint src/**/*.ts --fix",       // Auto-fix lint issues
    "format": "prettier --write \"src/**/*.ts\"", // Format code
    "type-check": "tsc --noEmit"                  // Check types without building
  }
}
```

### Frontend-Specific (Next.js):

```json
{
  "scripts": {
    "dev": "next dev -p 4001",        // Development server on custom port
    "build": "next build",            // Production build
    "start": "next start -p 4001",    // Production server
    "lint": "next lint",              // Next.js linting
    "type-check": "tsc --noEmit"
  }
}
```

### Backend-Specific:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:prod": "NODE_ENV=production node dist/index.js",
    "migrate": "node scripts/migrate.js",
    "seed": "tsx scripts/seed.ts"
  }
}
```

---

## Environment Variables

### Pattern: `.env` files

```
.env                 # Development defaults (committed)
.env.local           # Local overrides (gitignored)
.env.production      # Production values (gitignored)
.env.test            # Test environment (committed)
```

### Loading Pattern:

```typescript
// Backend (services/*/src/index.ts)
// IMPORTANT: Load dotenv BEFORE any imports
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

// Now imports can use process.env
import { appConfig } from '@config/runtime/appConfig';

// Frontend (Next.js)
// Automatic loading, use NEXT_PUBLIC_ prefix for client-side
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Environment Validation:

```typescript
// config/runtime/envValidation.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32)
});

export const env = envSchema.parse(process.env);

// Usage
import { env } from '@config/runtime/envValidation';
console.log(env.PORT);  // Type-safe number
```

---

## Struttura Monorepo (NO npm Workspaces)

**Il progetto NON usa npm workspaces.** Il root `package.json` ha `"workspaces": []`: ogni app/service ha il proprio `node_modules` installato separatamente (via `cd <path> && npm install`), non un `node_modules` condiviso a livello root.

### Root package.json (reale):

```json
{
  "name": "tenpennynovels-monorepo",
  "private": true,
  "workspaces": [],
  "engines": {
    "node": ">=24.18.0"
  },
  "scripts": {
    "frontend:all": "concurrently -n \"landing,game,docs,mgmt\" ... ",
    "backend:all": "concurrently -n \"gateway,unified,embed\" ...",
    "all": "concurrently \"npm run backend:all\" \"npm run frontend:all\"",
    "build:frontend:all": "npm run build:frontend:landing && npm run build:frontend:game && ...",
    "build:backend:all": "npm run build:backend:gateway && npm run build:backend:unified && ...",
    "build:all": "npm run build:backend:all && npm run build:frontend:all",
    "typecheck:backends": "npm run typecheck:gateway && npm run typecheck:unified && npm run typecheck:embeddings"
  }
}
```

Ogni script `*:all` è una catena di `cd <app|service> && npm run <script>` orchestrata da `concurrently` (dev) o in sequenza (build), NON la feature nativa `npm run --workspaces`.

### Installare una dipendenza in un'app/service:

```bash
# Ogni progetto ha il proprio package.json + node_modules: installare dentro la directory specifica
cd services/unified-backend && npm install express

# NON esiste --workspace= o --workspaces in questo repo (nessun workspace npm configurato)
```

### CI/deploy — installazione dipendenze:

Lo script di deploy (`.github/workflows/deploy.yml` + `deploy/scripts/install-all.sh`) itera manualmente su `apps/*/` e `services/*/` eseguendo `npm install` in ciascuna directory (hash-based, vedi [04-ci-cd.md](./04-ci-cd.md#smart-dependency-installation)).

---

## Dependency Updates

### Check Outdated:

```bash
# Nessun workspace npm: controllare ogni app/service singolarmente
cd services/unified-backend && npm outdated

# Oppure iterare su tutte le directory
for d in apps/*/ services/*/ local-ai/services/*/; do (cd "$d" && npm outdated); done
```

### Update Strategy:

```bash
# Update patch versions (safe)
npm update

# Update minor versions (check breaking changes)
npm install package-name@latest

# Update major versions (test thoroughly!)
npm install package-name@next
```

### Security Audits:

```bash
# Check vulnerabilities
npm audit

# Auto-fix (patches only)
npm audit fix

# Fix with breaking changes (test first!)
npm audit fix --force
```

---

## package-lock.json

### Rules:

- ✅ **ALWAYS commit** package-lock.json
- ✅ **NEVER manually edit** package-lock.json
- ✅ **Resolve conflicts** by running `npm install` after merge
- ❌ **NEVER gitignore** package-lock.json

### Why?

- Ensures exact same versions across all environments
- Faster installs (npm ci uses lockfile)
- Security audit depends on lockfile

### Resolving Conflicts:

```bash
# After merge conflict in package-lock.json
git checkout --theirs package-lock.json  # Or --ours
npm install  # Regenerate lockfile
git add package-lock.json
git commit
```

---

## Node Modules Best Practices

### ❌ NEVER:

- Commit `node_modules/` folder
- Manually modify files in `node_modules/`
- Delete `package-lock.json` to fix issues

### ✅ DO:

- Gitignore `node_modules/`
- Use `npm ci` for clean installs
- Use `patch-package` for emergency patches

### Patch-package (Emergency Patches):

```bash
# Install
npm install patch-package --save-dev

# Modify file in node_modules
vim node_modules/some-package/index.js

# Create patch
npx patch-package some-package

# Commit patches/ directory
git add patches/
git commit -m "fix: patch some-package for X"

# Patch applied automatically on npm install (via postinstall script)
```

---

## Cross-References

- **Node version source**: `/.nvmrc`
- **Build tools dependencies**: [00-project-wide.md](./00-project-wide.md#7-build-tools-in-production-dependencies)
- **Docker Node version**: [docker-deployment.md](./docker-deployment.md)
- **TypeScript configuration**: [01-typescript.md](./01-typescript.md)
