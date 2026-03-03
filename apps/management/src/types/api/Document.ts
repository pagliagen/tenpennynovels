/**
 * Document API Types
 *
 * Definisce interfacce per Document entity, Route entity e relative API responses.
 * NEW ARCHITECTURE: Route (routing layer) + Document (content layer)
 */

/**
 * Route Interface (NEW ARCHITECTURE - hierarchical)
 * Routes define navigation structure (URL paths) with parent/child relationships
 */
export interface Route {
  _id: string;
  parentId: string | null;          // Parent route ID (null = root level)
  slug: string;                     // URL segment ("armi", "folklore")
  path: string;                     // Full calculated path ("folklore", "approfondimenti/armi")
  // ❌ REMOVED: order, title, description, displayCategory (use Document fields via backend join)
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
  kind: 'document' | 'category' | 'redirect';
  enabled: boolean;
  isPublic: boolean;
  rootDocument: DocumentTreeNode | null;  // Root document with nested children
  children?: Route[];               // Nested child routes (navigation hierarchy)
  metadata?: {
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * Document Tree Node (content hierarchy within a route)
 * Documents nest within each other (parent/child) independently from routes
 */
export interface DocumentTreeNode {
  _id: string;
  slug: string;
  title: string;
  isDraft: boolean;
  visible: boolean;                 // If false, document is hidden
  tags?: string[];
  order: number;
  parentId: string | null;
  children: DocumentTreeNode[];     // Nested child documents
}

/**
 * Document With Route (DOCUMENTS-FIRST ARCHITECTURE)
 * Document hierarchy with route metadata attached
 */
export interface DocumentWithRoute {
  _id: string;
  slug: string;
  title: string;
  isDraft: boolean;
  visible: boolean;
  tags: string[];
  order: number;
  parentId: string | null;
  route: {                          // ← Route metadata (null if no route linked)
    _id: string;
    path: string;
    slug: string;
    title: string;
    type: 'ambientazione' | 'approfondimenti' | 'regolamento';
    kind: 'document' | 'category' | 'redirect';
    enabled: boolean;
    isPublic: boolean;
  } | null;
  children: DocumentWithRoute[];    // Recursive children
}

/**
 * Full Document entity (for editing/details)
 */
export interface Document {
  _id: string;
  title: string;
  slug: string;
  description?: string;            // Document description (for search, metadata)
  content: string;
  contentDelta?: any;              // TipTap JSON Delta (WYSIWYG editor format)
  excerpt?: string;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento' | 'guida' | 'news' | 'announcement';
  category?: string;
  tags: string[];
  order: number;                   // Order for sorting siblings
  parentId?: string | null;        // Parent document ID (null if root)
  status: 'draft' | 'published' | 'archived';
  visibility: {
    isPublic: boolean;
    restrictedTo: string[];
    requiredRole?: string;
  };
  author: {
    _id: string;
    username: string;
    displayName: string;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    lastEditedBy?: string;
    version: number;
  };
  stats: {
    views: number;
    likes: number;
    comments: number;
  };
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords: string[];
  };
  attachments: DocumentAttachment[];
  relatedDocuments: string[];
}

export interface DocumentAttachment {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface DocumentListParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  type?: 'ambientazione' | 'approfondimenti' | 'regolamento' | 'guida' | 'news' | 'announcement';
  status?: 'draft' | 'published' | 'archived';
  authorId?: string;
  category?: string;
}

export interface DocumentListResponse {
  items: Document[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Document Tree Response (DOCUMENTS-FIRST - NEW)
 * Backend returns documents with route metadata
 */
export interface DocumentTreeResponse {
  result: boolean;
  success: boolean;
  data: DocumentWithRoute[];        // ← Changed from 'list: Route[]' to 'data: DocumentWithRoute[]'
  totalItems: number;
  timestamp: string;
}

/**
 * Route List Response (DEPRECATED - kept for backward compatibility)
 * @deprecated Use DocumentTreeResponse instead
 */
export interface RouteListResponse {
  result: boolean;
  success: boolean;
  list: Route[];
  totalItems: number;
  timestamp: string;
}

export interface CreateDocumentData {
  title: string;
  slug: string;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';  // Required for semantic search
  description?: string;
  parentId?: string | null;
  contentDelta?: any;  // TipTap JSON format
  isDraft?: boolean;
  visible?: boolean;
  tags?: string[];
  order?: number;
}

export interface UpdateDocumentData {
  title?: string;
  description?: string;           // Document description (for search, metadata)
  content?: string;
  contentDelta?: any;             // TipTap JSON Delta (WYSIWYG editor format)
  excerpt?: string;
  lastUpdated?: string;           // For optimistic locking
  type?: 'ambientazione' | 'approfondimenti' | 'regolamento' | 'guida' | 'news' | 'announcement';
  category?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
  visibility?: {
    isPublic?: boolean;
    restrictedTo?: string[];
    requiredRole?: string;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
}

export interface ApiResponse<T> {
  result?: boolean;               // Backend compatibility (some endpoints use result)
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
