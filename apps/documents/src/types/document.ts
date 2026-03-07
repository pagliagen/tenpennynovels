/**
 * Document Types
 *
 * Type definitions for TenPennyNovels Documents (Ambientazione & Regolamento)
 *
 * @module types/document
 * @since 1.0.0
 */

/**
 * Document Type Enum
 * - ambientazione: Setting/Lore documents
 * - regolamento: Rules/Regulations documents
 */
export type DocumentType = 'ambientazione' | 'regolamento';

/**
 * Document Subtype
 *
 * Grouping category for documents within a type.
 * Used for sidebar navigation and ordering.
 */
export interface DocumentSubtype {
  _id: string;
  slug: string;
  title: string;
  type: DocumentType;
  order: number;
  documents: SubtypeDocument[];
}

/**
 * Lightweight document within a subtype (for sidebar/listing)
 */
export interface SubtypeDocument {
  _id: string;
  slug: string;
  title: string;
  path: string;
  isPublic: boolean;
  order: number;
}

/**
 * Document
 *
 * Full document with content and routing info.
 */
export interface Document {
  _id: string;
  path: string;
  title: string;
  content?: string;
  description?: string;
  type: DocumentType;
  kind: 'document';
  isPublic: boolean;
  tags?: string[];
  isDraft?: boolean;
  draftNotes?: string;
  displayCategory?: string;
}

/**
 * Document Section
 */
export interface DocumentSection {
  _id: string;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  order: number;
  depth?: number;
  isDocumentTitle?: boolean;
  isRootChunk?: boolean;
  parentDocumentId?: string;
}

/**
 * Hierarchical Child Document
 */
export interface HierarchicalChild {
  _id: string;
  slug: string;
  title: string;
  hasRoute: boolean;
  routePath?: string;
  depth: number;
  order: number;
  children: HierarchicalChild[];
}

/**
 * Document Group (for tree navigation grouping)
 */
export interface DocumentGroup {
  name: string;
  documents: Document[];
  isCollapsed: boolean;
}

/**
 * Document Detail (Full Document with Sections)
 */
export interface DocumentDetail {
  document: Document;
  sections: DocumentSection[];
  hasChildren?: boolean;
  childDocuments?: HierarchicalChild[];
}

/**
 * Semantic Search Result
 */
export interface SearchResult {
  section: {
    id: string;
    title: string;
    content: string;
    order: number;
  };
  document: {
    id: string;
    title: string;
    type: DocumentType;
    slug: string;
  };
  similarity: number;
  matchScore: string;
}

/**
 * Search Response
 */
export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
}

/**
 * Favorite Document
 */
export interface FavoriteDocument {
  id: string;
  title: string;
  type: DocumentType;
  slug: string;
  addedAt: Date;
}

/**
 * Document List Filter
 */
export interface DocumentListFilter {
  type?: DocumentType;
  isPublic?: boolean;
}

/**
 * Document Type Display Config
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
    color: '#d4af37',
    priority: 0.7,
  },
  regolamento: {
    key: 'regolamento',
    label: 'Regolamento',
    icon: '📜',
    color: '#800020',
    priority: 0.6,
  },
};

/**
 * Document Type Ordering
 */
export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'ambientazione',
  'regolamento'
];
