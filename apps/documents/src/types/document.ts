/**
 * Document Types
 *
 * Type definitions for TenpennyNovels Documents (Ambientazione & Regolamento)
 *
 * @module types/document
 * @since 1.0.0
 */

/**
 * Document Type Enum
 * - ambientazione: Setting/Lore documents
 * - approfondimenti: Deep-dive guides on specific topics
 * - regolamento: Rules/Regulations documents
 */
export type DocumentType = 'ambientazione' | 'approfondimenti' | 'regolamento';

/**
 * Document (Route Item)
 *
 * Lightweight route metadata for list views (NEW DUAL-TABLE).
 * Represents a Route that links to a Document.
 */
export interface Document {
  _id: string;
  path: string;              // Route path (e.g., "folklore", "approfondimenti/medicina")
  title: string;
  content?: string;          // HTML output (auto-generated with H1 anchor IDs) - populated in detail view
  description?: string;
  type: DocumentType;
  kind: 'document' | 'category';
  displayCategory?: string;  // Display grouping (e.g., "Introduzione", "Londra 1890")
  isPublic: boolean;
  tags?: string[];           // Tags for search/filtering
  isDraft?: boolean;         // Draft status
  draftNotes?: string;       // Draft notes
}

/**
 * Document Section
 *
 * Individual section of a document with HTML content.
 * Documents are split into sections for better organization and loading.
 */
export interface DocumentSection {
  _id: string;
  documentId: string;
  title: string;
  slug: string;
  content: string; // HTML content (sanitized on backend)
  order: number;
  depth?: number;  // NEW: Hierarchy depth (0=root, 1=child, 2=grandchild...)
  isDocumentTitle?: boolean;  // NEW: True if section is a document title
  isRootChunk?: boolean;  // NEW: True if section is from root document
  parentDocumentId?: string;  // NEW: Parent document ID if child
}

/**
 * Sub-Route (Category Child)
 *
 * Metadata for a sub-route under a category.
 * Used when displaying category pages.
 */
export interface SubRoute {
  path: string;
  title: string;
  description?: string;
  isPublic: boolean;
}

/**
 * Hierarchical Child Document
 * Used for building hierarchical TOC with mixed link types
 */
export interface HierarchicalChild {
  _id: string;
  slug: string;
  title: string;
  hasRoute: boolean;
  routePath?: string;  // Full path if hasRoute (e.g., "/ambientazione/approfondimenti/armi")
  depth: number;
  order: number;
  children: HierarchicalChild[];
}

/**
 * Document Detail (Full Document with Sections)
 *
 * Complete document view including all sections.
 * Used for detail pages.
 *
 * For category pages: sections=[] and subRoutes contains child routes.
 * For document pages: sections contains content and subRoutes is undefined.
 */
export interface DocumentDetail {
  document: Document;
  sections: DocumentSection[];
  subRoutes?: SubRoute[]; // Only populated for category pages
  hasChildren?: boolean;  // NEW: True if document has child documents
  childDocuments?: HierarchicalChild[];  // NEW: Hierarchical child documents for TOC
}

/**
 * Semantic Search Result
 *
 * Result from Qdrant vector similarity search.
 * Includes matched section with highlight excerpt and relevance score.
 */
export interface SearchResult {
  section: {
    id: string;
    title: string;
    content: string; // Preview excerpt (highlighted)
    order: number;
  };
  document: {
    id: string;
    title: string;
    type: DocumentType;
    slug: string;
  };
  similarity: number; // 0.0 - 1.0 similarity score
  matchScore: string; // Human-readable score (e.g., "85%")
}

/**
 * Search Response
 *
 * Complete response from semantic search endpoint.
 */
export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
}

/**
 * Favorite Document
 *
 * User's favorited document.
 * Requires authentication.
 */
export interface FavoriteDocument {
  id: string;
  title: string;
  type: DocumentType;
  slug: string;
  addedAt: Date;
}

/**
 * Document Group
 *
 * Grouping for document tree navigation.
 * Groups documents by `document.group` field.
 */
export interface DocumentGroup {
  name: string;
  documents: Document[];
  isCollapsed?: boolean; // UI state for collapsible groups
}

/**
 * Document List Filter
 *
 * Query parameters for filtering document lists.
 */
export interface DocumentListFilter {
  type?: DocumentType;
  group?: string;
  isPublic?: boolean;
}

/**
 * Document Type Display Config
 *
 * UI configuration for document types.
 */
export interface DocumentTypeConfig {
  key: DocumentType;
  label: string;
  icon: string;
  color: string;
  priority: number;
}

/**
 * Document type configurations
 */
export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  ambientazione: {
    key: 'ambientazione',
    label: 'Ambientazione',
    icon: '🌍',
    color: '#d4af37', // Victorian gold
    priority: 0.7,
  },
  approfondimenti: {
    key: 'approfondimenti',
    label: 'Approfondimenti',
    icon: '📚',
    color: '#4169E1', // Royal blue
    priority: 0.65,
  },
  regolamento: {
    key: 'regolamento',
    label: 'Regolamento',
    icon: '📜',
    color: '#800020', // Victorian burgundy
    priority: 0.6,
  },
};

/**
 * Document Type Ordering
 * Defines the display order for document types in navigation
 */
export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'ambientazione',
  'approfondimenti',
  'regolamento'
];
