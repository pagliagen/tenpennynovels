/**
 * useLocations Hook
 *
 * React hook for accessing locations with:
 * - Auto-initialization on mount
 * - WebSocket real-time invalidation
 * - localStorage caching
 * - Character-based access control
 *
 * @module hooks/useLocations
 * @since 2.0.0
 */

import { useEffect } from 'react';
import { useLocationStore } from '@/store/locationStore';
import { useAuthStore } from '@/store/authStore';
import { useWebSocket } from '@/contexts/WebSocketContext';

/**
 * useLocations Hook
 *
 * Provides access to locations state with automatic initialization
 * and real-time updates via WebSocket.
 *
 * **Usage**:
 * ```tsx
 * const { locations, locationTree, isLoading } = useLocations();
 * ```
 *
 * **WebSocket Events Handled**:
 * - `locations_structure_updated`: Admin modified locations → invalidate cache
 * - `location_access_granted`: Character gained access → refetch
 *
 * @returns Location store state and actions
 */
export function useLocations() {
  const store = useLocationStore();
  const { selectedCharacter } = useAuthStore();
  const { onGlobalEvent } = useWebSocket();

  // Initialize on mount or when character changes
  useEffect(() => {
    if (selectedCharacter) {
      store.initialize(selectedCharacter._id);
    }
  }, [selectedCharacter?._id]);

  // Listen for admin location updates (WebSocket)
  useEffect(() => {
    if (!selectedCharacter) return;

    const unsubscribe = onGlobalEvent((event) => {
      // Admin updated location structure
      if (event.type === 'locations_structure_updated') {
        console.log(
          '🔔 [useLocations] Admin updated locations, invalidating cache and refetching'
        );
        store.invalidateCache();
        store.forceRefresh(selectedCharacter._id);
      }

      // Character gained access to new location
      if (event.type === 'location_access_granted') {
        console.log(
          '🔓 [useLocations] New location access granted, refetching locations'
        );
        store.forceRefresh(selectedCharacter._id);
      }
    });

    return unsubscribe;
  }, [selectedCharacter?._id, onGlobalEvent]);

  return {
    locations: store.locations,
    locationTree: store.locationTree,
    isLoading: store.isLoading,
    error: store.error,
    forceRefresh: () => {
      if (selectedCharacter) {
        store.forceRefresh(selectedCharacter._id);
      }
    },
    invalidateCache: store.invalidateCache,
  };
}

/**
 * useLocationById Hook
 *
 * Retrieves a specific location by ID from the store.
 * Automatically initializes locations if not already loaded.
 *
 * @param locationId - Location._id to retrieve
 * @returns Location or undefined if not found
 *
 * @example
 * ```tsx
 * const location = useLocationById(router.query.locationId as string);
 * ```
 */
export function useLocationById(locationId: string | undefined) {
  const { locations, isLoading } = useLocations();

  if (!locationId) {
    return { location: undefined, isLoading };
  }

  const location = locations.find((loc) => loc._id === locationId);

  return { location, isLoading };
}

/**
 * useLocationBySlug Hook
 *
 * Retrieves a specific location by slug from the store.
 * Automatically initializes locations if not already loaded.
 *
 * @param slug - Location.slug (e.g., 'westminster', 'southwark')
 * @returns Location or undefined if not found
 *
 * @example
 * ```tsx
 * const location = useLocationBySlug(router.query.slug as string);
 * ```
 */
export function useLocationBySlug(slug: string | undefined) {
  const { locations, isLoading } = useLocations();

  if (!slug) {
    return { location: undefined, isLoading };
  }

  const location = locations.find((loc) => loc.slug === slug);

  return { location, isLoading };
}

/**
 * useLocationTreeNodeBySlug Hook
 *
 * Retrieves a location node from the hierarchical tree by slug.
 * Returns the node WITH children populated (unlike useLocationBySlug).
 *
 * **Use this when you need to display a location and its sub-tree**.
 *
 * @param slug - Location.slug (e.g., 'westminster', 'southwark')
 * @returns Location node with children or undefined if not found
 *
 * @example
 * ```tsx
 * const location = useLocationTreeNodeBySlug('westminster');
 * // Returns: { _id, name, slug, children: [ParliamentSquare, WestminsterAbbey, ...] }
 * ```
 */
export function useLocationTreeNodeBySlug(slug: string | undefined) {
  const { locationTree, isLoading } = useLocations();

  if (!slug) {
    return { location: undefined, isLoading };
  }

  // Recursively search tree by slug
  const findBySlug = (
    nodes: typeof locationTree,
    targetSlug: string
  ): typeof locationTree[0] | undefined => {
    for (const node of nodes) {
      if (node.slug === targetSlug) return node;
      if (node.children) {
        const found = findBySlug(node.children, targetSlug);
        if (found) return found;
      }
    }
    return undefined;
  };

  const location = findBySlug(locationTree, slug);

  return { location, isLoading };
}

/**
 * useLocationSubtree Hook
 *
 * Retrieves the complete subtree of a location (all descendants).
 * Useful for rendering location detail pages with nested children.
 *
 * @param locationId - Root location._id
 * @returns Array of locations in subtree (flattened)
 *
 * @example
 * ```tsx
 * const subtree = useLocationSubtree(westminsterId);
 * // Returns: [Westminster, ZonaA, ZonaB, ZonaC, ZonaC.1, ZonaC.2]
 * ```
 */
export function useLocationSubtree(locationId: string | undefined) {
  const { locations, locationTree, isLoading } = useLocations();

  if (!locationId) {
    return { subtree: [], isLoading };
  }

  // Find root location in tree
  const findLocationInTree = (
    nodes: typeof locationTree,
    id: string
  ): typeof locationTree[0] | undefined => {
    for (const node of nodes) {
      if (node._id === id) return node;
      if (node.children) {
        const found = findLocationInTree(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const rootNode = findLocationInTree(locationTree, locationId);

  if (!rootNode) {
    return { subtree: [], isLoading };
  }

  // Flatten subtree
  const flattenTree = (
    node: typeof rootNode,
    result: typeof locations = []
  ): typeof locations => {
    result.push(node);
    if (node.children) {
      node.children.forEach((child) => flattenTree(child, result));
    }
    return result;
  };

  const subtree = flattenTree(rootNode);

  return { subtree, isLoading };
}
