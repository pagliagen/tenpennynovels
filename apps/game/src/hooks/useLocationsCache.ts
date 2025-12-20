import { useState, useEffect } from 'react';
import { CacheManager, CACHE_KEYS, CACHE_TTL } from '@/utils/cache';


export interface Location {
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
  children?: Location[];
  occupants?: number;
  occupantsList?: Array<{
    characterId: string;
    characterName: string;
    enteredAt: string;
    lastSeen: string;
  }>;
  imageUrl?: string;
  settings?: {
    visible: boolean;
    chat: boolean;
    shop: boolean;
    private: boolean;
  };
}

/**
 * Hook for managing locations with localStorage cache
 * Always tries to read from cache first, falls back to server on error
 */
export const useLocationsCache = (serverLocations?: Location[]) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLocations = () => {
      try {
        console.log('🗄️ useLocationsCache: Loading locations...');
        
        // Always try cache first
        const cachedLocations = CacheManager.get<Location[]>(CACHE_KEYS.LOCATIONS);
        
        if (cachedLocations) {
          console.log('🗄️ useLocationsCache: Using cached locations:', cachedLocations.length);
          setLocations(cachedLocations);
          setError(null);
          return;
        }

        // If no cache and server data available, use server data and cache it
        if (serverLocations && serverLocations.length > 0) {
          console.log('🗄️ useLocationsCache: Using server locations and caching:', serverLocations.length);
          
          setLocations(serverLocations);
          CacheManager.set(CACHE_KEYS.LOCATIONS, serverLocations, CACHE_TTL.LOCATIONS);
          setError(null);
          return;
        }

        // No data available
        console.log('🗄️ useLocationsCache: No locations data available');
        setLocations([]);
        
      } catch (err) {
        console.error('🗄️ useLocationsCache: Error loading locations:', err);
        setError('Failed to load locations');
        
        // Fallback to server data if available
        if (serverLocations) {
          setLocations(serverLocations);
        }
      }
    };

    loadLocations();
  }, [serverLocations]);

  /**
   * Manually refresh locations from server
   * This will be used when cache needs to be refreshed
   */
  const refreshFromServer = async () => {
    setLoading(true);
    try {
      // This would trigger a fresh /game/init call without exclude
      // For now, we'll implement this when needed
      console.log('🗄️ useLocationsCache: Refresh from server requested');
      setError('Manual refresh not implemented yet');
    } catch (err) {
      console.error('🗄️ useLocationsCache: Refresh error:', err);
      setError('Failed to refresh locations');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update a specific location in cache
   * This will be called by WebSocket events to keep cache in sync
   */
  const updateLocation = (locationId: string, updates: Partial<Location>) => {
    setLocations(prevLocations => {
      const updatedLocations = prevLocations.map(location => 
        location.id === locationId ? { ...location, ...updates } : location
      );
      
      // Update cache
      CacheManager.set(CACHE_KEYS.LOCATIONS, updatedLocations, CACHE_TTL.LOCATIONS);
      console.log('🗄️ useLocationsCache: Updated location in cache:', locationId);
      
      return updatedLocations;
    });
  };

  return {
    locations,
    loading,
    error,
    refreshFromServer,
    updateLocation,
    cacheInfo: {
      hasCachedData: CacheManager.isValid(CACHE_KEYS.LOCATIONS),
      cacheSize: locations.length
    }
  };
};