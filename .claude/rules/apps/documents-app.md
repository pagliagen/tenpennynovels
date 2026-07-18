---
name: Documents App Rules
description: SSR patterns, semantic search, read-only document viewing
type: app-specific
---

# Documents App Rules (Port 4002)

App pubblica per visualizzazione documenti. SSR per SEO, semantic search, read-only, Victorian theme.

---

## SSR Patterns for SEO

**Regola**: Use `getServerSideProps` for document pages. Pre-render HTML for search engines.

**Perche**: Documents must be crawlable by Google. Client-side rendering = invisible to search engines.

### Document Detail Page with SSR

```typescript
// File: pages/[type]/[...slug].tsx
import { GetServerSideProps } from 'next';

interface DocumentPageProps {
  data: DocumentDetail | null;
  error?: string;
}

export default function DocumentPage({ data, error }: DocumentPageProps) {
  const router = useRouter();

  if (error || !data) {
    return (
      <ErrorMessage
        fullPage
        title="Ten Penny Novels | Documento non trovato"
        message={error || 'Il documento richiesto non è disponibile o è privato.'}
        onRetry={() => router.reload()}
      />
    );
  }

  const { document } = data;

  return (
    <>
      <SEO
        title={`Ten Penny Novels | ${document.title}`}
        description={document.description || `Leggi ${document.title} su Ten Penny Novels.`}
        canonical={`https://documenti.tenpennynovels.com/${document.type}/${document.path}`}
        ogType="article"
      />

      <div className={styles.mainContainer}>
        <DocumentHeader document={document} />
        <DocumentDetail data={data} />
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const slugArray = params?.slug as string[] | undefined;

  if (!slugArray || slugArray.length < 1) {
    return { notFound: true };
  }

  const type = params?.type as string;
  const path = slugArray.join('/');

  // Validate type
  if (type !== 'ambientazione' && type !== 'regolamento') {
    return { notFound: true };
  }

  try {
    // ✅ GOOD: Pass cookies to API for authentication
    const cookies = req.headers.cookie || '';
    const data = await documentsApi.get(type, path, cookies);

    return { props: { data } };
  } catch (error: any) {
    console.error(`[Document Detail] Error loading ${type}/${path}:`, error);

    // Return 404 for not found errors
    if (error?.statusCode === 404 || error?.response?.status === 404) {
      return { notFound: true };
    }

    // Return error message for other errors
    return {
      props: {
        data: null,
        error: 'Errore nel caricamento del documento. Riprova più tardi.',
      },
    };
  }
};
```

### SEO Component

```typescript
// File: components/SEO.tsx
import Head from 'next/head';

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  noindex?: boolean;
  nofollow?: boolean;
}

