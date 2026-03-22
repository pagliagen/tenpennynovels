import { api } from './client';

const FAVORITES_CACHE_KEY = 'tpn_doc_favorites';

function getCachedFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(FAVORITES_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function setCachedFavoriteIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage full or unavailable
  }
}

export function isDocumentCachedAsFavorite(documentId: string): boolean {
  return getCachedFavoriteIds().includes(documentId);
}

export interface FavoriteEntry {
  _id: string;
  document: {
    _id: string;
    slug: string;
    title: string;
    tags: string[];
    isDraft: boolean;
    path: string;
    type: string;
  };
  route: { path: string; type: string };
  addedAt: string;
}

interface FavoritesListBody {
  data?: FavoriteEntry[];
}

interface FavoriteToggleBody {
  data?: { favorited: boolean };
}

export const favoritesApi = {
  async list(): Promise<FavoriteEntry[]> {
    const body = await api.get<FavoritesListBody>('/documents/favorites');
    const favorites: FavoriteEntry[] = body.data ?? [];

    const ids = favorites.map((f) => f.document._id);
    setCachedFavoriteIds(ids);

    return favorites;
  },

  async toggle(type: string, path: string): Promise<{ favorited: boolean }> {
    const body = await api.post<FavoriteToggleBody>(`/documents/${type}/${path}/favorite`);
    return body.data ?? { favorited: false };
  },
};
