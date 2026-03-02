/**
 * District View Component (Split-Panel)
 *
 * Split-panel layout for viewing a district and its sublocations.
 *
 * Layout:
 * - Left panel (30%): Recursive tree of all sublocations
 * - Right panel (70%): Details of selected location
 *
 * Features:
 * - Back button to return to map
 * - Recursive tree with expand/collapse
 * - Location details with action buttons
 *
 * @module components/locations/DistrictView
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';
import styles from '@/styles/components/locations/split.module.scss';
import { LocationTreeNode } from './LocationTreeNode';
import { LocationDetail } from './LocationDetail';
import type { AccessibleLocation } from '@/types/location';

/**
 * District View Props
 */
interface DistrictViewProps {
  /** Root location (district) */
  district: AccessibleLocation;
  /** Callback when back button is clicked */
  onBack?: () => void;
}

/**
 * District View Component
 *
 * Renders split-panel view with location tree and details.
 *
 * @component
 * @param {DistrictViewProps} props - Component props
 * @returns {JSX.Element} District view
 *
 * @example
 * ```tsx
 * <DistrictView
 *   district={westminster}
 *   onBack={() => router.push('/locations')}
 * />
 * ```
 */
export function DistrictView({ district, onBack }: DistrictViewProps): JSX.Element {
  // Selected location (initially the district itself)
  const [selectedLocation, setSelectedLocation] = useState<AccessibleLocation>(district);

  return (
    <div className={styles.districtView}>
      {/* Header with back button */}
      <div className={styles.header}>
        {onBack && (
          <button type="button" className={styles.backButton} onClick={onBack}>
            ← Torna alla Mappa
          </button>
        )}
        <h1 className={styles.districtTitle}>{district.name}</h1>
      </div>

      {/* Split-Panel */}
      <div className={styles.splitPanel}>
        {/* Left Panel: Location Tree */}
        <div className={styles.navigationPanel}>
          <div className={styles.treeHeader}>SubLocations</div>
          <div className={styles.treeContent}>
            {/* Render district and all children recursively */}
            <LocationTreeNode
              location={district}
              depth={0}
              selectedId={selectedLocation._id}
              onLocationClick={(loc) => setSelectedLocation(loc)}
              defaultExpanded={true}
            />
          </div>
        </div>

        {/* Right Panel: Location Details */}
        <div className={styles.detailsPanel}>
          <LocationDetail location={selectedLocation} showActions={true} />
        </div>
      </div>
    </div>
  );
}
