# 10 — Frontend (`apps/`)

Regole normative per le 4 app Next.js. Descrizione completa di ciascuna app: `docs/tecnica/frontend/`.

| App | Porta | Stack specifico | Doc |
|---|---|---|---|
| landing | 4000 | **Fetch API** (non Axios), no state lib, react-hook-form + Zod | `docs/tecnica/frontend/landing-app.md` |
| game | 4001 | Axios, React Query, **9 store Zustand**, Socket.IO | `docs/tecnica/frontend/game-app.md` |
| documents | 4002 | Axios, React Query, SSR per SEO, read-only | `docs/tecnica/frontend/documents-app.md` |
| management | 4003 | Axios, React Query, TipTap, dnd-kit | `docs/tecnica/frontend/management-app.md` |

Comune a tutte: Next.js 16 **Pages Router** (non App Router), React 18, TypeScript strict, SCSS Modules, Zod.

---

## Regole trasversali

**Pages Router**: le route stanno in `pages/`, il codice in `src/`. Non introdurre `app/`.

**Path alias**: usa `@/*` → `src/*`. Mai import relativi profondi (`../../../hooks`).

**React Query = server state · Zustand = client state.** Non mescolare: nessuna copia di dati server dentro Zustand.

**Query keys gerarchiche**: `['documents']` → `['documents','list',type]` → `['documents','detail',id]`. Permette invalidazioni selettive.

**Selettori Zustand**: `useStore((s) => s.field)`, non destructuring dell'intero store (causa re-render su ogni cambio).

**Cookie**: autenticazione via cookie HttpOnly. Il frontend non legge né scrive il token. Serve `withCredentials: true` (Axios) o `credentials: 'include'` (fetch).

**Sessione personaggio multi-tab**: `sessionId` in **`sessionStorage`** (per-tab), mai `localStorage` (condiviso tra tab → il tab 1 vedrebbe il personaggio del tab 2). Inviato come header `X-Session-Id`.
Su redirect cross-origin arriva come query param: leggerlo, salvarlo in `sessionStorage`, poi ripulire l'URL. In management **attendere `router.isReady`** prima di processarlo.

**Stili**: solo SCSS Modules (`*.module.scss`). CSS globale solo in `globals.scss`. Variabili CSS in `:root`.

**Error boundary**: ogni app deve averne uno per evitare il crash totale.

---

## ESLint — configurazione reale (disomogenea)

| App | Config | `no-console` |
|---|---|---|
| game | `eslint.config.mjs` (flat, ESLint 9) | `error` — off per `src/lib/logger.ts` |
| management | `.eslintrc.json` | `error` — off per `src/lib/logger.ts` |
| documents | `.eslintrc.json` (+ type-checking, import/order) | `warn` con `allow: ["warn","error"]` |
| landing | **nessuna config** | — |

Non assumere flat config: solo `game` la usa. Prima di modificare la config di un'app, guarda quale dei due formati usa.

---

## game (4001) — l'app più delicata

**WebSocket**: vedi regola 4 in `00-critical.md`. Mai `socket.on()` nei componenti.

**Optimistic updates**: vedi regola 5 in `00-critical.md`.

**9 store** in `apps/game/src/store/`: `authStore` (persistito), `chatStore`, `locationStore`, `gameStateStore`, `presenceStore`, `uiStore`, `windowManagerStore`, `wizardStore` (il più grande), `forumStore`.
Dettaglio delle responsabilità: `docs/tecnica/frontend/game-app.md`.

**Single point of write**: le transizioni di location passano solo da `gameStateStore.enterLocation()`/`leaveLocation()`, che gestiscono update ottimistico + persistenza HTTP + join/leave della room WebSocket. I componenti non chiamano le API di location direttamente né scrivono lo stato a mano.

**Incidente 2026-02-19** — i componenti chiamavano `joinLocation`/`leaveLocation` direttamente: UI che sfarfallava e occupanti non ripuliti lato backend. Fix: endpoint dedicato `POST /game/locations/leave` + centralizzazione nello store.

**Typing indicator**: emit throttled a 2s, indicatori scaduti ripuliti dopo 3s.

**12 tipi di messaggio** in location chat (standard, OOC, whisper, master, dice roll, skill/stat check, combat, item use, reaction, defender, moderation): catalogo in `docs/tecnica/frontend/game-app.md`.

---

## management (4003)

**Auth**: su 401 redirect alla landing per il login. I permessi sono verificati dal backend; `isGestore` bypassa i controlli.

**Mutazioni con audit**: create/update/delete tracciano l'autore (`createdBy`, `lastModifiedBy`, `deletedBy`). Preferire **soft delete** (`deletedAt`) all'eliminazione fisica.

**Documenti**: si creano sempre atomicamente documento + route via `POST /admin/routes`. `CreateRouteModal` è stato rimosso (2026-03-02): non reintrodurlo. La voce "crea rotta" nel context menu serve solo a recuperare documenti orfani.

**Cell renderer**: registry centralizzato in `apps/management/src/lib/cellRenderers/` (è una **directory**, non un singolo file) per formattazione uniforme di date, booleani, stati e azioni nelle tabelle.

### Aggiungere una pagina — checklist obbligatoria

L'errore più frequente è saltare il punto 1: la pagina è raggiungibile via URL ma invisibile nel menu.

1. **Voce in `NAV_ITEMS`** in `apps/management/src/components/layout/Sidebar.tsx` (`key`, `label`, `href`, `permission`)
2. File pagina in `src/pages/<categoria>/<nome>.tsx` — il path deve combaciare con `href`
3. API client in `src/lib/api/<nome>.ts`
4. Hook React Query in `src/hooks/api/use<Nome>.ts`
5. Permesso in `services/unified-backend/src/config/permissions/` se non esiste
6. Route backend nel modulo admin con middleware di auth

Skill disponibile: `/new-management-page`.

---

## documents (4002)

**SSR per SEO**: le pagine documento usano `getServerSideProps` e inoltrano i cookie all'API. Rendering client-side = invisibile a Google.

**Build bypass**: durante `next build` l'API può non essere raggiungibile. L'header `X-Tenpenny-Documents-Build` (secret condiviso col gateway) salta il rate limit; in fase di build si usa un mock.

**Read-only**: nessuna mutazione sui documenti. L'editing sta in management. Eccezione: i preferiti dell'utente.

**Ricerca semantica**: endpoint dedicato con fallback su ricerca testuale. Query minima 3 caratteri.

**Font vittoriani** via `next/font/local` con variabili CSS. Nessun CDN esterno.

---

## landing (4000)

**Fetch API, non Axios** — è l'unica app così. Wrapper in `src/lib/api/client.ts` con retry a backoff esponenziale, timeout e deduplica delle richieste in volo.

**Nessuna libreria di state**: solo `useState`/`useEffect`. Non introdurre Zustand o Context per l'auth: lo stato di sessione vive nei cookie HttpOnly.

**Service layer**: le chiamate passano da `src/services/*` (`AuthService`, `CharacterService`), mai `fetch` diretto nei componenti.

**Flusso selezione personaggio**: login → lista personaggi → `POST /auth/characters/select` → il backend crea la sessione Redis e restituisce `sessionId` → salvataggio in `sessionStorage` → redirect a `game.` con `?sessionId=...`.

**Validazione**: react-hook-form + Zod. La validazione server è l'autorità finale: mappare gli errori del backend sui campi del form.
