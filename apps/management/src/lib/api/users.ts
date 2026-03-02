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
  BanUserData,
  ApiResponse
} from '@/types/api/User';

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

  if (!response.data.success || !response.data.data) {
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

  if (!response.data.success || !response.data.data) {
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

  if (!response.data.success) {
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

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel ban utente');
  }

  return response.data.data;
}

/**
 * Unban utente
 */
export async function unbanUser(id: string): Promise<User> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<User>>(`/admin/users/${id}/unban`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'unban utente');
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
