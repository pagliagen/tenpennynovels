/**
 * Characters API Client
 *
 * Endpoints for character discovery and directory
 */

import { apiClient } from './client';

export interface CharacterListItem {
  _id: string;
  name: string;
  surname?: string;
  avatar?: string;
  playerStatus: 'draft' | 'pending' | 'approved' | 'rejected';
}

export interface CharacterDirectoryResponse {
  success: boolean;
  data: {
    characters: CharacterListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export const charactersApi = {
  /**
   * Get character directory (approved characters only)
   * Supports pagination and search for autocomplete
   *
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 25)
   * @param search - Search query (name/surname)
   */
  async getDirectory(
    page = 1,
    limit = 25,
    search?: string
  ): Promise<CharacterDirectoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    const response = await apiClient.get<CharacterDirectoryResponse>(
      `/game/characters/directory?${params}`
    );

    return response.data;
  },

  /**
   * Get public characters list (max 200, for initial load)
   */
  async getPublicList(): Promise<CharacterListItem[]> {
    const response = await apiClient.get<{
      success: boolean;
      data: { characters: CharacterListItem[] };
    }>('/game/characters/public-list');

    return response.data.data.characters;
  },
};
