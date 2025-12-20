// Document System API Library
import { AuthContext } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

// Types and Interfaces
export type DocumentType = 'ambientazione' | 'regolamento' | 'approfondimenti';

export interface DocumentSection {
  id: string;
  documentId: string;
  version: number;
  type: DocumentType;
  title: string;
  slug: string;
  content: string;
  order: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: Date | string;
  createdBy: {
    userId: string;
    username: string;
  };
  updatedAt?: Date | string;
  updatedBy?: {
    userId: string;
    username: string;
  };
}

export interface Document {
  id: string;
  slug: string;
  title: string;
  description?: string;
  type: DocumentType;
  group?: string;
  isPublic: boolean;
  version: number;
  activeVersion: number;
  totalSections: number;
  lastUpdated: Date | string;
  createdAt: Date | string;
  createdBy: {
    userId: string;
    username: string;
  };
}

export interface DocumentContent {
  document: Document;
  sections: DocumentSection[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface SearchResult {
  id: string;
  title: string;
  type: DocumentType;
  slug: string;
  excerpt: string;
  description: string;
  score: number;
  totalSections: number;
  matchingSections: number;
  lastUpdated: Date | string;
  isPublic: boolean;
}

// Auth headers helper - for httpOnly cookies we rely on credentials: 'include'
function getAuthHeaders(): HeadersInit {
  return {};
}

// Generic API request helper
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/documents${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

// PUBLIC API - Document listing and reading

export async function getDocuments(type?: DocumentType): Promise<Document[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  
  const endpoint = params.toString() ? `/list?${params}` : '/list';
  const response = await apiRequest<{ success: boolean; data: Document[] }>(endpoint);
  return response.data;
}

export async function getDocument(type: DocumentType, slug: string): Promise<DocumentContent> {
  const response = await apiRequest<{ success: boolean; data: DocumentContent }>(`/${type}/${slug}`);
  return response.data;
}

export async function searchDocuments(
  query: string, 
  type?: DocumentType, 
  page: number = 1, 
  limit: number = 20
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (type) params.set('type', type);
  
  const response = await apiRequest<{ success: boolean; data: SearchResult[] }>(`/search?${params}`);
  return response.data;
}

// ADMIN API - Document management (requires admin permissions)

export interface CreateDocumentRequest {
  title: string;
  type: DocumentType;
  isPublic: boolean;
  sections: {
    content: string;
    order: number;
  }[];
}

export interface UpdateDocumentRequest {
  title?: string;
  isPublic?: boolean;
  sections?: {
    id?: string; // existing section ID for updates
    content: string;
    order: number;
    delete?: boolean; // mark for deletion
  }[];
}

export async function createDocument(data: CreateDocumentRequest): Promise<Document> {
  const response = await apiRequest<{ success: boolean; data: Document }>('/admin/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function updateDocument(
  documentId: string, 
  data: UpdateDocumentRequest
): Promise<DocumentContent> {
  const response = await apiRequest<{ success: boolean; data: DocumentContent }>(
    `/admin/documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

export async function publishDocumentVersion(
  documentId: string, 
  version: number
): Promise<void> {
  await apiRequest<{ success: boolean }>(`/admin/documents/${documentId}/versions/${version}/publish`, {
    method: 'POST',
  });
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/admin/documents/${documentId}`, {
    method: 'DELETE',
  });
}

// Get document versions (admin only)
export async function getDocumentVersions(documentId: string): Promise<{
  versions: { version: number; createdAt: Date | string; isActive: boolean; sectionCount: number }[];
}> {
  const response = await apiRequest<{ success: boolean; data: any }>(`/admin/documents/${documentId}/versions`);
  return response.data;
}

export async function getDocumentVersion(
  documentId: string, 
  version: number
): Promise<DocumentContent> {
  const response = await apiRequest<{ success: boolean; data: DocumentContent }>(
    `/admin/documents/${documentId}/versions/${version}`
  );
  return response.data;
}

// FAVORITES API - User favorites management (requires authentication)

export interface FavoriteDocument {
  id: string;
  title: string;
  type: DocumentType;
  slug: string;
  group: string;
  addedAt: Date | string;
  excerpt?: string;
}

export async function getFavoriteDocuments(): Promise<FavoriteDocument[]> {
  const response = await apiRequest<{ success: boolean; data: FavoriteDocument[] }>('/favorites');
  return response.data;
}

export async function addDocumentToFavorites(type: DocumentType, slug: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/${type}/${slug}/favorite`, {
    method: 'POST',
  });
}

export async function removeDocumentFromFavorites(type: DocumentType, slug: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/${type}/${slug}/favorite`, {
    method: 'DELETE',
  });
}

export async function isDocumentFavorited(type: DocumentType, slug: string): Promise<boolean> {
  const response = await apiRequest<{ success: boolean; data: { isFavorited: boolean } }>(`/${type}/${slug}/favorite`);
  return response.data.isFavorited;
}