// Game API Service
// Handles authentication validation and game initialization

import { CacheManager, CACHE_KEYS, CACHE_TTL } from '@/utils/cache';
import type { CharacterCreationConfig } from '../../../../packages/shared/src/services/CharacterCreationConfigService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

export interface GameInitResponse {
  result: boolean;
  character?: {
    id: string;
    name: string;
    occupation?: string;
    currentLocation?: string;
    gameplayRoles: string[];
    status?: string;
    hitPoints?: number;
    magicPoints?: number;
    sanity?: number;
  };
  user?: {
    id: string;
    username: string;
    userRoles: string[];
    characterRoles: string[];
    canAccessAdmin: boolean;
    canAccessTickets: boolean;
    workableTicketsCount: number;
  };
  locations?: Array<{
    id: string;
    name: string;
    description?: string;
    accessible: boolean;
    hasShop?: boolean;
    hasChat?: boolean;
    private?: boolean;
    district?: string;
    parentLocation?: string;
    locationLevel?: 'root' | 'district' | 'location';
    sortOrder?: number;
  }>;
  globalPresence?: Array<{
    characterId: string;
    characterName: string;
    characterSurname: string | null;
    locationId: string;
    locationName: string;
    isCurrentCharacter: boolean;
    avatar: string | null;
  }>;
  notifications?: {
    unreadOffGameMessages: number;
  };
  items?: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    subcategory: string;
    basePrice: number;
    prerequisites?: any;
    properties?: any;
    rarity: string;
  }>;
  draftConfiguration?: {
    characterStatTotalPoints: number;
    characterSkillTotalPoints: number;
    baseSkills: Array<{
      id: string;
      name: string;
      baseValue: number;
      category: string;
      description: string;
      defaultSkill: boolean;
      sortOrder: number;
    }>;
    baseItems: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      subcategory?: string;
      basePrice: number;
      prerequisites?: any;
      properties: any;
      rarity: string;
    }>;
    baseOccupations: Array<{
      id: string;
      name: string;
      description: string;
      allowedGenders: string[];
      socialClass: string[];
      dailySalary: number;
      socialRespectability: number;
      category: string;
      prerequisites?: any;
      benefits?: any;
      workingConditions: string;
      rarity: string;
    }>;
    characterCreationConfig?: CharacterCreationConfig;
  };
  error?: string;
}

export interface PingResponse {
  result: boolean;
  valid: boolean;
  error?: string;
  redirectTo?: string; // If auth is invalid, redirect back to landing
}

export class GameApiService {
  /**
   * Get cache status for debugging
   */
  static getCacheInfo() {
    return {
      locations: {
        cached: CacheManager.isValid(CACHE_KEYS.LOCATIONS),
        data: CacheManager.get(CACHE_KEYS.LOCATIONS)
      },
      items: {
        cached: CacheManager.isValid(CACHE_KEYS.ITEMS),
        data: CacheManager.get(CACHE_KEYS.ITEMS)
      },
      info: CacheManager.getInfo()
    };
  }
  /**
   * Initialize game data - called when game page loads
   * Validates auth and character context, returns accessible locations and character data
   */
  static async initGame(): Promise<GameInitResponse> {
    try {
      // Check cache for locations and items
      const cachedLocations = CacheManager.get(CACHE_KEYS.LOCATIONS);
      const cachedItems = CacheManager.get(CACHE_KEYS.ITEMS);
      
      const exclude = [];
      if (cachedLocations) {
        exclude.push('locations');
        console.log('🗄️ GameApi: Using cached locations');
      }
      if (cachedItems) {
        exclude.push('items');
        console.log('🗄️ GameApi: Using cached items');
      }

      const response = await fetch(`${API_BASE_URL}/game/init`, {
        method: 'POST', // Changed to POST to support body
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exclude })
      });

      const data = await response.json();
      
      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Failed to initialize game'
        };
      }

      // Merge cached data with fresh data
      const responseData = {
        character: data.data.character,
        user: data.data.user,
        locations: data.data.locations || cachedLocations || [],
        items: data.data.items || cachedItems || [],
        globalPresence: data.data.globalPresence,
        draftConfiguration: data.data.draftConfiguration
      };

      // Cache new locations if received
      if (data.data.locations && !cachedLocations) {
        CacheManager.set(CACHE_KEYS.LOCATIONS, data.data.locations, CACHE_TTL.LOCATIONS);
        console.log('🗄️ GameApi: Cached new locations data');
      }

      // Cache new items if received
      if (data.data.items && !cachedItems) {
        CacheManager.set(CACHE_KEYS.ITEMS, data.data.items, CACHE_TTL.ITEMS);
        console.log('🗄️ GameApi: Cached new items data');
      }

      // Update draftConfiguration with items (cached or fresh) if character is DRAFT
      if (data.data.draftConfiguration) {
        data.data.draftConfiguration.baseItems = responseData.items;
        responseData.draftConfiguration = data.data.draftConfiguration;
      }

      return {
        result: true,
        ...responseData
      };
    } catch (error) {
      console.error('Game initialization failed:', error);
      return {
        result: false,
        error: 'Network error during game initialization'
      };
    }
  }

  /**
   * Ping endpoint - validates cookies and session
   * Called periodically to ensure user is still authenticated
   */
  static async ping(): Promise<PingResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/game/ping`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (!response.ok || !data.result) {
        return {
          result: false,
          valid: false,
          error: data.error || 'Authentication validation failed',
          redirectTo: process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com'
        };
      }

      return {
        result: true,
        valid: data.data?.valid || true
      };
    } catch (error) {
      console.error('Ping failed:', error);
      return {
        result: false,
        valid: false,
        error: 'Network error during authentication check',
        redirectTo: process.env.LANDING_URL || 'https://game.tenpennynovels.com'
      };
    }
  }

  /**
   * Set character's current location
   */
  static async setCharacterLocation(locationId: string): Promise<{ result: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/game/characters/set-location`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locationId }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Failed to set character location'
        };
      }

      return { result: true };
    } catch (error) {
      console.error('Set character location failed:', error);
      return {
        result: false,
        error: 'Network error during location update'
      };
    }
  }

  /**
   * Get location details and chat history
   */
  static async getLocation(locationId: string): Promise<LocationResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/game/locations/${locationId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (!response.ok || !data.result) {
        return {
          result: false,
          error: data.error || 'Failed to get location'
        };
      }

      return {
        result: true,
        location: data.data.location,
        chatHistory: data.data.chatHistory || []
      };
    } catch (error) {
      console.error('Get location failed:', error);
      return {
        result: false,
        error: 'Network error during location fetch'
      };
    }
  }

  /**
   * Logout and redirect to landing
   */
  static async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          logoutAllDevices: false,
          reason: 'user_logout'
        }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always redirect to landing regardless of logout success
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com';
    }
  }
}

// Additional interfaces for location functionality
export interface LocationResponse {
  result: boolean;
  location?: {
    id: string;
    name: string;
    description: string;
    accessible: boolean;
    hasShop: boolean;
    private: boolean;
  };
  chatHistory?: Array<{
    id: string;
    actionType: string;
    characterId: string;
    characterName: string;
    content: string;
    timestamp: string;
    visibility: string;
    diceResult?: any;
    itemEffect?: any;
    targetCharacters?: string[];
  }>;
  error?: string;
}