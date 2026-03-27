---
name: Management App Rules
description: Admin patterns for management app (TipTap, drag-drop, CRUD, audit logging)
type: app-specific
---

# Management App Rules (Port 4003)

Admin panel per gestione contenuti. TipTap editor, drag & drop con dnd-kit, CRUD operations, audit logging.

---

## Authentication & Authorization

**Regola**: Redirect to landing app if 401. Check permissions before sensitive actions.

**Perche**: Admin panel requires authenticated user with admin role. Backend enforces permissions.

### Authentication Flow

```typescript
// File: components/auth/AuthInitializer.tsx
export function AuthInitializer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isLoading, error } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const response = await api.get<SessionResponse>('/auth/session');
      return response.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });

  useEffect(() => {
    if (error && error.response?.status === 401) {
      // ✅ GOOD: Redirect to landing app for login
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
      window.location.href = `${landingUrl}/login?redirect=${encodeURIComponent(window.location.href)}`;
    }
  }, [error]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
```

### Session ID from Query Param (Multi-Tab)

```typescript
// File: pages/_app.tsx
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    // ✅ CRITICAL: Wait for router.query to be ready
    if (!router.isReady) return;

    const { sessionId } = router.query;

    if (sessionId && typeof sessionId === 'string') {
      // Save sessionId from query param (cross-origin redirect from game app)
      sessionStorage.setItem('character_session_id', sessionId);

      // Remove sessionId from URL (clean URL)
      const nextQuery = { ...router.query };
      delete nextQuery.sessionId;
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }

    setIsSessionReady(true);
  }, [router.isReady, router.query.sessionId]);

  // ✅ CRITICAL: Don't render AuthInitializer until sessionId is processed
  if (!isSessionReady) {
    return <div>Initializing...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <Component {...pageProps} />
      </AuthInitializer>
    </QueryClientProvider>
  );
}
```

**File di Riferimento**:
- `/apps/management/src/pages/_app.tsx` (lines 50-95)

---

## TipTap Editor Integration

**Regola**: Use TipTap for rich text editing with custom extensions. Store JSON in database, render HTML in frontend.

**Perche**: TipTap provides structured content (JSON), version control, collaborative editing support.

### Editor Configuration

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      bulletList: { keepMarks: true, keepAttributes: false },
      orderedList: { keepMarks: true, keepAttributes: false },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'tiptap-link', target: '_blank', rel: 'noopener noreferrer' },
    }),
    Image.configure({
      inline: true,
      HTMLAttributes: { class: 'tiptap-image' },
    }),
    Placeholder.configure({
      placeholder: 'Scrivi il contenuto del documento...',
    }),
  ],
  content: initialContent,  // JSON or HTML
  editorProps: {
    attributes: {
      class: 'tiptap-editor',
    },
  },
  onUpdate: ({ editor }) => {
    // Get JSON for storage
    const json = editor.getJSON();
    onChange(json);

    // Or get HTML for preview
    const html = editor.getHTML();
  },
});

return (
  <div className={styles.editorContainer}>
    <EditorToolbar editor={editor} />
    <EditorContent editor={editor} />
  </div>
);
```

### Toolbar Component

```typescript
function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <div className={styles.toolbar}>
      {/* Text formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? styles.active : ''}
      >
        <BoldIcon />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? styles.active : ''}
      >
        <ItalicIcon />
      </button>

      {/* Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? styles.active : ''}
      >
        H2
      </button>

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? styles.active : ''}
      >
        <BulletListIcon />
      </button>

      {/* Links */}
      <button onClick={() => {
        const url = window.prompt('URL:');
        if (url) {
          editor.chain().focus().setLink({ href: url }).run();
        }
      }}>
        <LinkIcon />
      </button>

      {/* Images */}
      <button onClick={() => {
        const url = window.prompt('Image URL:');
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      }}>
        <ImageIcon />
      </button>
    </div>
  );
}
```

### Storage Format

```typescript
// Store JSON in database (preserves structure)
const documentData = {
  title: 'Document Title',
  content: editor.getJSON(),  // TipTap JSON format
  contentHtml: editor.getHTML(),  // Cached HTML for fast rendering
};

