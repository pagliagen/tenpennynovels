/**
 * Document Types
 *
 * Type definitions for TenPennyNovels Documents
 *
 * @module types/document
 * @since 1.0.0
 */

/**
 * Document Type Enum
 * - ambientazione: Setting/Lore documents
 * - regolamento: Rules/Regulations documents
 * - manuale-master: riservato ai master, vedi RESTRICTED_DOCUMENT_TYPES
 */
export const PUBLIC_DOCUMENT_TYPES = ['ambientazione', 'regolamento'] as const;

/**
 * Tipi visibili solo a chi ha game:documents:master-manual:read.
 *
 * Il backend è l'autorità: filtra già liste, dettaglio e ricerca. Qui il
 * flag serve solo a non mostrare una tab che darebbe 403.
 */
export const RESTRICTED_DOCUMENT_TYPES = ['manuale-master'] as const;

export const DOCUMENT_TYPES = [
  ...PUBLIC_DOCUMENT_TYPES,
  ...RESTRICTED_DOCUMENT_TYPES,
] as const;

export type PublicDocumentType = (typeof PUBLIC_DOCUMENT_TYPES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function isRestrictedDocumentType(value: unknown): value is (typeof RESTRICTED_DOCUMENT_TYPES)[number] {
  return typeof value === 'string' && (RESTRICTED_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function isPublicDocumentType(value: unknown): value is PublicDocumentType {
  return typeof value === 'string' && (PUBLIC_DOCUMENT_TYPES as readonly string[]).includes(value);
}

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
  expandedByDefault: boolean;
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
  children?: SubtypeDocument[];
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
  description?: string;
  content?: string;
  type: DocumentType;
  kind: 'document';
  isPublic: boolean;
  tags?: string[];
  isDraft?: boolean;
  draftNotes?: string;
  displayCategory?: string;
  createdAt?: Date | string;
  lastUpdated?: Date | string;
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
  hasOwnPage: boolean;
  path?: string;
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
 * Favorite Document (from backend aggregation)
 */
export interface FavoriteDocument {
  _id: string;
  documentId: string;
  title: string;
  type: DocumentType;
  path: string;
  addedAt: string;
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
    icon: '',
    color: '#091918',
    priority: 0.7,
  },
  regolamento: {
    key: 'regolamento',
    label: 'Regolamento',
    icon: '',
    color: '#c1272d',
    priority: 0.6,
  },
  'manuale-master': {
    key: 'manuale-master',
    label: 'Manuale Master',
    icon: '',
    color: '#6b4a86',
    priority: 0,
  },
};

/**
 * Document Type Ordering
 */
/**
 * Icone per tipo, usate in ricerca e breadcrumb.
 * Separate da DOCUMENT_TYPE_CONFIGS.icon, che è vuoto per tutti i tipi e
 * riservato alla grafica delle tab.
 */
export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  ambientazione: '🌍',
  regolamento: '📜',
  'manuale-master': '🎭',
};

export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'ambientazione',
  'regolamento',
  'manuale-master'
];
