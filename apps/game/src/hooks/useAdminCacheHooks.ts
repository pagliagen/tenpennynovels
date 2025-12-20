import { useEffect } from 'react';
import { CacheManager, CACHE_KEYS } from '@/utils/cache';

/**
 * Hook to listen for admin events that should invalidate cache
 * Will be used when the admin panel is implemented
 */
export const useAdminCacheHooks = () => {
  useEffect(() => {
    // Listen for custom events from admin panel
    const handleLocationUpdate = () => {
      console.log('🗄️ Admin Hook: Location updated, invalidating cache');
      CacheManager.invalidate(CACHE_KEYS.LOCATIONS);
    };

    const handleItemUpdate = () => {
      console.log('🗄️ Admin Hook: Item updated, invalidating cache');
      CacheManager.invalidate(CACHE_KEYS.ITEMS);
    };

    // Listen for localStorage events from other tabs (admin panel)
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'admin_locations_updated') {
        console.log('🗄️ Admin Hook: Locations updated in other tab, invalidating cache');
        CacheManager.invalidate(CACHE_KEYS.LOCATIONS);
        // Remove the trigger key
        localStorage.removeItem('admin_locations_updated');
      }
      
      if (event.key === 'admin_items_updated') {
        console.log('🗄️ Admin Hook: Items updated in other tab, invalidating cache');
        CacheManager.invalidate(CACHE_KEYS.ITEMS);
        // Remove the trigger key
        localStorage.removeItem('admin_items_updated');
      }
    };

    // Add event listeners
    window.addEventListener('admin_locations_updated', handleLocationUpdate);
    window.addEventListener('admin_items_updated', handleItemUpdate);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      // Cleanup
      window.removeEventListener('admin_locations_updated', handleLocationUpdate);
      window.removeEventListener('admin_items_updated', handleItemUpdate);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Utility functions for admin panel to trigger cache invalidation
  const triggerLocationCacheInvalidation = () => {
    // Trigger in current tab
    window.dispatchEvent(new CustomEvent('admin_locations_updated'));
    
    // Trigger in other tabs
    localStorage.setItem('admin_locations_updated', Date.now().toString());
  };

  const triggerItemCacheInvalidation = () => {
    // Trigger in current tab
    window.dispatchEvent(new CustomEvent('admin_items_updated'));
    
    // Trigger in other tabs
    localStorage.setItem('admin_items_updated', Date.now().toString());
  };

  return {
    triggerLocationCacheInvalidation,
    triggerItemCacheInvalidation
  };
};

// Standalone functions for use in admin panel
export const AdminCacheUtils = {
  /**
   * Call this from admin panel when locations are updated
   */
  invalidateLocationsCache: () => {
    // Invalidate in current tab
    CacheManager.invalidate(CACHE_KEYS.LOCATIONS);
    
    // Notify other tabs
    localStorage.setItem('admin_locations_updated', Date.now().toString());
    setTimeout(() => localStorage.removeItem('admin_locations_updated'), 1000);
    
    console.log('🗄️ AdminCacheUtils: Invalidated locations cache across all tabs');
  },

  /**
   * Call this from admin panel when items are updated
   */
  invalidateItemsCache: () => {
    // Invalidate in current tab
    CacheManager.invalidate(CACHE_KEYS.ITEMS);
    
    // Notify other tabs
    localStorage.setItem('admin_items_updated', Date.now().toString());
    setTimeout(() => localStorage.removeItem('admin_items_updated'), 1000);
    
    console.log('🗄️ AdminCacheUtils: Invalidated items cache across all tabs');
  }
};