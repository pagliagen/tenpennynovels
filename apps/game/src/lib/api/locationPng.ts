/**
 * Location PNG API Client
 */

import type {
  LocationPng,
  LocationPngListResponse,
  CreateLocationPngRequest
} from '@/types/locationPng';

import { apiClient } from './client';

const BASE_PATH = '/game/locations';

export const locationPngApi = {
  /**
   * List location-scoped PNG personas (master or location owner only)
   */
  list: async (locationId: string): Promise<LocationPngListResponse> => {
    const response = await apiClient.get<{ data: LocationPngListResponse }>(
      `${BASE_PATH}/${locationId}/pngs`
    );
    return response.data.data;
  },

  /**
   * Create a location-scoped PNG persona
   */
  create: async (
    locationId: string,
    data: CreateLocationPngRequest
  ): Promise<LocationPng> => {
    const response = await apiClient.post<{ data: LocationPng }>(
      `${BASE_PATH}/${locationId}/pngs`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a location-scoped PNG persona
   */
  delete: async (locationId: string, pngId: string): Promise<void> => {
    await apiClient.delete(`${BASE_PATH}/${locationId}/pngs/${pngId}`);
  },
};
