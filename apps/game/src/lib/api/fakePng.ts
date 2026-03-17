/**
 * Fake PNG API Client
 */

import { apiClient } from './client';
import type {
  FakePng,
  FakePngListResponse,
  CreateFakePngRequest,
  UpdateFakePngRequest
} from '@/types/fakePng';

const BASE_PATH = '/game/characters';

export const fakePngApi = {
  /**
   * List all fake PNGs for character
   */
  list: async (characterId: string): Promise<FakePngListResponse> => {
    const response = await apiClient.get<{ data: FakePngListResponse }>(
      `${BASE_PATH}/${characterId}/fake-pngs`
    );
    return response.data.data;
  },

  /**
   * Create fake PNG
   */
  create: async (
    characterId: string,
    data: CreateFakePngRequest
  ): Promise<FakePng> => {
    const response = await apiClient.post<{ data: FakePng }>(
      `${BASE_PATH}/${characterId}/fake-pngs`,
      data
    );
    return response.data.data;
  },

  /**
   * Update fake PNG
   */
  update: async (
    characterId: string,
    fakeId: string,
    data: UpdateFakePngRequest
  ): Promise<FakePng> => {
    const response = await apiClient.patch<{ data: FakePng }>(
      `${BASE_PATH}/${characterId}/fake-pngs/${fakeId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete fake PNG
   */
  delete: async (characterId: string, fakeId: string): Promise<void> => {
    await apiClient.delete(
      `${BASE_PATH}/${characterId}/fake-pngs/${fakeId}`
    );
  },

  /**
   * Activate fake PNG
   */
  activate: async (characterId: string, fakeId: string): Promise<void> => {
    await apiClient.post(
      `${BASE_PATH}/${characterId}/fake-pngs/${fakeId}/activate`
    );
  },

  /**
   * Deactivate fake PNG (return to real identity)
   */
  deactivate: async (characterId: string): Promise<void> => {
    await apiClient.post(
      `${BASE_PATH}/${characterId}/fake-pngs/deactivate`
    );
  },
};
