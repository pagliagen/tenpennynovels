/**
 * Local storage cache utility with TTL support
 */

export interface CacheItem<T> {
  data: T;
  expiry: number;
}

export class CacheManager {
  /**
   * Store data in cache with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttlMinutes TTL in minutes
   */
  static set<T>(key: string, data: T, ttlMinutes: number): void {
    try {
      const item: CacheItem<T> = {
        data,
        expiry: Date.now() + (ttlMinutes * 60 * 1000)
      };
      
      localStorage.setItem(key, JSON.stringify(item));
      console.log(`🗄️ Cache: Stored ${key} with TTL ${ttlMinutes} minutes`);
    } catch (error) {
      console.warn('🗄️ Cache: Failed to store data:', error);
    }
  }

  /**
   * Get data from cache if not expired
   * @param key Cache key
   * @returns Data or null if expired/missing
   */
  static get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) {
        console.log(`🗄️ Cache: No data found for ${key}`);
        return null;
      }

      const item: CacheItem<T> = JSON.parse(itemStr);
      
      if (Date.now() > item.expiry) {
        console.log(`🗄️ Cache: Data expired for ${key}, removing`);
        localStorage.removeItem(key);
        return null;
      }

      console.log(`🗄️ Cache: Retrieved valid data for ${key}`);
      return item.data;
    } catch (error) {
      console.warn('🗄️ Cache: Failed to retrieve data:', error);
      return null;
    }
  }

  /**
   * Check if cache key exists and is not expired
   * @param key Cache key
   * @returns True if valid cache exists
   */
  static isValid(key: string): boolean {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return false;

      const item: CacheItem<any> = JSON.parse(itemStr);
      return Date.now() <= item.expiry;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove item from cache
   * @param key Cache key
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
      console.log(`🗄️ Cache: Removed ${key}`);
    } catch (error) {
      console.warn('🗄️ Cache: Failed to remove data:', error);
    }
  }

  /**
   * Clear all cache items
   */
  static clear(): void {
    try {
      localStorage.clear();
      console.log('🗄️ Cache: Cleared all data');
    } catch (error) {
      console.warn('🗄️ Cache: Failed to clear data:', error);
    }
  }

  /**
   * Invalidate specific cache (for admin hooks)
   * @param key Cache key to invalidate
   */
  static invalidate(key: string): void {
    try {
      localStorage.removeItem(key);
      console.log(`🗄️ Cache: Invalidated ${key} (admin hook)`);
    } catch (error) {
      console.warn('🗄️ Cache: Failed to invalidate data:', error);
    }
  }

  /**
   * Force refresh cache with new data (for admin hooks)
   * @param key Cache key
   * @param data New data to cache
   * @param ttlMinutes TTL in minutes
   */
  static forceRefresh<T>(key: string, data: T, ttlMinutes: number): void {
    try {
      // Remove old cache first
      localStorage.removeItem(key);
      
      // Set new cache
      const item: CacheItem<T> = {
        data,
        expiry: Date.now() + (ttlMinutes * 60 * 1000)
      };
      
      localStorage.setItem(key, JSON.stringify(item));
      console.log(`🗄️ Cache: Force refreshed ${key} (admin hook)`);
    } catch (error) {
      console.warn('🗄️ Cache: Failed to force refresh data:', error);
    }
  }

  /**
   * Get cache info for debugging
   */
  static getInfo(): { [key: string]: { expiry: Date; ttlMinutes: number; size: number } } {
    const info: any = {};
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const itemStr = localStorage.getItem(key);
        if (!itemStr) continue;

        try {
          const item: CacheItem<any> = JSON.parse(itemStr);
          const ttlMinutes = Math.round((item.expiry - Date.now()) / (60 * 1000));
          
          info[key] = {
            expiry: new Date(item.expiry),
            ttlMinutes: ttlMinutes,
            size: itemStr.length
          };
        } catch (e) {
          // Skip non-cache items
        }
      }
    } catch (error) {
      console.warn('🗄️ Cache: Failed to get cache info:', error);
    }

    return info;
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  LOCATIONS: 'game_locations',
  ITEMS: 'game_items',
} as const;

// Default TTL settings (in minutes) - 24 hours for persistent cache
export const CACHE_TTL = {
  LOCATIONS: 24 * 60,  // 24 hours - invalidated only by admin hooks
  ITEMS: 24 * 60,      // 24 hours - invalidated only by admin hooks
} as const;

/**
 * Get London location ID from cache
 * London is the root location with locationLevel='root'
 */
export const getLondonLocationId = (): string | null => {
  const locations = CacheManager.get<any[]>(CACHE_KEYS.LOCATIONS);
  const london = locations?.find(loc => loc.locationLevel === 'root' && loc.name === 'London');
  return london?.id || null;
};

/**
 * Restituisce il nome della location dato il suo ID, utilizzando la cache.
 * @param locationId L'ID della location da cercare
 * @returns Il nome della location, oppure null se non trovata
 */
export const getLocationNameById = (locationId: string): string | null => {
  const locations = CacheManager.get<any[]>(CACHE_KEYS.LOCATIONS);
  if (!locations) return null;
  const location = locations.find(loc => loc.id === locationId);
  return location ? location.name : null;
};
