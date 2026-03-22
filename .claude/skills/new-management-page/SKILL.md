---
description: Crea una nuova pagina nel pannello di gestione (apps/management). Usa quando ti viene chiesto di aggiungere una sezione al management, una nuova voce nel menu laterale, una lista con azioni CRUD o simili.
tags: [management, next.js, tanstack-query, admin]
---

# New Management Page

Crea una nuova pagina nel pannello di gestione di TenPennyNovels seguendo esattamente il pattern stabilito.

## Architettura del Management

```
apps/management/src/
├── pages/                    ← Next.js Pages Router (una cartella per area)
│   ├── documents/
│   ├── game-data/
│   ├── users/
│   └── ...
├── components/
│   ├── layout/Sidebar.tsx    ← NAV_ITEMS array — unico punto per il menu
│   ├── shared/               ← Modal, ConfigurableDataTable, FormField, ecc.
│   └── {area}/               ← componenti specifici per area
├── lib/api/
│   └── {area}.ts             ← funzioni che wrappano apiClient (axios)
├── hooks/api/
│   └── use{Area}.ts          ← TanStack Query hooks
├── types/api/
│   └── {Area}.ts             ← interfacce TypeScript
└── styles/pages/
    └── {NomePagina}.module.scss
```

## Step 1 — Definire i tipi

File: `apps/management/src/types/api/{Area}.ts`

```typescript
export interface MyEntity {
  _id: string;
  // ...campi
}

// Per risposte lista
export interface MyEntityListResponse {
  items: MyEntity[];
  // ... pagination se necessaria
}
```

## Step 2 — Funzioni API client

File: `apps/management/src/lib/api/{area}.ts`

```typescript
import { apiClient, withRetry } from './client';
import type { ApiResponse } from '@/types/api/common';
import type { MyEntity } from '@/types/api/MyEntity';

// GET lista
export async function getMyEntities(): Promise<MyEntity[]> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<MyEntity[]>>('/admin/my-entities')
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero');
  }
  return response.data.data;
}

// POST / PATCH / DELETE seguono lo stesso pattern
// IMPORTANTE: controlla sempre response.data.success prima di restituire
```

**Regole client:**
- Usare sempre `withRetry()` per wrappare la chiamata axios
- Controllare `response.data.success` — la risposta standard backend è `{ success: true, data: T }`
- I 4xx (tranne 408/429) non vengono retrytati automaticamente
- Il timeout di default è 30 secondi (`API_CONFIG.TIMEOUT`)

## Step 3 — TanStack Query hooks

File: `apps/management/src/hooks/api/use{Area}.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as myAPI from '@/lib/api/my-area';

// Query key factory — sempre come const per consistenza
export const myEntityKeys = {
  all: ['admin', 'my-entities'] as const,
  list: () => [...myEntityKeys.all, 'list'] as const,
  detail: (id: string) => [...myEntityKeys.all, 'detail', id] as const,
};

// Hook GET
export function useMyEntities() {
  return useQuery({
    queryKey: myEntityKeys.list(),
    queryFn: () => myAPI.getMyEntities(),
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });
}

// Hook mutation con invalidation
export function useCreateMyEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMyEntityData) => myAPI.createMyEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myEntityKeys.list() });
    },
  });
}

// Hook mutation con optimistic update (per toggle, riordino ecc.)
export function useToggleMyEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => myAPI.toggleMyEntity(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: myEntityKeys.list() });
      const previous = queryClient.getQueryData(myEntityKeys.list());
      // aggiorna la cache ottimisticamente...
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(myEntityKeys.list(), context.previous);
    },
  });
}
```

## Step 4 — Pagina

File: `apps/management/src/pages/{area}/{page-name}.tsx`

Il pattern di riferimento è `pages/documents/subtypes.tsx` (lista con azioni, nessuna `ConfigurableDataTable`).
Usa `ConfigurableDataTable` solo se la pagina è una lista generica paginata con molte colonne configurabili (vedi `skill-list.tsx`).

