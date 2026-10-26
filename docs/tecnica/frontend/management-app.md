# Management App — Documentazione Tecnica

**Pannello di amministrazione** (`apps/management`, porta 4003, produzione `gestione.tenpennynovels.com`): tabelle guidate da JSON, editor TipTap, albero dei documenti con drag & drop.

Regole normative (checklist «nuova pagina», TipTap v3, rinomina documenti, tab Bot): `.claude/rules/10-frontend.md`. Questo file descrive com'è fatta l'app; se diverge dal codice, vale il codice.

---

## Stack

Versioni dal `package.json`: Next.js 16 (Pages Router), React 18, Zustand 5, TanStack Query 5, Axios, React Hook Form 7, Zod 4, TipTap 3, dnd-kit (`core` 6 + `sortable` 10), Socket.IO Client 4, SCSS Modules. Test con Jest (`npm test`), lint `eslint .`, `npm run type-check`.

```
apps/management/src/
├── pages/          # una cartella per sezione del menu (vedi sotto)
├── components/     # auth, bots, characters, documents, forms, forum, layout, locations, shared, tickets
├── hooks/api/      # un hook React Query per risorsa (useUsers, useDocuments, useBots, useEditorial…)
├── lib/api/        # client Axios (client.ts) + un file per risorsa
├── lib/config/     # loader e schemi Zod delle tabelle JSON
├── lib/cellRenderers/  # registry dei renderer di cella
├── lib/tiptap/     # estensioni TipTap proprie
├── store/          # Zustand: authStore, permissionsStore, uiStore, featureFlagsStore, notificationStore, adminNotificationStore
└── public/config/tables/*.json   # configurazione delle tabelle
```

---

## Pagine

Il menu è `NAV_ITEMS` in `components/layout/Sidebar.tsx`: una pagina senza voce lì è raggiungibile solo via URL. Ogni voce ha un `permission` (nomi come `users.list`, `documents.list`, `system.config`).

| Sezione | Pagine (`src/pages/<sezione>/`) |
|---|---|
| users | `user-list`, `ban-list` |
| characters | `character-list` (con tab «Bot» condizionale), `character-pending`, `character-faceclaims`, `permissions` |
| locations | `location-list`, `position-map` |
| editorial | `canon-check` |
| documents | `document-list`, `subtypes`, `seo-documents` |
| game-data | `skill-list`, `social-class-list`, `occupation-list`, `item-list`, `forum-categories`, `forum-topics` |
| messages | `ongame`, `offgame` |
| moderation | `chat-moderation`, `forum-moderation`, `forum-discussions`, `forum-posts` |
| system | `configurations`, `audit-logs`, `broadcast`, `deleted-records`, `maintenance` |
| tickets | `dashboard`, `ticket-list`, `character-approvals` |

Il path del file deve combaciare con l'`href` della voce di menu.

---

## Autenticazione

Nessun `middleware.ts` di Next: l'autenticazione è il cookie HttpOnly gestito dal backend.

- `lib/api/client.ts`: istanza Axios con `withCredentials: true`; un interceptor aggiunge `X-Session-Id` letto da `sessionStorage` (per-tab); su **401** reindirizza alla landing (`NEXT_PUBLIC_LANDING_URL`) per il login.
- Il `sessionId` arriva dal game come query param: `_app.tsx` aspetta `router.isReady`, lo salva in `sessionStorage` e pulisce l'URL.
- I permessi li verifica il backend; il frontend li legge da `permissionsStore` (`hasPermission`) solo per nascondere voci e pulsanti. `isGestore` bypassa.
- Con un personaggio admin non `approved` il backend risponde 403 anche alle route admin (vedi `20-backend.md`).

---

## ConfigurableDataTable

Tabella guidata da JSON: una pagina passa `tableName` e i dati, il componente carica `public/config/tables/<tableName>.json`, lo valida con Zod e disegna colonne, filtri, ricerca, paginazione, selezione e azioni.

- Componente: `components/shared/ConfigurableDataTable.tsx`; schema: `lib/config/schemas.ts` (`TableConfigSchema`); caricamento: `lib/config/loader.ts` (`loadTableConfig`) e hook `hooks/useTableConfig.ts`.
- Un file JSON non valido fa fallire il caricamento con errore nei log: la tabella resta vuota.
- La visibilità delle colonne scelta dall'utente è persistita in `uiStore`.

