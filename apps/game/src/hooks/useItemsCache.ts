import { useState, useEffect } from 'react';
import { CacheManager, CACHE_KEYS, CACHE_TTL } from '@/utils/cache';

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  basePrice: number;
  prerequisites?: any;
  properties?: any;
  rarity: string;
}

/**
 * Hook for managing items with localStorage cache
 * Always tries to read from cache first, falls back to server on error
 */
export const useItemsCache = (serverItems?: Item[]) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadItems = () => {
      try {
        console.log('🗄️ useItemsCache: Loading items...');
        
        // Always try cache first
        const cachedItems = CacheManager.get<Item[]>(CACHE_KEYS.ITEMS);
        
        if (cachedItems) {
          console.log('🗄️ useItemsCache: Using cached items:', cachedItems.length);
          setItems(cachedItems);
          setError(null);
          return;
        }

        // If no cache and server data available, use server data and cache it
        if (serverItems && serverItems.length > 0) {
          console.log('🗄️ useItemsCache: Using server items and caching:', serverItems.length);
          setItems(serverItems);
          CacheManager.set(CACHE_KEYS.ITEMS, serverItems, CACHE_TTL.ITEMS);
          setError(null);
          return;
        }

        // No data available
        console.log('🗄️ useItemsCache: No items data available');
        setItems([]);
        
      } catch (err) {
        console.error('🗄️ useItemsCache: Error loading items:', err);
        setError('Failed to load items');
        
        // Fallback to server data if available
        if (serverItems) {
          setItems(serverItems);
        }
      }
    };

    loadItems();
  }, [serverItems]);

  /**
   * Manually refresh items from server
   * This will be used when cache needs to be refreshed
   */
  const refreshFromServer = async () => {
    setLoading(true);
    try {
      // This would trigger a fresh /game/init call without exclude
      // For now, we'll implement this when needed
      console.log('🗄️ useItemsCache: Refresh from server requested');
      setError('Manual refresh not implemented yet');
    } catch (err) {
      console.error('🗄️ useItemsCache: Refresh error:', err);
      setError('Failed to refresh items');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update a specific item in cache
   * This will be called by admin hooks to keep cache in sync
   */
  const updateItem = (itemId: string, updates: Partial<Item>) => {
    setItems(prevItems => {
      const updatedItems = prevItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      );
      
      // Update cache
      CacheManager.set(CACHE_KEYS.ITEMS, updatedItems, CACHE_TTL.ITEMS);
      console.log('🗄️ useItemsCache: Updated item in cache:', itemId);
      
      return updatedItems;
    });
  };

  /**
   * Add new item to cache
   */
  const addItem = (newItem: Item) => {
    setItems(prevItems => {
      const updatedItems = [...prevItems, newItem];
      
      // Update cache
      CacheManager.set(CACHE_KEYS.ITEMS, updatedItems, CACHE_TTL.ITEMS);
      console.log('🗄️ useItemsCache: Added item to cache:', newItem.id);
      
      return updatedItems;
    });
  };

  /**
   * Remove item from cache
   */
  const removeItem = (itemId: string) => {
    setItems(prevItems => {
      const updatedItems = prevItems.filter(item => item.id !== itemId);
      
      // Update cache
      CacheManager.set(CACHE_KEYS.ITEMS, updatedItems, CACHE_TTL.ITEMS);
      console.log('🗄️ useItemsCache: Removed item from cache:', itemId);
      
      return updatedItems;
    });
  };

  return {
    items,
    loading,
    error,
    refreshFromServer,
    updateItem,
    addItem,
    removeItem,
    cacheInfo: {
      hasCachedData: CacheManager.isValid(CACHE_KEYS.ITEMS),
      cacheSize: items.length
    }
  };
};