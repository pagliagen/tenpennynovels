/**
 * Favorites API Service
 *
 * API client for user favorites operations.
 * All endpoints require authentication.
 *
 * @module lib/api/favorites
 * @since 1.0.0
 */

import { api } from './client';
import type { FavoriteDocument } from '@/types/document';

export const favoritesApi = {
  /**
   * Get user's favorite documents
   *
   * Requires authentication. Returns 401 if not authenticated.
   *
   * @returns {Promise<FavoriteDocument[]>} List of favorited documents
   */
  async list(): Promise<FavoriteDocument[]> {
    const response = (await api.get('/documents/favorites')) as any;
    return response.data.favorites || response.data || [];
  },

  /**
   * Add document to favorites
   *
   * Requires authentication. Idempotent (no error if already favorited).
   *
   * @param {string} documentId - Document ID to favorite
   * @returns {Promise<void>}
   */
  async add(documentId: string): Promise<void> {
    await api.post('/documents/favorites', { documentId });
  },

  /**
   * Remove document from favorites
   *
   * Requires authentication. Idempotent (no error if not favorited).
   *
   * @param {string} documentId - Document ID to unfavorite
   * @returns {Promise<void>}
   */
  async remove(documentId: string): Promise<void> {
    await api.delete(`/documents/favorites/${documentId}`);
  },

  /**
   * Check if document is favorited
   *
   * Requires authentication. Returns false if not authenticated.
   *
   * @param {string} documentId - Document ID to check
   * @returns {Promise<boolean>} True if favorited
   */
  async isFavorited(documentId: string): Promise<boolean> {
    try {
      const response = (await api.get(`/documents/favorites/${documentId}/status`)) as any;
      return response.data?.isFavorited || false;
    } catch (error) {
      // If endpoint doesn't exist or auth fails, return false
      return false;
    }
  },
};