Forma del JSON (campi reali dello schema):

```json
{
  "_meta": { "version": "3.1.0" },
  "table": { "name": "seo-documents", "title": "SEO Documenti", "searchable": true, "selectable": false,
             "pagination": { "defaultPageSize": 50, "pageSizeOptions": [25, 50, 100] } },
  "columns": [
    { "key": "title", "label": "Titolo", "type": "text", "sortable": true, "width": "220px",
      "render": { "type": "text" } }
  ],
  "actions":     [ { "key": "edit", "label": "Modifica", "type": "primary", "permission": "…" } ],
  "bulkActions": [ { "key": "…", "label": "…", "confirmMessage": "…" } ],
  "filters":     [ { "key": "…", "label": "…", "type": "select", "field": "…", "options": [] } ],
  "sidePanels":  { }
}
```

- `column.type`: `text | email | number | boolean | date | datetime | select | multiselect`; `column.render.type` sceglie il renderer di cella.
- `action.type`/`bulkAction.type`: `primary | secondary | danger | success`; `permission` e `confirmMessage` sono opzionali.
- `filter.type`: `text | select | multiselect | date | daterange`.
- `sidePanels` descrive i pannelli laterali di modifica, resi da `components/shared/SidePanel.tsx` (React Hook Form).

Props principali del componente: `tableName`, `data`, `loading`, `selectedItems`/`onSelectionChange`, `onAction(actionKey, item)`, `onBulkAction(actionKey, items, allPagesSelected?)`, `pagination` (`page`, `pageSize`, `total`, `onPageChange`, `onPageSizeChange`), `sortBy`/`sortOrder`/`onSortChange`, `filters`/`onFilterChange`, `renderActions`, `defaultSearch`.

JSON presenti: `audit-logs`, `ban-list`, `character-approvals`, `character-list`, `character-pending`, `character-permissions`, `deleted-records`, `document-list`, `face-claims-list`, `forum-categories`, `forum-topics`, `item-list`, `occupation-list`, `seo-documents`, `skill-list`, `social-class-list`, `ticket-list`, `user-list`.

### Renderer di cella

Registry in `lib/cellRenderers/` (`registry.ts` = classe `CellRendererRegistry`, `index.ts` = `bootstrapRenderers()`). Tipi registrati oggi: `text`, `badge`, `badge-list`, `datetime` (alias `date`), `boolean`, `conflict-badge` (record cancellati), `image`. Un tipo sconosciuto usa il renderer di default con un avviso nei log. Per aggiungerne uno: file in `renderers/` e una riga `cellRenderers.register(...)` in `bootstrapRenderers()`. Il registry li monta con `React.createElement`, quindi un renderer può usare hook.

---

## Editor di documenti (TipTap v3)

`components/documents/DocumentContentEditor.tsx` (usato da `EditDocumentModal`/`CreateDocumentModal`). Estensioni: StarterKit, Link, Underline, Image, TextStyle + Color, Highlight, Table (+ Row/Cell/Header, ridimensionabile) e le due proprie di `lib/tiptap/`: `PasteHardBreakSplit`/`toggleHeadingOnLine` (`hardBreaks.ts`) e `PasteColorCleanup` (`pasteColorCleanup.ts`).

Il contenuto è un documento TipTap in JSON (`editor.getJSON()`); l'HTML (`getHTML()`) solo in modalità HTML. Trappola da non reintrodurre (incidente 2026-09-18): in v3 `setContent` emette `update` per default, quindi ogni sincronizzazione programmatica va con `{ emitUpdate: false }` (dettagli in `10-frontend.md`).

Altri componenti dei documenti: `EditSeoDescriptionModal` (modifica a mano della descrizione SEO), `DocumentIframePreview` (anteprima).

---

## Albero dei documenti e drag & drop

- `components/documents/HierarchicalDocumentEditor.tsx` (contesto dnd-kit, sensore con soglia di 8 px), `DocumentTreeView.tsx`, `DraggableDocumentNode.tsx`, `DocumentNode.tsx`.
- `lib/documentTree.ts` replica le regole di spostamento (cicli, stesso tipo e sottotipo, profondità massima) **solo per non proporre drop che il server rifiuterebbe**; l'autorità è il backend.
- API (`lib/api/documents.ts`): `moveDocument(id, parentId, beforeId)` → `PATCH /admin/documents/:id/move` (cambio di genitore e posizione), `reorderSiblings(parentId, orderedIds)` → `PUT /admin/documents/reorder` (riordino fra fratelli). `moveDocument` non ha retry: una violazione non si risolve riprovando.
- dnd-kit è usato anche in `locations/LocationMapEditor.tsx` e `pages/documents/subtypes.tsx`.

