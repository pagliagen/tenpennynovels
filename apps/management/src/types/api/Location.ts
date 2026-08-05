/**
 * Location API Types
 *
 * Tipi per le location nel pannello di gestione.
 * Struttura gerarchica: root → district → location
 */

export type LocationLevel = 'root' | 'district' | 'quartiere' | 'location';

export interface MapPosition {
  x: number;
  y: number;
}

export interface LocationPosition {
  name: string;
  image?: string;
  description?: string;
}

export interface LocationSettings {
  visible: boolean;
  chat: boolean;
  shop: boolean;
  private: boolean;
  bot_enabled: boolean;
}

export interface LocationStatistics {
  totalVisits: number;
  uniqueVisitors: number;
  currentOccupants: number;
  averageStayTime: string;
  messagesExchanged: number;
}

export interface LocationManagement {
  createdBy: string;
  lastModified: string;
  modifiedBy: string;
}

export interface Location {
  id: string;
  name: string;
  slug: string;
  district: string;
  description: string;
  locationLevel: LocationLevel;
  parentLocation: string | null;
  parentLocationName: string | null;
  sortOrder: number;
  imageUrl: string | null;
  descriptionImages: string[];
  positions: LocationPosition[];
  maxOccupants: number | null;
  settings: LocationSettings;
  statistics: LocationStatistics;
  management: LocationManagement;
}

export interface LocationDetail extends Location {
  childCount: number;
}

export interface LocationTreeNode {
  id: string;
  name: string;
  slug: string;
  district: string;
  locationLevel: LocationLevel;
  parentId: string | null;
  sortOrder: number;
  visible: boolean;
  private: boolean;
  imageUrl: string | null;
  currentOccupants: number;
  mapPosition: MapPosition | null;
  children: LocationTreeNode[];
}

export interface LocationHierarchyResponse {
  tree: LocationTreeNode[];
  totalLocations: number;
  publicLocations: number;
  privateLocations: number;
}

export interface LocationStatsResponse {
  total: number;
  visible: number;
  hidden: number;
  private: number;
  withChat: number;
  withShop: number;
  activeOccupants: number;
  totalVisits: number;
  messagesExchanged: number;
  topDistricts: { name: string; count: number }[];
}

export interface LocationListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  district?: string;
  locationLevel?: LocationLevel;
  showHidden?: boolean;
}

export interface LocationListResponse {
  result: boolean;
  data: {
    locations: Location[];
    pagination: {
      page: number;
      totalPages: number;
      totalItems: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export interface CreateLocationData {
  name: string;
  description: string;
  locationLevel: LocationLevel;
  district?: string;
  parentLocation?: string | null;
  imageUrl?: string;
  descriptionImages?: string[];
  positions?: LocationPosition[];
  maxOccupants?: number;
  settings?: Partial<LocationSettings>;
}

export interface UpdateLocationData {
  name?: string;
  description?: string;
  district?: string;
  locationLevel?: LocationLevel;
  parentLocation?: string | null;
  imageUrl?: string;
  descriptionImages?: string[];
  positions?: LocationPosition[];
  maxOccupants?: number;
  sortOrder?: number;
  settings?: Partial<LocationSettings>;
}
