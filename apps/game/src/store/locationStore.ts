/**
 * Location Store (Zustand + localStorage persistence)
 *
 * Manages locations state with multi-layer caching strategy:
 * 1. In-memory state (Zustand)
 * 2. localStorage persistence (auto-hydrate on mount)
 * 3. TTL-based invalidation (7 days)
 * 4. Schema versioning (auto-invalidate on schema changes)
 * 5. WebSocket real-time invalidation
 *
 * @module store/locationStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { api } from '@/lib/api/client';
import type { AccessibleLocation, LocationsResponse, RootLocation, RootLocationResponse } from '@/types/location';
import { logger } from '@/lib/logger';

/**
 * Cache Configuration
 */
const CACHE_VERSION = '1.5.0'; // Bump when ILocation schema changes (v1.5.0: rootLocation for topbar default state)
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Location Store State
 */
interface LocationStore {
  // Data
  locations: AccessibleLocation[];
  locationTree: AccessibleLocation[];
  rootLocation: RootLocation | null;

  // Cache metadata
  cacheVersion: string;
  lastFetched: number;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: (characterId: string) => Promise<void>;
  forceRefresh: (characterId: string) => Promise<void>;
  invalidateCache: () => void;
  reset: () => void;
}

/**
 * Build hierarchical tree from flat locations list
 *
 * @param locations - Flat list of locations
 * @returns Hierarchical tree with children
 */
function buildLocationTree(locations: AccessibleLocation[]): AccessibleLocation[] {
  // Create a map for quick lookup
  const locationMap = new Map<string, AccessibleLocation>();
  const rootLocations: AccessibleLocation[] = [];

  // First pass: create map and initialize children arrays
  locations.forEach((location) => {
    locationMap.set(location._id, { ...location, children: [] });
  });

  // Second pass: build tree structure
  locations.forEach((location) => {
    const node = locationMap.get(location._id);
    if (!node) return;

    if (location.parentLocation) {
      // Has parent, try to add to parent's children
      const parent = locationMap.get(location.parentLocation);
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        // Parent not found (e.g., London excluded by backend) → treat as root
        rootLocations.push(node);
      }
    } else {
      // No parent, it's a root location
      rootLocations.push(node);
    }
  });

  // Sort by sortOrder at each level
  const sortLocations = (locs: AccessibleLocation[]) => {
    locs.sort((a, b) => a.sortOrder - b.sortOrder);
    locs.forEach((loc) => {
      if (loc.children && loc.children.length > 0) {
        sortLocations(loc.children);
      }
    });
  };

  sortLocations(rootLocations);

  return rootLocations;
}

/**
 * Compute helper fields for locations
 *
 * @param locations - Raw locations from API
 * @returns Locations with computed fields
 */
function enrichLocations(locations: AccessibleLocation[]): AccessibleLocation[] {
  return locations.map((location) => ({
    ...location,
    // Safe access to settings with defaults (backend might not return settings)
    hasChat: location.settings?.chat ?? false,
    hasShop: location.settings?.shop ?? false,
    isPrivate: location.settings?.private ?? false,
    occupantCount: location.occupants?.length || 0,
  }));
}

/**
 * Location Store
 *
 * Uses Zustand persist middleware for automatic localStorage sync.
 */
export const useLocationStore = create<LocationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      locations: [],
      locationTree: [],
      rootLocation: null,
      cacheVersion: CACHE_VERSION,
      lastFetched: 0,
      isLoading: false,
      error: null,

      /**
       * Initialize locations (with cache validation)
       *
       * Checks cache validity before fetching from API.
       * Uses cached data if valid, otherwise fetches fresh data.
       */
      initialize: async (characterId: string) => {
        const state = get();
        const now = Date.now();

        // Check cache validity
        const isCacheValid =
          state.cacheVersion === CACHE_VERSION && // Schema match
          state.lastFetched > 0 && // Has been fetched before
          now - state.lastFetched < CACHE_TTL_MS && // Not expired
          state.locations.length > 0 && // Has data
          state.rootLocation !== null; // Has root location (topbar default state)

        if (isCacheValid) {
          const cacheAgeMinutes = Math.round((now - state.lastFetched) / 1000 / 60);
          logger.info(`✅ Using cached locations (age: ${cacheAgeMinutes} min, ${state.locations.length} locations)`);
          return;
        }

        // Cache invalid, fetch fresh data
        logger.info('🔄 Cache invalid, fetching fresh locations');
        await get().forceRefresh(characterId);
      },

      /**
       * Force refresh locations from API
       *
       * Bypasses cache and fetches fresh data.
       * Use when admin updates locations or cache is invalidated.
       */
      forceRefresh: async () => {
        set({ isLoading: true, error: null });

        try {
          const [locationsResponse, rootLocationResponse] = await Promise.all([
            api.get<{ result: boolean; data: LocationsResponse }>('/game/locations'),
            api.get<{ result: boolean; data: RootLocationResponse }>('/game/locations/root'),
          ]);

          // Enrich with computed fields
          const enrichedLocations = enrichLocations(locationsResponse.data.locations);

          // Build tree structure
          const tree = buildLocationTree(enrichedLocations);

          set({
            locations: enrichedLocations,
            locationTree: tree,
            rootLocation: rootLocationResponse.data.rootLocation,
            lastFetched: Date.now(),
            cacheVersion: CACHE_VERSION,
            isLoading: false,
            error: null,
          });

          logger.info(`✅ Locations refreshed: ${enrichedLocations.length} total, ${tree.length} root nodes`);
        } catch (error) {
          logger.error('❌ Failed to fetch locations:', { error });
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch locations',
          });
        }
      },

      /**
       * Invalidate cache
       *
       * Clears cached locations, forcing a refetch on next initialize().
       * Used when admin updates locations via WebSocket.
       */
      invalidateCache: () => {
        logger.info('❌ Location cache invalidated');
        set({
          locations: [],
          locationTree: [],
          rootLocation: null,
          lastFetched: 0,
        });
      },

      /**
       * Reset store to initial state
       *
       * Clears all data and cache metadata.
       */
      reset: () => {
        set({
          locations: [],
          locationTree: [],
          rootLocation: null,
          cacheVersion: CACHE_VERSION,
          lastFetched: 0,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'tenpennynovels-locations', // localStorage key
      version: 1, // Zustand persist version (auto-migrates on change)

      // Only persist these fields (exclude isLoading, error)
      partialize: (state) => ({
        locations: state.locations,
        locationTree: state.locationTree,
        rootLocation: state.rootLocation,
        cacheVersion: state.cacheVersion,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