export function SEO({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage,
  noindex = false,
  nofollow = false,
}: SEOProps) {
  const defaultDescription = 'Explore the Victorian world of Ten Penny Novels.';
  const defaultImage = 'https://documenti.tenpennynovels.com/og-image.jpg';

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description || defaultDescription} />

      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Robots meta */}
      {(noindex || nofollow) && (
        <meta name="robots" content={`${noindex ? 'noindex' : ''}${nofollow ? ',nofollow' : ''}`} />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:type" content={ogType} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={ogImage || defaultImage} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description || defaultDescription} />
      <meta name="twitter:image" content={ogImage || defaultImage} />
    </Head>
  );
}
```

**File di Riferimento**:
- `/apps/documents/src/pages/preferiti/[...slug].tsx` (lines 51-84)

---

## Build Bypass Header

**Regola**: Use `X-Tenpenny-Documents-Build` header during `next build` to prevent SSR timeout.

**Perche**: During build, Next.js pre-renders pages. API might not be available. Bypass SSR with mock data.

### API Client Build Mode

```typescript
// File: lib/api/documents.ts
export const documentsApi = {
  async get(type: string, path: string, cookies?: string): Promise<DocumentDetail> {
    // ✅ GOOD: Check if running in build mode (next build)
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      // Return mock data during build
      return {
        document: {
          _id: 'build-mock',
          title: 'Build Mode Document',
          type,
          path,
          content: '<p>Mock content for build</p>',
          contentHtml: '<p>Mock content for build</p>',
          visible: true,
          draft: false,
          createdAt: new Date().toISOString(),
        },
        breadcrumbs: [],
        siblings: [],
        children: [],
      };
    }

    // Normal mode: Call API
    const response = await fetch(`${API_URL}/documents/${type}/${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || '',
        'X-Tenpenny-Documents-Build': process.env.NODE_ENV === 'production' ? 'true' : 'false',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    return response.json();
  },
};
```

### Backend Build Header Check

```typescript
// Backend: Check X-Tenpenny-Documents-Build header
if (req.headers['x-tenpenny-documents-build'] === 'true') {
  // Return minimal data for build
  return res.json({
    document: {
      _id: 'build-mock',
      title: 'Build Document',
      content: '<p>Mock content</p>',
    },
  });
}
```

---

## Semantic Search Integration

**Regola**: Use semantic search endpoint for intelligent document search. Fallback to text search.

**Perche**: Semantic search understands meaning (e.g., "pistole" finds "armi da fuoco"). Better UX.

### Search Component

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/lib/api/search';

function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'ambientazione' | 'regolamento' | undefined>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', 'semantic', query, type],
    queryFn: () => searchApi.semantic(query, type),
    enabled: query.length >= 3,  // Only search if query >= 3 chars
    staleTime: 5 * 60 * 1000,    // Cache results for 5 minutes
  });

  return (
    <div className={styles.searchContainer}>
      <input
        type="text"
        placeholder="Cerca documenti..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={styles.searchInput}
      />

      <select value={type || ''} onChange={(e) => setType(e.target.value as any)}>
        <option value="">Tutti i tipi</option>
        <option value="ambientazione">Ambientazione</option>
        <option value="regolamento">Regolamento</option>
      </select>

      {isLoading && <div>Ricerca in corso...</div>}

      {error && <div className={styles.error}>Errore nella ricerca</div>}

      {data && (
        <div className={styles.results}>
          <p>{data.results.length} risultati trovati</p>

          {data.results.map((result) => (
            <SearchResultCard
              key={result._id}
              document={result}
              score={result.score}
            />
          ))}

          {data.results.length === 0 && (
            <div className={styles.noResults}>
              Nessun documento trovato per "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Search API Client

```typescript
// File: lib/api/search.ts
export const searchApi = {
  /**
   * Semantic search using embeddings + vector similarity
   *
   * @param query - Search query (min 3 chars)
   * @param type - Optional document type filter
   * @returns Search results with similarity scores
   */
  async semantic(query: string, type?: string): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      ...(type && { type }),
    });

    const response = await fetch(`${API_URL}/documents/search/semantic?${params}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Semantic search failed');
    }

    return response.json();
  },

  /**
   * Text search fallback (keyword-based)
   *
   * @param query - Search query
   * @param type - Optional document type filter
   * @returns Search results
   */
  async text(query: string, type?: string): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      ...(type && { type }),
    });

    const response = await fetch(`${API_URL}/documents/search?${params}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Text search failed');
    }

    return response.json();
  },
};
```

### Search Result Card

```typescript
interface SearchResultCardProps {
  document: DocumentSearchResult;
  score?: number;
}

function SearchResultCard({ document, score }: SearchResultCardProps) {
  return (
    <Link href={`/${document.type}/${document.path}`} className={styles.resultCard}>
      <div className={styles.resultHeader}>
        <h3 className={styles.resultTitle}>{document.title}</h3>
        {score && (
          <span className={styles.resultScore}>
            {Math.round(score * 100)}% match
          </span>
        )}
      </div>

      {document.description && (
        <p className={styles.resultDescription}>{document.description}</p>
      )}

      <div className={styles.resultMeta}>
        <span className={styles.resultType}>
          {document.type === 'ambientazione' ? 'Ambientazione' : 'Regolamento'}
        </span>
        <span className={styles.resultPath}>{document.path}</span>
      </div>
    </Link>
  );
}
```

**Dettagli Sistema Embeddings**: MEMORY.md (2026-02-23)

---

## Read-Only Nature (No Mutations)

**Regola**: Documents app is read-only. NO create/update/delete operations.

**Perche**: Public-facing app. Editing happens in management app (port 4003).

### API Module Structure

```typescript
// File: lib/api/documents.ts
export const documentsApi = {
  // ✅ GOOD: Read operations only
  async get(type: string, path: string, cookies?: string): Promise<DocumentDetail> {
    // Fetch document detail
  },

  async list(type?: string): Promise<Document[]> {
    // Fetch document list
  },

  async tree(type?: string): Promise<RouteTree[]> {
    // Fetch document tree
  },

  // ❌ BAD: No mutations in documents app
  // async create() { ... }
  // async update() { ... }
  // async delete() { ... }
};
```

### Favorites API (User-Specific)

```typescript
// File: lib/api/favorites.ts
export const favoritesApi = {
  /**
   * Get user's favorite documents
   *
   * EXCEPTION: This is a mutation-like operation, but only affects user's favorites list.
   * Does NOT modify documents themselves.
   */
  async list(): Promise<Document[]> {
    const response = await fetch(`${API_URL}/documents/favorites`, {
      credentials: 'include',
    });

    return response.json();
  },

  async add(documentId: string): Promise<void> {
    await fetch(`${API_URL}/documents/favorites/${documentId}`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  async remove(documentId: string): Promise<void> {
    await fetch(`${API_URL}/documents/favorites/${documentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },
};
```

---

## Route-Based Navigation

**Regola**: Use Next.js file-based routing for document hierarchy.

### Route Structure

```
pages/
├── index.tsx                    # Home page (document list)
├── ambientazione/
│   └── [...slug].tsx           # Dynamic route for ambientazione/*
├── regolamento/
│   └── [...slug].tsx           # Dynamic route for regolamento/*
├── preferiti/
│   ├── index.tsx               # Favorites list
│   └── [...slug].tsx           # Favorite document detail
└── cerca.tsx                   # Search page
```

### Dynamic Route Handler

```typescript
// File: pages/ambientazione/[...slug].tsx
export default function AmbientazionePage({ data, error }: PageProps) {
  // Render document
}

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const slugArray = params?.slug as string[] | undefined;

  if (!slugArray || slugArray.length < 1) {
    return { notFound: true };
  }

  const path = slugArray.join('/');  // Join slug array: ['londra', 'west-end'] → 'londra/west-end'

  try {
    const cookies = req.headers.cookie || '';
    const data = await documentsApi.get('ambientazione', path, cookies);

    return { props: { data } };
  } catch (error) {
    return { notFound: true };
  }
};
```

---

## Font Loading Patterns (Victorian Theme)

**Regola**: Use `next/font` for optimized Victorian font loading. No external font CDN.

**Perche**: `next/font` automatically optimizes fonts (subsetting, preloading, self-hosting).

### Font Configuration

```typescript
// File: pages/_app.tsx
import localFont from 'next/font/local';