await api.post('/admin/documents', documentData);

// Render HTML in frontend (read-only view)
<div className="document-content" dangerouslySetInnerHTML={{ __html: document.contentHtml }} />
```

---

## CRUD Patterns with Audit Logging

**Regola**: All create/update/delete operations must log audit trail with user ID, timestamp, action type.

**Perche**: Admin actions require accountability. Audit logs enable rollback, investigation.

### Create Operation

```typescript
const createDocumentMutation = useMutation({
  mutationFn: async (data: CreateDocumentInput) => {
    return await api.post<Document>('/admin/documents', {
      ...data,
      createdBy: session.user._id,  // ✅ GOOD: Track creator
      createdAt: new Date().toISOString(),
    });
  },
  onSuccess: (response) => {
    toast.success('Documento creato con successo');

    // Invalidate list queries
    queryClient.invalidateQueries({ queryKey: ['documents', 'list'] });

    // Navigate to edit page
    router.push(`/documents/edit/${response.data._id}`);
  },
  onError: (error) => {
    toast.error(`Errore: ${error.message}`);
  },
});
```

### Update Operation

```typescript
const updateDocumentMutation = useMutation({
  mutationFn: async ({ id, data }: { id: string; data: UpdateDocumentInput }) => {
    return await api.put<Document>(`/admin/documents/${id}`, {
      ...data,
      lastModifiedBy: session.user._id,  // ✅ GOOD: Track editor
      lastModifiedAt: new Date().toISOString(),
    });
  },
  onMutate: async ({ id, data }) => {
    // Cancel ongoing queries
    await queryClient.cancelQueries({ queryKey: ['documents', 'detail', id] });

    // Snapshot previous state
    const previousDocument = queryClient.getQueryData<Document>(['documents', 'detail', id]);

    // Optimistic update
    queryClient.setQueryData<Document>(['documents', 'detail', id], (old) => ({
      ...old,
      ...data,
    }));

    return { previousDocument };
  },
  onError: (err, { id }, context) => {
    // Rollback on error
    if (context?.previousDocument) {
      queryClient.setQueryData(['documents', 'detail', id], context.previousDocument);
    }
    toast.error(`Errore: ${err.message}`);
  },
  onSuccess: () => {
    toast.success('Documento aggiornato con successo');

    // Invalidate list (order/visibility might have changed)
    queryClient.invalidateQueries({ queryKey: ['documents', 'list'] });
  },
});
```

### Delete Operation

```typescript
const deleteDocumentMutation = useMutation({
  mutationFn: async (id: string) => {
    // ✅ GOOD: Soft delete (set deletedAt timestamp)
    return await api.delete(`/admin/documents/${id}`, {
      params: {
        deletedBy: session.user._id,  // Track who deleted
      },
    });

    // ❌ BAD: Hard delete (permanent, no audit trail)
    // return await api.delete(`/admin/documents/${id}?hard=true`);
  },
  onSuccess: () => {
    toast.success('Documento eliminato');

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['documents'] });

    // Navigate back to list
    router.push('/documents');
  },
  onError: (error) => {
    toast.error(`Errore: ${error.message}`);
  },
});
```

---

## Drag & Drop with dnd-kit

**Regola**: Use `@dnd-kit/core` and `@dnd-kit/sortable` for drag & drop. Update order on backend after drop.

**Perche**: dnd-kit is accessible, performant, works with virtual lists.

### Sortable List Setup

```typescript
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function DocumentTree({ documents }: { documents: Document[] }) {
  const [items, setItems] = useState(documents);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setItems((items) => {
      const oldIndex = items.findIndex((item) => item._id === active.id);
      const newIndex = items.findIndex((item) => item._id === over.id);

      // Optimistic update
      const newOrder = arrayMove(items, oldIndex, newIndex);

      // Persist to backend
      updateOrderMutation.mutate({
        documentId: active.id as string,
        newIndex,
      });

      return newOrder;
    });
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((d) => d._id)} strategy={verticalListSortingStrategy}>
        {items.map((document) => (
          <SortableDocumentItem key={document._id} document={document} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableDocumentItem({ document }: { document: Document }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: document._id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {document.title}
    </div>
  );
}
```

### Persist Order to Backend

```typescript
const updateOrderMutation = useMutation({
  mutationFn: async ({ documentId, newIndex }: { documentId: string; newIndex: number }) => {
    return await api.put(`/admin/documents/${documentId}/reorder`, {
      newIndex,
      updatedBy: session.user._id,
    });
  },
  onError: (error) => {
    toast.error('Errore nel riordinamento');
    // Refetch to restore correct order
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  },
});
```

---

## Form Handling (react-hook-form + Zod)

**Regola**: Use `react-hook-form` with Zod schema validation. Server-side validation is final authority.

**Perche**: Client validation improves UX. Server validation ensures security.

### Form with Validation

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const documentSchema = z.object({
  title: z.string().min(1, 'Titolo obbligatorio').max(200, 'Titolo troppo lungo'),
  type: z.enum(['ambientazione', 'regolamento'], {
    errorMap: () => ({ message: 'Tipo documento non valido' }),
  }),
  description: z.string().max(500, 'Descrizione troppo lunga').optional(),
  visible: z.boolean().default(true),
  draft: z.boolean().default(false),
});

type DocumentFormData = z.infer<typeof documentSchema>;

function CreateDocumentForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      visible: true,
      draft: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: DocumentFormData) => api.post('/admin/documents', data),
    onSuccess: (response) => {
      toast.success('Documento creato');
      router.push(`/documents/edit/${response.data._id}`);
    },
    onError: (error) => {
      // Server-side validation errors
      if (error.response?.data?.errors) {
        Object.entries(error.response.data.errors).forEach(([field, message]) => {
          setError(field as keyof DocumentFormData, { message: message as string });
        });
      } else {
        toast.error(error.message);
      }
    },
  });

  const onSubmit = (data: DocumentFormData) => {
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Titolo</label>
        <input {...register('title')} />
        {errors.title && <span className={styles.error}>{errors.title.message}</span>}
      </div>

      <div>
        <label>Tipo</label>
        <select {...register('type')}>
          <option value="ambientazione">Ambientazione</option>
          <option value="regolamento">Regolamento</option>
        </select>
        {errors.type && <span className={styles.error}>{errors.type.message}</span>}
      </div>

      <div>
        <label>Descrizione</label>
        <textarea {...register('description')} />
        {errors.description && <span className={styles.error}>{errors.description.message}</span>}
      </div>

      <div>
        <label>
          <input type="checkbox" {...register('visible')} />
          Visibile
        </label>
      </div>

      <div>
        <label>
          <input type="checkbox" {...register('draft')} />
          Bozza
        </label>
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creazione...' : 'Crea Documento'}
      </button>
    </form>
  );
}
```

---

## Table Patterns (Cell Renderers)

**Regola**: Use centralized cell renderers for consistent table formatting.

**Perche**: DRY principle. Consistent date formats, status badges, action buttons.

### Cell Renderer Registry

```typescript
// File: lib/cellRenderers.ts
type CellRenderer<T = any> = (value: T, row: any) => React.ReactNode;

const cellRenderers: Record<string, CellRenderer> = {
  // Date renderer
  date: (value: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  // Boolean renderer
  boolean: (value: boolean) => {
    return value ? (
      <span className={styles.badgeSuccess}>Sì</span>
    ) : (
      <span className={styles.badgeDefault}>No</span>
    );
  },

  // Status renderer
  status: (value: string) => {
    const statusClasses = {
      active: styles.badgeSuccess,
      draft: styles.badgeWarning,
      archived: styles.badgeDefault,
    };

    return <span className={statusClasses[value] || styles.badgeDefault}>{value}</span>;
  },

  // Actions renderer
  actions: (value: any, row: any) => {
    return (
      <div className={styles.actions}>
        <button onClick={() => handleEdit(row._id)}>Modifica</button>
        <button onClick={() => handleDelete(row._id)}>Elimina</button>
      </div>
    );
  },
};

export function renderCell(type: string, value: any, row: any): React.ReactNode {
  const renderer = cellRenderers[type];
  return renderer ? renderer(value, row) : value;
}

// Bootstrap renderers
export function bootstrapRenderers() {
  // Register custom renderers
  // Called in _app.tsx
}
```

### Table Component

```typescript
interface Column {
  key: string;
  header: string;
  renderer?: string;  // Cell renderer type
}

function DataTable({ columns, data }: { columns: Column[]; data: any[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key}>
                {col.renderer ? renderCell(col.renderer, row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Usage
<DataTable
  columns={[
    { key: 'title', header: 'Titolo' },
    { key: 'type', header: 'Tipo' },
    { key: 'visible', header: 'Visibile', renderer: 'boolean' },
    { key: 'createdAt', header: 'Data Creazione', renderer: 'date' },
    { key: '_id', header: 'Azioni', renderer: 'actions' },
  ]}
  data={documents}
/>
```

**File di Riferimento**:
- `/apps/management/src/lib/cellRenderers.ts`

---

## Document Tree Management

**Regola**: Documents are ALWAYS created with CreateDocumentModal (atomic document + route creation).

**Perche**: Simplified workflow. Category/redirect routes no longer needed - only document routes.

### Incidente Reale (2026-03-02)

**Change**: Removed "+ Nuova Route" button and CreateRouteModal component.

**Reason**: Documents are now created atomically (document + route in single operation). No more orphan documents.

### ✅ CORRETTO: Create document with route

```typescript
// CreateDocumentModal.tsx
const createDocumentMutation = useMutation({
  mutationFn: async (data: CreateDocumentInput) => {
    // Single API call creates BOTH document and route
    return await api.post('/admin/routes', {
      routeType: 'document',
      documentData: {
        title: data.title,
        type: data.type,
        content: data.content,
        visible: data.visible,
        draft: data.draft,
      },
      parentId: data.parentId || null,
      order: data.order || 0,
    });
  },
  onSuccess: () => {
    toast.success('Documento e rotta creati');
    queryClient.invalidateQueries({ queryKey: ['documents'] });
  },
});
```

### Context Menu "Crea Rotta" (Orphan Recovery)

```typescript
// Only used for orphan documents (created without route by mistake)
// Normal workflow: CreateDocumentModal → POST /admin/routes
const createRouteForOrphan = async (documentId: string) => {
  await api.post('/admin/routes', {
    routeType: 'document',
    documentId,  // Link existing orphan document
    parentId: null,
    order: 999,
  });
};
```

**File di Riferimento**:
- MEMORY.md (2026-03-02)

---

## SCSS Module Conventions

**Regola**: Use nested SCSS with BEM-like naming for page-specific styles.

### Page Styles Structure

```scss
// File: styles/pages/DocumentsPage.module.scss

.documentsPage {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;

  .sidebar {
    background: var(--color-bg-secondary);
    padding: 1rem;

    .treeContainer {
      // Tree-specific styles
    }
  }

  .mainContent {
    padding: 2rem;

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;

      .title {
        font-size: 2rem;
        font-weight: 600;
      }

      .actions {
        display: flex;
        gap: 1rem;
      }
    }

    .editorContainer {
      // Editor styles
    }
  }
}
```

---

## Cross-References

- **Shared Frontend**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/shared-frontend.md`
- **Game App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/game-app.md`
- **Documents App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/documents-app.md`
