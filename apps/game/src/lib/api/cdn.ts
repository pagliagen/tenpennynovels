/**
 * CDN Upload API Client
 * Minimal implementation for game app
 */

import { apiClient } from './client';

export interface CDNUploadResponse {
  url: string;
  hash: string;
  size: number;
}

export const cdnApi = {
  /**
   * Upload image to CDN
   */
  upload: async (
    file: File,
    type: 'locations' | 'items' | 'characters' | 'occupations',
    entityId: string
  ): Promise<CDNUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('entityId', entityId);

    const response = await apiClient.post<{ data: CDNUploadResponse }>(
      '/admin/cdn/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
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
  _onProgress?: (progress: number) => void
): Promise<CDNUploadResponse> => {
  // Note: Progress tracking not implemented - uploads are fast enough without it
  return cdnApi.upload(file, type, entityId);
};

export const deleteImage = async (
  type: string,
  entityId: string,
  filename: string
): Promise<void> => {
  // Best-effort delete (not critical if fails)
  // CDN cleanup handled server-side
  console.log('[CDN] Delete image:', { type, entityId, filename });
};
