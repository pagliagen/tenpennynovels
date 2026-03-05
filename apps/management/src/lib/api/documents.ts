/**
 * Document API
 *
 * Funzioni per interagire con gli endpoint /admin/documents del backend.
 * Tutte le chiamate usano il client axios con retry automatico.
 */

import { apiClient, withRetry } from './client';
import type {
  Document,
  DocumentListParams,
  DocumentListResponse,
  DocumentTreeResponse,
  CreateDocumentData,
  UpdateDocumentData,
  ApiResponse
} from '@/types/api/Document';

/**
 * Recupera albero documenti con metadata routes (DOCUMENTS-FIRST)
 * Endpoint: GET /admin/routes?type=ambientazione|regolamento
 * Returns: Document tree with route indicators
 */
export async function getDocuments(params: Partial<DocumentListParams>): Promise<DocumentTreeResponse> {
  const response = await withRetry(() =>
    apiClient.get<DocumentTreeResponse>('/admin/routes', { params })
  );
  return response.data;
}

/**
 * Recupera singolo document per ID
 */
export async function getDocumentById(id: string): Promise<Document> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<Document>>(`/admin/documents/${id}`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero documento');
  }

  return response.data.data;
}

/**
 * Fetch document with all children recursively (for hierarchical editing)
 */
export async function getDocumentWithChildren(id: string): Promise<{
  document: Document;
  children: Document[];
  childCount: number;
  exceededLimit: boolean;
}> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<any>>(`/admin/documents/${id}/with-children?depth=10`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Error fetching document hierarchy');
  }

  return response.data.data;
}

/**
 * Crea nuovo document
 */
export async function createDocument(data: CreateDocumentData): Promise<Document> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<Document>>('/admin/documents', data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione documento');
  }

  return response.data.data;
}

/**
 * Aggiorna document
 */
export async function updateDocument(id: string, data: UpdateDocumentData): Promise<Document> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<Document>>(`/admin/documents/${id}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento documento');
  }

  return response.data.data;
}

/**
 * Elimina document (soft delete)
 */
export async function deleteDocument(id: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/documents/${id}`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione documento');
  }
}

/**
 * Pubblica document
 */
export async function publishDocument(id: string): Promise<Document> {
  return updateDocument(id, {
    status: 'published'
  });
}

/**
 * Archivia document
 */
export async function archiveDocument(id: string): Promise<Document> {
  return updateDocument(id, {
    status: 'archived'
  });
}

/**
 * Toggle route enabled (hide/show)
 */
export async function toggleRouteEnabled(routeId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<void>>(`/admin/routes/${routeId}/toggle-enabled`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nel toggle route');
  }
}

/**
 * Delete route (soft delete)
 */
export async function deleteRoute(routeId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/routes/${routeId}`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione route');
  }
}

/**
 * Reorder document (change order/parentId in content hierarchy)
 */
export async function reorderDocument(documentId: string, order: number, parentId: string | null): Promise<void> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<void>>(`/admin/documents/reorder`, { id: documentId, order, parentId })
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nel riordinamento documento');
  }
}

/**
 * Reorder siblings (SIMPLE APPROACH)
 * Pass full ordered array of sibling IDs, backend assigns sequential order (1, 2, 3...)
 */
export async function reorderSiblings(parentId: string | null, orderedIds: string[]): Promise<void> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<void>>(`/admin/documents/reorder`, { parentId, orderedIds })
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nel riordinamento siblings');
  }
}

/**
 * Toggle document visibility (show/hide)
 */
export async function toggleDocumentVisibility(id: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<void>>(`/admin/documents/${id}/toggle-visibility`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nel toggle visibilità documento');
  }
}

/**
 * Toggle document draft status
 */
export async function toggleDocumentDraft(id: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<void>>(`/admin/documents/${id}/toggle-draft`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nel toggle draft documento');
  }
}

/**
 * Create new route
 */
export async function createRoute(data: {
  slug: string;  // CHANGED: backend now uses slug instead of path (auto-calculated)
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
  kind: 'document' | 'category' | 'redirect';
  // ❌ REMOVED: title, description, order - these come from Document!
  rootDocumentId?: string;
  documentData?: {
    title: string;
    slug: string;
    description?: string;
    isDraft?: boolean;
    visible?: boolean;
  };
  parentId?: string | null;  // ADDED: null support for top-level routes
  redirectTo?: string;
  isPublic?: boolean;
  enabled?: boolean;
}): Promise<any> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<any>>('/admin/routes', data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione route');
  }

  return response.data.data;
}

/**
 * Update existing route
 */
export async function updateRoute(routeId: string, data: {
  path?: string;
  // ❌ REMOVED: title, description - edit Document instead
  redirectTo?: string;
  isPublic?: boolean;
  enabled?: boolean;
  documentData?: {
    title?: string;
    slug?: string;
    description?: string;
    isDraft?: boolean;
    visible?: boolean;
  };
}): Promise<any> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<any>>(`/admin/routes/${routeId}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento route');
  }

  return response.data.data;
}
