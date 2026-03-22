/**
 * Documents API Service
 *
 * API client for document operations (list, detail, sections).
 *
 * @module lib/api/documents
 * @since 1.0.0
 */

import { api } from './client';
import type {
  Document,
  DocumentSection,
  DocumentDetail,
  DocumentListFilter,
  DocumentSubtype,
  DocumentType,
} from '@/types/document';

/** Corpo risposta lista documenti (axios `data` già estratto dal client). */
interface DocumentsListBody {
  data?: Document[];
}

interface DocumentGetBody {
  data: {
    document: {
      _id: string;
      title: string;
      content?: string;
    };
    route: {
      path: string;
      type: DocumentType;
      isPublic: boolean;
    };
    sections?: DocumentSection[];
    hasChildren?: boolean;
    childDocuments?: DocumentDetail['childDocuments'];
  };
}

interface SectionsBody {
  data?: { sections?: DocumentSection[] } | DocumentSection[];
  sections?: DocumentSection[];
}

interface HierarchicalBody {
  data?: {
    routes?: {
      ambientazione: DocumentSubtype[];
      regolamento: DocumentSubtype[];
    };
  };
}

export const documentsApi = {
  /**
   * Get list of documents
   */
  async list(params?: DocumentListFilter): Promise<Document[]> {
    const body = await api.get<DocumentsListBody>('/documents/routes/list', { params });
    return body.data ?? [];
  },

  /**
   * Get single document by type + path
   */
  async get(type: string, path: string, cookies?: string): Promise<DocumentDetail> {
    const config = cookies ? { headers: { Cookie: cookies } } : {};
    const { data: payload } = await api.get<DocumentGetBody>(`/documents/${type}/${path}`, config);

    const document: Document = {
      _id: payload.document._id,
      path: payload.route.path,
      title: payload.document.title,
      type: payload.route.type,
      kind: 'document',
      isPublic: payload.route.isPublic,
      content: payload.document.content || '',
    };

    const sections: DocumentSection[] = payload.sections || [];

    return {
      document,
      sections,
      hasChildren: payload.hasChildren ?? false,
      ...(payload.childDocuments != null ? { childDocuments: payload.childDocuments } : {}),
    };
  },

  /**
   * Get document sections only
   */
  async getSections(documentId: string): Promise<DocumentSection[]> {
    const body = await api.get<SectionsBody>(`/documents/${documentId}/sections`);
    const nested = body.data;
    if (Array.isArray(nested)) return nested;
    if (nested && typeof nested === 'object' && 'sections' in nested) {
      return nested.sections ?? [];
    }
    return body.sections ?? [];
  },

  /**
   * List documents grouped by subtype within each type
   */
  async listHierarchical(): Promise<{
    ambientazione: DocumentSubtype[];
    regolamento: DocumentSubtype[];
  }> {
    const body = await api.get<HierarchicalBody>('/documents/routes/list-hierarchical');
    return body.data?.routes ?? { ambientazione: [], regolamento: [] };
  },
};