---

## Dati dal server

- **Client**: `lib/api/<risorsa>.ts` (funzioni sul singleton di `client.ts`) + `hooks/api/use<Risorsa>.ts` (React Query). Non esiste un `adminApi` unico.
- **Risposte**: formato standard del backend (`success`/`data`/`list`/`pagination`), vedi `00-critical.md` §3.
- **Optimistic update** per i toggle: regola 5 di `00-critical.md` (niente `invalidateQueries` in `onSuccess`).
- **Feature flag AI/bot**: `store/featureFlagsStore.ts` legge `GET /admin/system/feature-flags` (`editorialAiEnabled`, `botAdminEnabled`, `botChatEnabled`, `botChatMissing`); `ManagementLayout` lo rilegge ogni 120 s; è l'unico canale con cui la UI sa cosa è acceso (vedi `20-backend.md`).
- **SSE**: la generazione dei bot e le funzioni AI lente leggono flussi SSE con `fetch` (`lib/api/bots.ts`): Axios non li legge.

### Tempo reale

Non c'è un `WebSocketContext` nel management (quello è del game). `hooks/useSocket.ts` crea una connessione Socket.IO condivisa (`NEXT_PUBLIC_WS_URL`, `withCredentials`), chiusa quando nessun componente la usa; `hooks/useAdminNotifications.ts` ascolta `character_pending_approval` e alimenta `adminNotificationStore` (campanella, scossa, suono, toast). Il catalogo degli eventi è in `docs/tecnica/backend/websocket-events.md`.

---

## Stato (Zustand)

| Store | Contenuto |
|---|---|
| `authStore` | utente autenticato (persistito) |
| `permissionsStore` | permessi dell'admin, `hasPermission()` |
| `uiStore` | preferenze UI persistite (es. colonne visibili per tabella) |
| `featureFlagsStore` | flag AI/bot dal server (vedi sopra) |
| `notificationStore` | toast |
| `adminNotificationStore` | notifiche admin (persistito) |

---

## Variabili d'ambiente

Lette da `constants/config.ts` e dal codice (template di produzione: `deploy/env-templates/management.env`):

| Variabile | Uso | Default locale |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | API (api-gateway) | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | Socket.IO | `http://localhost:3001` |
| `NEXT_PUBLIC_LANDING_URL` | redirect al login su 401 | `http://localhost:4000` |
| `NEXT_PUBLIC_GAME_URL`, `NEXT_PUBLIC_DOCUMENTS_URL` | link verso le altre app | — |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_VERSION` | etichette UI | — |

L'app non usa un `basePath`: in produzione sta sul proprio dominio (`gestione.`).

---

## Build e deploy

```bash
cd apps/management && npm install
npm run dev     # next dev -p 4003
npm run build && npm start
```

In produzione gira sotto PM2 come `tenpennynovels-gestione` (`ecosystem.config.js`, `next start -p 4003`, fork ×1, riavvio oltre 512 MB). Il deploy è descritto in `40-workflow.md`.

---

## Troubleshooting

- **Tabella vuota o errore di configurazione**: `tableName` deve combaciare con `public/config/tables/<tableName>.json`; il JSON deve passare `TableConfigSchema` (errore Zod nei log del browser).
- **Pagina raggiungibile ma assente dal menu**: manca la voce in `NAV_ITEMS`.
- **Il documento si svuota al primo salvataggio**: sincronizzazione TipTap senza `emitUpdate: false` (incidente 2026-09-18).
- **403 su tutte le route admin in locale**: il personaggio admin del seed è in bozza; per provare il pannello serve `approved` (vedi `20-backend.md`).
- **Drag & drop rifiutato**: il server valida cicli, sottotipo e profondità (`MAX_DOCUMENT_DEPTH`); il messaggio d'errore dice quale regola è violata.

---

## Documentazione collegata

- [API Endpoints](../backend/api-endpoints.md)
- [Error Codes](../backend/error-codes.md)
- [WebSocket Events](../backend/websocket-events.md)
