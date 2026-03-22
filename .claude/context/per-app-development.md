# Guida sviluppo per app e unified-backend (AI / umani)

Per **Cursor**, le stesse convenzioni sono in `.cursor/rules/` (file `.mdc` con glob automatico). Questo documento serve per **Claude Code**, `@`-mention o lettura manuale, con checklist unificate.

Riferimenti trasversali: `api-patterns.md` (formato risposte API), `architecture.md`, `authentication-flow.md`, `websocket-system.md`.

---

## Panoramica monorepo

- `apps/landing`, `apps/game`, `apps/documents`, `apps/management` — Next.js, TypeScript, **Pages Router** (`src/pages/`).
- `services/unified-backend` — Express, API dietro gateway (porta gateway tipica 8000 in dev).

Porte dev (`package.json`): landing **4000**, game **4001**, documents **4002**, management **4003**.

Prefissi backend (`services/unified-backend/src/app.ts`): `/auth`, `/documents`, `/forum`, `/game`, `/admin`, `/webhooks`.

---

## App Game (`apps/game`)

### Nuova pagina
- File in `src/pages/`.
- Provider in `src/pages/_app.tsx`: ordine QueryClient → Auth → WebSocket → Environment → UI globali.
- `sessionId` in query string → `sessionStorage.character_session_id` (gestito in `_app`).

### API
- `src/lib/api/client.ts` (`apiClient`), config `src/constants/config.ts`.
- Cookie HttpOnly + `withCredentials`; header `X-Session-Id` se c’è sessione personaggio.
- Moduli per dominio in `src/lib/api/*.ts`. TanStack Query: `src/lib/api/queryClient.ts`.

### Stili
- SCSS modules sotto `src/styles/...` o locale al componente; globali `src/styles/main.scss`.

### Realtime
- `src/contexts/WebSocketContext.tsx` — estendere i pattern esistenti.

---

## App Documents (`apps/documents`)

### Nuova pagina
- `src/pages/`, shell `src/pages/_app.tsx` (Query, auth, font).

### API
- `src/lib/api/client.ts` + `src/constants/config.ts`.
- In SSR/build, header `X-Tenpenny-Documents-Build` se `DOCUMENTS_BUILD_BYPASS_SECRET` è definito.
- API per dominio: `src/lib/api/documents.ts`, `search.ts`, `favorites.ts`, ecc.

### Query
- `src/lib/api/queryClient.ts`.

---

## App Management (`apps/management`)

### Nuova pagina
- `src/pages/` (sottocartelle per area admin).

### API
- `src/lib/api/client.ts`; su **401** redirect a `${API_CONFIG.LANDING_URL}/auth/login`.
- Tipi comuni: `src/types/api/common` (e affini).

### Tabelle
- `src/lib/cellRenderers` — bootstrap in `_app.tsx`.

### Stili
- Spesso `src/styles/pages/*.module.scss`.

### Form / editor
- Riutilizzare react-hook-form, zod, TipTap dove già presenti.

---

## App Landing (`apps/landing`)

### Nuova pagina
- `src/pages/`; layout vittoriani e `Head` come le pagine esistenti.

### API
- **Fetch**, non Axios/React Query: `src/lib/api/client.ts`, errori in `src/lib/api/errors.ts`, tipi in `src/types`.
- `NEXT_PUBLIC_API_URL` → gateway.

### Form
- react-hook-form + zod; schemi in `lib/validation/schemas.ts` / `utils/schemas.ts`.

### Servizi
- Preferire `src/services/*.ts` per chiamate di dominio.

### Stili
- `src/styles/main.scss`, componenti in `src/components/`.

---

## Unified backend (`services/unified-backend`)

### Nuova route HTTP
1. Scegliere modulo (`modules/auth|game|admin|documents|forum|tickets|...`).
2. Implementare handler/controller e file route nel modulo.
3. Registrare in `routes/index.ts` del modulo.
4. Risposte con `src/shared/utils/apiResponse.ts` (allineato a `api-patterns.md`).
5. Modelli in `src/database/models/` se servono nuove collection.

### Import
- Usare alias `@shared/*`, `@modules/*`, `@database/*`, `@config/*` da `tsconfig.json`.

### Coerenza
- Non introdurre prefissi URL non montati in `src/app.ts` senza aggiornare anche il gateway e la documentazione.
