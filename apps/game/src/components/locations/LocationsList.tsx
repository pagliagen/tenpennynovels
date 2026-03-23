/**
 * Locations List Component
 *
 * Text-based list view of all accessible locations.
 * Shows entire recursive tree expanded by default.
 *
 * Alternative to map view for:
 * - Mobile devices (map too small)
 * - Users who prefer text navigation
 * - Quick scanning of all locations
 *
 * @module components/locations/LocationsList
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';

import styles from '@/styles/components/locations/list.module.scss';
import type { AccessibleLocation } from '@/types/location';

import { LocationTreeNode } from './LocationTreeNode';

/**
 * Locations List Props
 */
interface LocationsListProps {
  /** Hierarchical tree of locations */
  locationTree: AccessibleLocation[];
  /** Optional callback when location is clicked (overrides default navigation) */
  onLocationClick?: (location: AccessibleLocation) => void;
}

/**
 * Locations List Component
 *
 * Renders expandable tree list of all locations.
 *
 * @component
 * @param {LocationsListProps} props - Component props
 * @returns {JSX.Element} Locations list
 *
 * @example
 * ```tsx
 * <LocationsList
 *   locationTree={locationTree}
 * />
 * ```
 */
export function LocationsList({
  locationTree,
  onLocationClick,
}: LocationsListProps): JSX.Element {
  const router = useRouter();

  /**
   * Handle location click
   * Navigate to location detail page
   */
  const handleLocationClick = (location: AccessibleLocation) => {
    if (onLocationClick) {
      onLocationClick(location);
    } else {
      // Default navigation
      router.push(`/locations/${location._id}`);
    }
  };

  // Empty state
  if (locationTree.length === 0) {
    return (
      <div className={styles.treeContainer}>
        <div className={styles.treeEmpty}>
          <p>Nessuna location accessibile</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.treeContainer}>
      <div className={styles.treeHeader}>Tutte le Locations</div>

      {/* Render all root locations with recursive children */}
      {locationTree.map((location) => (
        <LocationTreeNode
          key={location._id}
          location={location}
          depth={0}
          onLocationClick={handleLocationClick}
          defaultExpanded={true} // All expanded by default in list view
        />
      ))}
    </div>
  );
}
