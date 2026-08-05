/**
 * Locations Map Component
 *
 * Interactive London map with small, transparent district buttons.
 *
 * Features:
 * - One small button per district, positioned via Location.mapPosition (set
 *   from the management "Posiziona Mappa" page, not hardcoded on frontend)
 * - Click a district with a quartiere tier (River Wards, Central London, East
 *   End, West End) to expand it in place and reveal its quartiere buttons
 * - Click a quartiere button — or, for Suburbs/Country Side (no quartiere
 *   tier), the district button itself — to open a popup with its name,
 *   description and Location children (image, description, Entra In Chat)
 * - Native tooltip on hover (occupant count)
 * - Occupant indicators (red dots)
 * - Victorian theme styling
 *
 * @module components/locations/LocationsMap
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';

import styles from '@/styles/components/locations/map.module.scss';
import type { AccessibleLocation } from '@/types/location';

import { QuartierePopup } from './QuartierePopup';

/**
 * Locations Map Props
 */
interface LocationsMapProps {
  /** Array of accessible locations */
  locations: AccessibleLocation[];
  /** Optional callback when London label is clicked */
  onLondonClick?: () => void;
}

/**
 * Locations Map Component
 *
 * Renders interactive London map with clickable district buttons.
 *
 * @component
 * @param {LocationsMapProps} props - Component props
 * @returns {JSX.Element} London map
 *
 * @example
 * ```tsx
 * <LocationsMap locations={locations} />
 * ```
 */
export function LocationsMap({
  locations
}: LocationsMapProps): JSX.Element {
  const [expandedDistrictId, setExpandedDistrictId] = useState<string | null>(null);
  const [popupEntityId, setPopupEntityId] = useState<string | null>(null);

  // Top-level districts with a marker position set (via management "Posiziona Mappa")
  const districtsWithPosition = locations.filter(
    (loc) => loc.locationLevel === 'district' && loc.mapPosition != null
  );

  const popupEntity = popupEntityId ? locations.find((loc) => loc._id === popupEntityId) ?? null : null;
  const popupChildren = popupEntity
    ? locations
        .filter((loc) => loc.parentLocation === popupEntity._id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const handleDistrictToggle = (districtId: string) => {
    setExpandedDistrictId((current) => (current === districtId ? null : districtId));
  };

  /**
   * Click on a top-level district button.
   * - Has a quartiere tier (its children are 'quartiere'): expand in place.
   * - No quartiere tier (Suburbs/Country Side, children are already 'location'): open the popup directly.
   */
  const handleDistrictClick = (district: AccessibleLocation) => {
    const children = locations.filter((loc) => loc.parentLocation === district._id);
    const hasQuartiereTier = children.some((child) => child.locationLevel === 'quartiere');

    if (hasQuartiereTier) {
      handleDistrictToggle(district._id);
    } else {
      setPopupEntityId(district._id);
    }
  };

  return (
    <div className={styles.mapContainer}>
      <div className={styles.mapWrapper}>
        {/* Main London Map Image */}
        <div className={styles.mapImageWrapper}>
          <img
            src="/locations/london.png"
            alt="Mappa di Londra 1889"
            width={1536}
            height={1024}
            className={styles.mapImage}
          />

          {/* District & quartiere buttons */}
          {districtsWithPosition.map((location) => {
            const position = location.mapPosition;
            if (!position) return null;

            const hasOccupants = (location.occupantCount || 0) > 0;
            const isExpanded = expandedDistrictId === location._id;
            const isDimmed = expandedDistrictId !== null && !isExpanded;

            // Quartieri: direct children of this district, positioned on the map
            const quartieri = locations
              .filter((loc) => loc.parentLocation === location._id && loc.mapPosition != null)
              .sort((a, b) => a.sortOrder - b.sortOrder);

            if (isExpanded) {
              return (
                <div key={location._id} className={styles.districtButtonGroup}>
                  <button
                    type="button"
                    className={styles.collapseButton}
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    onClick={() => handleDistrictToggle(location._id)}
                  >
                    {`✕ ${location.name}`}
                  </button>

                  {quartieri.map((quartiere) => (
                    <button
                      key={quartiere._id}
                      type="button"
                      className={styles.subDistrictButton}
                      style={{ left: `${quartiere.mapPosition!.x}%`, top: `${quartiere.mapPosition!.y}%` }}
                      title={quartiere.name}
                      onClick={() => setPopupEntityId(quartiere._id)}
                    >
                      {quartiere.name}
                    </button>
                  ))}
                </div>
              );
            }

            return (
              <button
                key={location._id}
                type="button"
                className={styles.districtButton}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  opacity: isDimmed ? 0.3 : 1,
                }}
                title={`${location.name}${hasOccupants ? ` (${location.occupantCount} presenti)` : ''}`}
                onClick={() => handleDistrictClick(location)}
              >
                {location.name}
                {hasOccupants && <span className={styles.occupantsIndicator} />}
              </button>
            );
          })}
        </div>
      </div>

      {popupEntity && (
        <QuartierePopup
          entity={popupEntity}
          locations={popupChildren}
          onClose={() => setPopupEntityId(null)}
        />
      )}
    </div>
  );
}
