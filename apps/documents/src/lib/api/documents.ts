/**
 * Documents API Service
 *
 * API client for document operations (list, detail, sections).
 * Handles both public and authenticated document access.
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
} from '@/types/document';

export const documentsApi = {
  /**
   * Get list of documents
   *
   * Backend automatically filters by auth status:
   * - Unauthenticated: returns only isPublic=true documents
   * - Authenticated: returns all documents (public + private)
   *
   * @param {DocumentListFilter} params - Optional filter parameters
   * @returns {Promise<Document[]>} List of documents
   */
  async list(params?: DocumentListFilter): Promise<Document[]> {
    const response = (await api.get('/documents/list', { params })) as any;
    return response.data || [];
  },

  /**
   * Get single document with all children OR category with sub-routes
   *
   * Backend checks permissions:
   * - Public documents: accessible to everyone
   * - Private documents: require authentication, return 404 if not authenticated
   *
   * @param {string} type - Document type (ambientazione | regolamento)
   * @param {string} path - Document path (from route)
   * @param {string} [cookies] - Optional cookies header for SSR authentication
   * @returns {Promise<DocumentDetail>} Document with children or category with sub-routes
   */
  async get(type: string, path: string, cookies?: string): Promise<DocumentDetail> {
    const config = cookies ? { headers: { Cookie: cookies } } : {};
    const response = (await api.get(`/documents/${type}/${path}`, config)) as any;

    // Merge route metadata into document for frontend compatibility
    const mergedDocument: Document = {
      _id: response.data.document._id,
      path: response.data.route.path,
      title: response.data.document.title,
      type: response.data.route.type,
      kind: response.data.route.kind,
      isPublic: response.data.route.isPublic,
      ...(response.data.document.description && { description: response.data.document.description }),
      ...(response.data.route.displayCategory && { displayCategory: response.data.route.displayCategory }),
    };

    // ========== CATEGORY HANDLING ==========
    // If this is a category route, return subRoutes directly (no sections)
    if (response.data.route.kind === 'category' && response.data.subRoutes) {
      return {
        document: mergedDocument,
        sections: [], // Categories have no sections
        subRoutes: response.data.subRoutes, // Pass through sub-routes
      };
    }

    // ========== DOCUMENT HANDLING (NEW ARCHITECTURE) ==========
    // Backend now returns pre-assembled sections with hierarchy
    // Sections are already HTML (from DocumentChunks), no markdown conversion needed
    const sections: DocumentSection[] = response.data.sections || [];

    // Build document.content from sections HTML (include titles as H2 with anchor IDs)
    const content = sections
      .map(section => `<h2 id="${section.slug}">${section.title}</h2>\n${section.content}`)
      .join('\n\n');

    return {
      document: {
        ...mergedDocument,
        content, // Concatenate all sections HTML
      },
      sections,
      // Ensure values are JSON-serializable (no undefined)
      hasChildren: response.data.hasChildren ?? false, // NEW: Hierarchy flag
      childDocuments: response.data.childDocuments ?? null, // NEW: TOC metadata
    };
  },

  /**
   * Get document sections only
   *
   * Fetches sections without document metadata.
   * Useful for pagination or lazy loading.
   *
   * @param {string} documentId - Document ID
   * @returns {Promise<DocumentSection[]>} Document sections
   */
  async getSections(documentId: string): Promise<DocumentSection[]> {
    const response = (await api.get(`/documents/${documentId}/sections`)) as any;
    return response.data.sections || response.data || [];
  },

  /**
   * List all routes hierarchically (grouped by type)
   *
   * Returns routes with full parent/child hierarchy for sidebar navigation.
   * Backend automatically filters by auth status.
   *
   * @returns {Promise<{ ambientazione: any[], approfondimenti: any[], regolamento: any[] }>}
   */
  async listHierarchical(): Promise<{
    ambientazione: any[];
    approfondimenti: any[];
    regolamento: any[];
  }> {
    const response = (await api.get('/documents/routes/list-hierarchical')) as any;
    return response.routes || { ambientazione: [], approfondimenti: [], regolamento: [] };
  },
};
