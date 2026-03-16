/**
 * User API
 *
 * Funzioni per interagire con gli endpoint /admin/users del backend.
 * Tutte le chiamate usano il client axios con retry automatico.
 */

import { apiClient, withRetry } from './client';
import type {
  User,
  UserListParams,
  UserListResponse,
  UpdateUserData,
  BanUserData
} from '@/types/api/User';
import type { ApiResponse } from '@/types/api/common';

/**
 * Recupera lista utenti paginata
 */
export async function getUsers(params: UserListParams): Promise<UserListResponse> {
  const response = await withRetry(() =>
    apiClient.get<UserListResponse>('/admin/users', { params })
  );
  return response.data;
}

/**
 * Recupera singolo utente per ID
 */
export async function getUserById(id: string): Promise<User> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<User>>(`/admin/users/${id}`)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero utente');
  }

  return response.data.data;
}

/**
 * Aggiorna utente
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<User> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<User>>(`/admin/users/${id}`, data)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento utente');
  }

  return response.data.data;
}

/**
 * Elimina utente (soft delete)
 */
export async function deleteUser(id: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/users/${id}`)
  );

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione utente');
  }
}

/**
 * Ban utente
 */
export async function banUser(id: string, banData: BanUserData): Promise<User> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<User>>(`/admin/users/${id}/ban`, banData)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel ban utente');
  }

  return response.data.data;
}

/**
 * Unban utente
 */
export async function unbanUser(id: string): Promise<User> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<User>>(`/admin/users/${id}/ban`)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'unban utente');
  }

  return response.data.data;
}

/**
 * Bulk ban utenti
 */
export async function bulkBanUsers(
  params: {
    userIds: string[];
    reason?: string;
    duration?: string;
    bannedUntil?: string;
  }
): Promise<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }>>(
      '/admin/users/bulk-ban',
      params
    )
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel ban multiplo utenti');
  }

  return response.data.data;
}

/**
 * Bulk unban utenti
 */
export async function bulkUnbanUsers(
  userIds: string[]
): Promise<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }>>(
      '/admin/users/bulk-unban',
      { userIds }
    )
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'unban multiplo utenti');
  }

  return response.data.data;
}

/**
 * Bulk activate utenti
 */
export async function bulkActivateUsers(
  userIds: string[]
): Promise<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }>>(
      '/admin/users/bulk-activate',
      { userIds }
    )
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'attivazione multipla utenti');
  }

  return response.data.data;
}

/**
 * Bulk deactivate utenti
 */
export async function bulkDeactivateUsers(
  userIds: string[]
): Promise<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ success: number; failed: number; results: Array<{ userId: string; success: boolean; error?: string }> }>>(
      '/admin/users/bulk-deactivate',
      { userIds }
    )
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella disattivazione multipla utenti');
  }

  return response.data.data;
}

/**
 * Attiva/disattiva utente
 */
export async function toggleUserStatus(id: string, isActive: boolean): Promise<User> {
  return updateUser(id, {
    accountStatus: { isActive }
  });
}

/**
 * Verifica email utente
 */
export async function verifyUserEmail(id: string): Promise<User> {
  return updateUser(id, {
    accountStatus: { isEmailVerified: true }
  });
}

/**
 * Assign PNG character to user
 */
export async function assignPNG(userId: string, data: {
  name: string;
  surname?: string;
  avatarUrl?: string;
  description?: string
}): Promise<any> {
  const response = await withRetry(() =>
    apiClient.post(`/admin/users/${userId}/assign-png`, data)
  );
  return response.data;
}

/**
 * Assign Master character to user
 */
export async function assignMaster(userId: string, data: {
  name: string;
  surname?: string;
  avatarUrl?: string
}): Promise<any> {
  const response = await withRetry(() =>
    apiClient.post(`/admin/users/${userId}/assign-master`, data)
  );
  return response.data;
}
