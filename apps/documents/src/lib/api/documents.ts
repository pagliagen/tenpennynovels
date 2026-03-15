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
} from '@/types/document';

export const documentsApi = {
  /**
   * Get list of documents
   */
  async list(params?: DocumentListFilter): Promise<Document[]> {
    const response = (await api.get('/documents/routes/list', { params })) as any;
    return response.data || [];
  },

  /**
   * Get single document by type + path
   */
  async get(type: string, path: string, cookies?: string): Promise<DocumentDetail> {
    const config = cookies ? { headers: { Cookie: cookies } } : {};
    const response = (await api.get(`/documents/${type}/${path}`, config)) as any;

    const document: Document = {
      _id: response.data.document._id,
      path: response.data.route.path,
      title: response.data.document.title,
      type: response.data.route.type,
      kind: 'document',
      isPublic: response.data.route.isPublic,
      content: response.data.document.content || '',
    };

    const sections: DocumentSection[] = response.data.sections || [];

    return {
      document,
      sections,
      hasChildren: response.data.hasChildren ?? false,
      childDocuments: response.data.childDocuments ?? null,
    };
  },

  /**
   * Get document sections only
   */
  async getSections(documentId: string): Promise<DocumentSection[]> {
    const response = (await api.get(`/documents/${documentId}/sections`)) as any;
    return response.data.sections || response.data || [];
  },

  /**
   * List documents grouped by subtype within each type
   */
  async listHierarchical(): Promise<{
    ambientazione: DocumentSubtype[];
    regolamento: DocumentSubtype[];
  }> {
    const response = (await api.get('/documents/routes/list-hierarchical')) as any;
    return response.data.routes || { ambientazione: [], regolamento: [] };
  },
};
