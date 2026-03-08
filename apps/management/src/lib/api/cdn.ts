import { apiClient } from './client';

export interface CDNUploadResult {
  url: string;
  hash: string;
  size: number;
}

export interface CDNFileInfo {
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

export async function uploadImage(
  file: File,
  type: string,
  entityId: string,
  onProgress?: (percent: number) => void
): Promise<CDNUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  formData.append('entityId', entityId);

  const response = await apiClient.post<{ result: boolean; data: CDNUploadResult }>(
    '/admin/cdn/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    }
  );

  return response.data.data;
}

export async function deleteImage(
  type: string,
  entityId: string,
  filename: string
): Promise<void> {
  await apiClient.delete(`/admin/cdn/${type}/${entityId}/${filename}`);
}

export async function listImages(
  type: string,
  entityId: string
): Promise<CDNFileInfo[]> {
  const response = await apiClient.get<{ result: boolean; data: { files: CDNFileInfo[] } }>(
    `/admin/cdn/${type}/${entityId}`
  );
  return response.data.data.files;
}
