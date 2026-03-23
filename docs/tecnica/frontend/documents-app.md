# App Documenti — Documentazione tecnica

Knowledge base (ambientazione, regolamento): navigazione gerarchica, ricerca semantica, preferiti.

---

## Panoramica

- **Porta dev/prod (script)**: `4002` (`next dev` / `next start` in `apps/documents/package.json`).
- **URL produzione**: https://documenti.tenpennynovels.com
- **API**: `NEXT_PUBLIC_API_URL` (es. `https://api.tenpennynovels.com`), stessa base usata da Axios in `lib/api/client.ts` e dalle `fetch` in `getStaticPaths` / `pages/search.tsx`.

```mermaid
flowchart TB
  subgraph DocumentsApp["App documenti"]
    Home[Home]
    Amb[/ambientazione/...slug]
    Reg[/regolamento/...slug]
    Search[/search]
    Fav[/preferiti]
  end
  subgraph Backend["unified-backend"]
    API[REST API]
  end
  Home --> API
  Amb --> API
  Reg --> API
  Fav --> API
  Search --> API
```

---

## Stack

| Tecnologia | Uso |
|------------|-----|
| Next.js (Pages Router) | Routing, ISR |
| React 18 | UI |
| TanStack Query | Cache lato client (ricerca, preferiti, auth) |
| Axios | Chiamate API con cookie (`withCredentials`) |
| SCSS Modules | Stili |
| Zustand | Stato auth minimale (`authStore`) |
| isomorphic-dompurify | Sanificazione HTML dei documenti |

Il contenuto documenti è **HTML** sanitizzato e reso con `dangerouslySetInnerHTML` in `DocumentDetail`, non React Markdown.

---

## Routing e ISR

Pagine dettaglio: `getStaticPaths` + `getStaticProps` con `revalidate` (tipicamente 3600 s).  
Le liste path in build usano:

`GET {BASE_URL}/documents/routes/list?type=ambientazione|regolamento&all=true`

con `BASE_URL` = `API_CONFIG.BASE_URL` (`constants/config.ts`).

**Nota**: in generazione statica **non** vengono inoltrati cookie. Il contenuto incluso nella pagina ISR è quello che l’API restituisce **senza sessione**. Documenti realmente privati vanno gestiti lato backend (es. non inclusi in listing pubblico) o con altre strategie (es. SSR dedicato).

La pagina **Preferiti** (`preferiti/[...slug]`) usa `getServerSideProps` e può inoltrare i cookie per percorsi autenticati.

---

## Ricerca

- **Ricerca nella barra (header)**: `GET /documents/semantic-search` con parametro `q`, oppure stream SSE (`Accept: text/event-stream`) per query riconosciute come “domande”. Logica in `hooks/useSearch.ts`.
- **Pagina `/search`**: `GET /documents/search?q=...` (fetch da `pages/search.tsx`).

Soglia minima caratteri nell’UI della barra: **2** (debounce ~400 ms).

---

## Preferiti

React Query + `lib/api/favorites.ts` (toggle/list). L’interfaccia dipende da `isAuthenticated` dallo store/sessione.

---

## Variabili d’ambiente

| Variabile | Esempio |
|-----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://api.tenpennynovels.com` |
| `NEXT_PUBLIC_GA_ID` | (opzionale) Google Analytics |
| `NEXT_PUBLIC_LANDING_URL` / `NEXT_PUBLIC_GAME_URL` / … | Link tra app |

Template: `deploy/env-templates/documents.env`.

---

## Build e comandi

```bash
cd apps/documents
npm install
npm run dev    # porta 4002
npm run build && npm run start
```

Test: `jest.config.js` ignora `.next/`; `npm run test:ci` usa `--passWithNoTests` finché non ci sono test.

---

## Documenti correlati

- [API endpoints](../backend/api-endpoints.md)
- [Embeddings / Qdrant](../backend/embeddings-worker.md), [Qdrant](../infrastructure/qdrant-vector-db.md)

*Aggiornato in linea con il codice in `apps/documents` (ISR, HTML+DOMPurify, semantic-search).*
