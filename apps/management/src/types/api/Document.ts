/**
 * Document API Types
 *
 * Definisce interfacce per Document entity, DocumentSubtype entity e relative API responses.
 * Document e' unica fonte di verita' per contenuto e routing.
 */

import type { ApiResponse } from './common';

/**
 * DocumentSubtype Interface
 * Raggruppamento ordinabile di documenti per tipo
 */
export interface DocumentSubtype {
  _id: string;
  slug: string;
  title: string;
  type: 'ambientazione' | 'regolamento';
  order: number;
  expandedByDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Document Tree Node (content hierarchy)
 * Documents nest within each other (parent/child)
 */
export interface DocumentTreeNode {
  _id: string;
  slug: string;
  title: string;
  isDraft: boolean;
  visible: boolean;
  isPublic: boolean;
  tags?: string[];
  order: number;
  parentId: string | null;
  path?: string;
  /** Tipo route pubblica documenti (se noto dal backend). */
  type?: 'ambientazione' | 'regolamento';
  subtype: {
    _id: string;
    slug: string;
    title: string;
  } | null;
  children: DocumentTreeNode[];
}

/**
 * Full Document entity (for editing/details)
 */
export interface Document {
  _id: string;
  title: string;
  slug: string;
  content: string;
  contentDelta?: any;
  type: 'ambientazione' | 'regolamento';
  subtypeId?: string | DocumentSubtype;
  path?: string;
  isPublic?: boolean;
  tags: string[];
  order: number;
  parentId?: string | null;
  isDraft?: boolean;
  visible?: boolean;
  lastUpdated?: string;
  createdAt?: string;
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
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  type?: 'ambientazione' | 'regolamento';
}

/**
 * Document Tree Response
 * Backend returns documents grouped by subtype
 */
export interface DocumentTreeResponse {
  result: boolean;
  data: DocumentTreeNode[];
  totalItems: number;
  timestamp: string;
}

export interface CreateDocumentData {
  title: string;
  slug: string;
  type: 'ambientazione' | 'regolamento';
  subtypeId: string;
  parentId?: string | null;
  contentDelta?: any;
  isDraft?: boolean;
  visible?: boolean;
  isPublic?: boolean;
  tags?: string[];
  order?: number;
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  contentDelta?: any;
  lastUpdated?: string;
  type?: 'ambientazione' | 'regolamento';
  subtypeId?: string;
  isPublic?: boolean;
  tags?: string[];
  isDraft?: boolean;
  visible?: boolean;
}

export interface SeoDocument {
  _id: string;
  title: string;
  slug: string;
  type: 'ambientazione' | 'regolamento';
  path: string;
  description: string;
}
