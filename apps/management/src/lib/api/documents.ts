/**
 * Document API
 *
 * Funzioni per interagire con gli endpoint /admin/documents del backend.
 */

import { apiClient, withRetry } from './client';
import type {
  Document,
  DocumentListParams,
  DocumentTreeResponse,
  CreateDocumentData,
  UpdateDocumentData,
  DocumentSubtype
} from '@/types/api/Document';
import type { ApiResponse } from '@/types/api/common';

/**
 * Recupera albero documenti raggruppati per subtype
 * Endpoint: GET /admin/documents?type=ambientazione|regolamento
 */
export async function getDocuments(params: Partial<DocumentListParams>): Promise<DocumentTreeResponse> {
  const response = await withRetry(() =>
    apiClient.get<DocumentTreeResponse>('/admin/documents', { params })
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

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero documento');
  }

  return response.data.data;
}

/**
 * Fetch document with all children recursively
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

  if (!response.data.result || !response.data.data) {
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

  if (!response.data.result || !response.data.data) {
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

  if (!response.data.result || !response.data.data) {
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

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione documento');
  }
}

/**
 * Reorder siblings
 */
export async function reorderSiblings(parentId: string | null, orderedIds: string[]): Promise<void> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<void>>(`/admin/documents/reorder`, { parentId, orderedIds })
  );

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nel riordinamento siblings');
  }
}

/**
 * Reorder single document (update order and optionally parentId)
 */
export async function reorderDocument(documentId: string, order: number, parentId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<void>>(`/admin/documents/${documentId}`, { order, parentId })
  );

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nel riordinamento documento');
  }
}

/**
 * Toggle document visibility
 */
export async function toggleDocumentVisibility(id: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<void>>(`/admin/documents/${id}/toggle-visibility`)
  );

  if (!response.data.result) {
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

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nel toggle draft documento');
  }
}

// ========== SUBTYPES API ==========

/**
 * Get subtypes (filterable by type)
 */
export async function getSubtypes(type?: string): Promise<DocumentSubtype[]> {
  const params = type ? { type } : {};
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<DocumentSubtype[]>>('/admin/subtypes', { params })
  );

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nel recupero subtypes');
  }

  return response.data.data || [];
}

/**
 * Create subtype
 */
export async function createSubtype(data: { slug: string; title: string; type: string }): Promise<DocumentSubtype> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<DocumentSubtype>>('/admin/subtypes', data)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione subtype');
  }

  return response.data.data;
}

/**
 * Update subtype
 */
export async function updateSubtype(id: string, data: { slug?: string; title?: string; expandedByDefault?: boolean }): Promise<DocumentSubtype> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<DocumentSubtype>>(`/admin/subtypes/${id}`, data)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento subtype');
  }

  return response.data.data;
}

/**
 * Delete subtype
 */
export async function deleteSubtype(id: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/subtypes/${id}`)
  );

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione subtype');
  }
}

/**
 * Reorder subtypes
 */
export async function reorderSubtypes(type: string, orderedIds: string[]): Promise<void> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<void>>('/admin/subtypes/reorder', { type, orderedIds })
  );

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nel riordinamento subtypes');
  }
}