// Victorian fonts (local files in public/fonts/)
const thriftedAttire = localFont({
  src: [
    {
      path: '../../public/fonts/thrifted-attire-regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/thrifted-attire-italic.otf',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-thrifted',  // CSS variable
  display: 'swap',              // Font display strategy
  preload: true,                // Preload font
});

const lesMysteres = localFont({
  src: '../../public/fonts/les-mysteres-de-paris.ttf',
  variable: '--font-mysteres',
  display: 'swap',
  preload: true,
});

const bahnschrift = localFont({
  src: '../../public/fonts/bahnschrift.ttf',
  variable: '--font-bahnschrift',
  display: 'swap',
  preload: true,
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${thriftedAttire.variable} ${lesMysteres.variable} ${bahnschrift.variable}`}>
      <Component {...pageProps} />
    </div>
  );
}
```

### Using Fonts in SCSS

```scss
// File: styles/globals.scss
:root {
  --font-thrifted: var(--font-thrifted);
  --font-mysteres: var(--font-mysteres);
  --font-bahnschrift: var(--font-bahnschrift);
}

.documentContent {
  font-family: var(--font-thrifted), serif;

  h1, h2, h3 {
    font-family: var(--font-mysteres), serif;
  }

  .caption {
    font-family: var(--font-bahnschrift), sans-serif;
  }
}
```

**File di Riferimento**:
- `/apps/documents/src/pages/_app.tsx` (lines 24-54)

---

## Tree Navigation Components

**Regola**: Use recursive tree component for hierarchical document navigation.

### DocumentTreeNav Component

```typescript
interface TreeNode {
  _id: string;
  title: string;
  path: string;
  type: string;
  children?: TreeNode[];
}

interface DocumentTreeNavProps {
  nodes: TreeNode[];
  currentPath?: string;
}

export function DocumentTreeNav({ nodes, currentPath }: DocumentTreeNavProps) {
  return (
    <nav className={styles.treeNav}>
      <ul className={styles.treeList}>
        {nodes.map((node) => (
          <DocumentTreeNode
            key={node._id}
            node={node}
            currentPath={currentPath}
            level={0}
          />
        ))}
      </ul>
    </nav>
  );
}

interface DocumentTreeNodeProps {
  node: TreeNode;
  currentPath?: string;
  level: number;
}

function DocumentTreeNode({ node, currentPath, level }: DocumentTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(
    currentPath?.startsWith(node.path) || false
  );

  const isActive = currentPath === node.path;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li className={styles.treeItem} style={{ paddingLeft: `${level * 1.5}rem` }}>
      <div className={`${styles.treeItemContent} ${isActive ? styles.active : ''}`}>
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={styles.expandButton}
            aria-expanded={isExpanded}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        <Link href={`/${node.type}/${node.path}`} className={styles.treeItemLink}>
          {node.title}
        </Link>
      </div>

      {hasChildren && isExpanded && (
        <ul className={styles.treeList}>
          {node.children!.map((child) => (
            <DocumentTreeNode
              key={child._id}
              node={child}
              currentPath={currentPath}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
```

---

## Session ID from Query Param

**Regola**: Read `sessionId` from query param on cross-origin redirect. Save to `sessionStorage`.

**Perche**: When redirecting from game app (different origin), sessionStorage is NOT shared.

```typescript
// File: pages/_app.tsx
export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const { sessionId } = router.query;

    if (sessionId && typeof sessionId === 'string') {
      try {
        // Save sessionId from query param
        sessionStorage.setItem('character_session_id', sessionId);

        // Clean URL (remove query param)
        router.replace(router.pathname, undefined, { shallow: true });
      } catch (error) {
        console.error('[Documents App] Failed to save sessionId:', error);
      }
    }
  }, [router.query.sessionId]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <DocumentsLayout>
          <Component {...pageProps} />
        </DocumentsLayout>
      </AuthInitializer>
    </QueryClientProvider>
  );
}
```

**File di Riferimento**:
- `/apps/documents/src/pages/_app.tsx` (lines 78-91)

---

## Logging: nessun `@/lib/logger` in questa app

**Eccezione**: a differenza di game e management, documents NON ha un wrapper `@/lib/logger`. `console.*` è ammesso in questa app — preferire `console.error` nei soli error path SSR (`getServerSideProps`), evitare `console.log` di debug lasciato in codice committato.

---

## Cross-References

- **Shared Frontend**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/shared-frontend.md`
- **Management App**: `/Users/gennaropaglia/Documents/SitiPersonali/tenpennynovels/.claude/rules/apps/management-app.md`
- **Semantic Search Backend**: MEMORY.md (2026-02-23)
