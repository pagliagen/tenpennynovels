/**
 * CDN Upload API Client
 * Minimal implementation for game app
 */

import { apiClient } from './client';
import { logger } from '@/lib/logger';

export interface CDNUploadResponse {
  url: string;
  hash: string;
  size: number;
}

export const cdnApi = {
  /**
   * Upload image to CDN.
   *
   * "characters" ha una route dedicata lato game (POST /game/characters/:id/avatar,
   * auth owner/master) perché /admin/cdn/upload è dietro il gate admin: un
   * giocatore normale non ha i permessi da staff per usarlo direttamente.
   * Gli altri tipi (locations/items/occupations) restano contenuto gestito
   * solo dallo staff, quindi passano dalla route admin generica.
   */
  upload: async (
    file: File,
    type: 'locations' | 'items' | 'characters' | 'occupations',
    entityId: string,
    onProgress?: (progress: number) => void
  ): Promise<CDNUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const url = type === 'characters'
      ? `/game/characters/${entityId}/avatar`
      : '/admin/cdn/upload';

    if (type !== 'characters') {
      formData.append('type', type);
      formData.append('entityId', entityId);
    }

    const response = await apiClient.post<{ data: CDNUploadResponse }>(
      url,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        }
      }
    );

    return response.data.data;
  }
};

/**
 * Wrapper functions for ImageUploader compatibility (from management)
 */
export const uploadImage = async (
  file: File,
  type: 'locations' | 'items' | 'characters' | 'occupations',
  entityId: string,
  onProgress?: (progress: number) => void
): Promise<CDNUploadResponse> => {
  return cdnApi.upload(file, type, entityId, onProgress);
};

export const deleteImage = async (
  type: string,
  entityId: string,
  filename: string
): Promise<void> => {
  // Best-effort delete (not critical if fails)
  // CDN cleanup handled server-side
  logger.info('[CDN] Delete image:', { value: { type, entityId, filename } });
};