```typescript
import React, { useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useMyEntities, useCreateMyEntity, useDeleteMyEntity } from '@/hooks/api/useMyArea';
import { useConfirm } from '@/hooks/useConfirm';
import { useNotificationStore } from '@/store/notificationStore';
import styles from '@/styles/pages/MyPage.module.scss';

export default function MyPage() {
  const { data, isLoading } = useMyEntities();
  const createEntity = useCreateMyEntity();
  const deleteEntity = useDeleteMyEntity();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  const handleCreate = async () => {
    try {
      await createEntity.mutateAsync({ /* data */ });
      addNotification({ type: 'success', message: 'Creato con successo' });
    } catch (error) {
      addNotification({ type: 'error', message: error instanceof Error ? error.message : 'Errore' });
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({ title: 'Conferma', message: 'Sei sicuro?' });
    if (!confirmed) return;
    try {
      await deleteEntity.mutateAsync(id);
      addNotification({ type: 'success', message: 'Eliminato' });
    } catch (error) {
      addNotification({ type: 'error', message: error instanceof Error ? error.message : 'Errore' });
    }
  };

  return (
    <ManagementLayout>
      <Head><title>Ten Penny Novels | Titolo Pagina</title></Head>
      <div className={styles.myPage}>
        <header className={styles.header}>
          <div>
            <h1>Titolo Pagina</h1>
            <p>Sottotitolo / descrizione breve</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.createButton} onClick={handleCreate}>
              + Crea Nuovo
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : (data ?? []).length === 0 ? (
          <div className={styles.emptyState}>Nessun elemento trovato.</div>
        ) : (
          <div className={styles.list}>
            {/* righe lista */}
          </div>
        )}

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
```

## Step 5 — SCSS module

File: `apps/management/src/styles/pages/{NomePagina}.module.scss`

Usa le variabili CSS globali del tema (non colori hardcodati):

```scss
// Variabili disponibili:
// --bg-primary, --bg-secondary, --bg-tertiary
// --text-primary, --text-secondary, --text-muted
// --border-color
// --accent-color

.myPage { padding: 2rem; max-width: 1200px; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;

  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.25rem; color: var(--text-primary); }
  p  { font-size: 0.85rem; color: var(--text-muted); margin: 0; }
}

.headerActions { display: flex; gap: 0.5rem; align-items: center; }

.createButton {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  border: none;
  background: var(--accent-color);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  &:hover { opacity: 0.9; }
}

.loading, .emptyState {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}
```

## Step 6 — Aggiungere al menu sidebar

File: `apps/management/src/components/layout/Sidebar.tsx`

Trovare l'array `NAV_ITEMS` e aggiungere la voce nell'area corretta:

```typescript
// Struttura area esistente — aggiungere la nuova voce in children:
{
  key: 'my-area',
  label: 'Mia Area',
  icon: '🔧',
  children: [
    // voci esistenti...
    {
      key: 'my-area-new-page',
      label: 'Nome Voce Menu',
      href: '/my-area/page-name',
      permission: 'permission.name'  // vedi tabella sotto
    }
  ]
}
```

**Tabella permessi frontend → backend:**

| Permesso sidebar | Permesso backend (`requireGranularPermission`) | Chi lo ha |
|---|---|---|
| `documents.list` | `documents.read` | moderatore, master, amministratore |
| `documents.list` | `documents.update` | master, amministratore |
| `documents.list` | `documents.create` | master, amministratore |
| `documents.list` | `documents.delete` | amministratore |
| `users.list` | `users.read` | moderatore, master, amministratore |
| `characters.list` | `characters.read` | moderatore, master, amministratore |
| `characters.approve` | `characters.approve` | master, amministratore |
| `skills.access` | `skills.read` | master, amministratore |
| `system.config` | `system.config` | amministratore |

`isGestore` bypassa tutti i controlli sia frontend che backend.

## Step 7 — Backend (se necessario)

Se la pagina richiede nuovi endpoint:

1. **Controller**: aggiungere metodo statico in `services/unified-backend/src/modules/admin/controllers/{Area}Controller.ts`
   - Risposta sempre con `successResponse(data, message?, requestId)` per GET/PATCH
   - Usare `errorResponse(msg, code, details, statusCode, requestId)` per errori
   - Import helpers: `import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse'`

2. **Routes**: aggiungere in `services/unified-backend/src/modules/admin/routes/{area}Routes.ts`
   - `router.use(AdminAuthMiddleware.requireAdminAccess)` è già applicato globalmente nel file
   - Aggiungere route specifiche PRIMA dei pattern dinamici `/:id`
   - Per mutazioni: aggiungere `AdminAuthMiddleware.logAdminAction(...)` + `autoLogOutcome`

3. **Permessi**: già presenti per i principali domini. Per permessi nuovi modificare `services/unified-backend/src/config/permissions/admin.ts`

## Checklist finale

- [ ] `types/api/{Area}.ts` — interfacce aggiunte/aggiornate
- [ ] `lib/api/{area}.ts` — funzioni API con `withRetry` e check `response.data.success`
- [ ] `hooks/api/use{Area}.ts` — useQuery/useMutation con query key factory
- [ ] `pages/{area}/{page}.tsx` — pagina con `ManagementLayout`, `Head`, `useNotificationStore`
- [ ] `styles/pages/{NomePagina}.module.scss` — usa variabili CSS `var(--...)`
- [ ] `components/layout/Sidebar.tsx` — voce aggiunta in `NAV_ITEMS`
- [ ] Backend: controller + route + permesso corretto
- [ ] TypeScript check: `npm run type-check` in `services/unified-backend` e `apps/management`
