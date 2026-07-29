/**
 * Locations Map Component
 *
 * Interactive London map with clickable district polygons.
 *
 * Features:
 * - SVG polygon overlays for districts
 * - CSS-only tooltips on hover
 * - Clickable london_label.png (return to London)
 * - Occupant indicators (red dots)
 * - Victorian theme styling
 *
 * @module components/locations/LocationsMap
 * @since 2.0.0
 */

'use client';

import Image from 'next/image';
import { useState } from 'react';

import {
  getDistrictCoordinates,
  hasMapCoordinates,
} from '@/config/mapCoordinates';
import styles from '@/styles/components/locations/map.module.scss';
import type { AccessibleLocation } from '@/types/location';

/**
 * Locations Map Props
 */
interface LocationsMapProps {
  /** Array of accessible locations */
  locations: AccessibleLocation[];
  /** Callback when district is clicked (receives slug) */
  onDistrictClick: (slug: string) => void;
  /** Optional callback when London label is clicked */
  onLondonClick?: () => void;
}

/**
 * Locations Map Component
 *
 * Renders interactive London map with clickable districts.
 *
 * @component
 * @param {LocationsMapProps} props - Component props
 * @returns {JSX.Element} London map
 *
 * @example
 * ```tsx
 * <LocationsMap
 *   locations={locations}
 *   onDistrictClick={(id) => router.push(`/locations/${id}`)}
 * />
 * ```
 */
export function LocationsMap({
  locations,
  onDistrictClick 
}: LocationsMapProps): JSX.Element {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);

  // Filter locations that have map coordinates (districts only)
  const districtsWithCoords = locations.filter((loc) =>
    hasMapCoordinates(loc.slug)
  );

  return (
    <div className={styles.mapContainer}>
      <div className={styles.mapWrapper}>
        {/* Main London Map Image */}
        <div className={styles.mapImageWrapper}>
          <Image
            src="/locations/london.png"
            alt="Mappa di Londra 1889"
            width={1536}
            height={1024}
            className={styles.mapImage}
            priority
          />

          {/* SVG Overlay with Clickable Polygons */}
          <svg
            className={styles.svgOverlay}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Subtle glow filters */}
            <defs>
              <filter
                id="subtleGlow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="0.8" result="softBlur" />
                <feColorMatrix
                  in="softBlur"
                  type="matrix"
                  values="1 0 0 0 0.85  0 1 0 0 0.7  0 0 1 0 0.25  0 0 0 0.4 0"
                  result="subtleGold"
                />
                <feMerge>
                  <feMergeNode in="subtleGold" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter
                id="whisperLight"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="0.5" result="whisperBlur" />
                <feColorMatrix
                  in="whisperBlur"
                  type="matrix"
                  values="1 0 0 0 0.9  0 1 0 0 0.8  0 0 1 0 0.4  0 0 0 0.25 0"
                  result="whisperGold"
                />
                <feMerge>
                  <feMergeNode in="whisperGold" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Render district polygons */}
            {districtsWithCoords.map((location) => {
              const coords = getDistrictCoordinates(location.slug);
              if (!coords) return null;

              const isHovered = hoveredDistrict === location._id;
              const hasOccupants = (location.occupantCount || 0) > 0;

              return (
                <g key={location._id}>
                  {/* Clickable polygon area */}
                  <polygon
                    points={coords.polygon}
                    fill="transparent"
                    stroke={isHovered ? '#d4af37' : 'transparent'}
                    strokeWidth={isHovered ? '0.3' : '0'}
                    onMouseEnter={() => setHoveredDistrict(location._id)}
                    onMouseLeave={() => setHoveredDistrict(null)}
                    onClick={() => onDistrictClick(location.slug)}
                    className={styles.districtPolygon}
                    data-tooltip={`${location.name}${hasOccupants ? ` (${location.occupantCount} presenti)` : ''}`}
                  />

                  {/* Hover glow effect */}
                  {isHovered && (
                    <>
                      <polygon
                        points={coords.polygon}
                        fill="none"
                        stroke="#d4af37"
                        strokeWidth="0.6"
                        opacity="0.2"
                        filter="url(#subtleGlow)"
                        className={styles.glowBorder}
                        pointerEvents="none"
                      />
                      <polygon
                        points={coords.polygon}
                        fill="none"
                        stroke="#f4e4a6"
                        strokeWidth="0.4"
                        strokeDasharray="4 6"
                        opacity="0.15"
                        filter="url(#whisperLight)"
                        className={styles.rotatingLight}
                        pointerEvents="none"
                      />
                    </>
                  )}

                  {/* Occupant indicator (red dot) */}
                  {hasOccupants && (
                    <circle
                      cx={coords.center.x}
                      cy={coords.center.y}
                      r="2"
                      fill="#ff6b35"
                      stroke="#ffffff"
                      strokeWidth="0.5"
                      opacity="0.9"
                      className={styles.occupantsIndicator}
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend - District list */}
      <div className={styles.legend}>
        <div className={styles.legendTitle}>Quartieri di Londra</div>
        <div className={styles.legendItems}>
          {districtsWithCoords.map((location) => (
            <div
              key={location._id}
              className={`${styles.legendItem} ${
                hoveredDistrict === location._id ? styles.legendHighlighted : ''
              }`}
              onMouseEnter={() => setHoveredDistrict(location._id)}
              onMouseLeave={() => setHoveredDistrict(null)}
              onClick={() => onDistrictClick(location.slug)}
            >
              <div className={styles.legendDot}></div>
              <span className={styles.legendLabel}>{location.name}</span>
              {(location.occupantCount || 0) > 0 && (
                <span className={styles.legendOccupants}>
                  ({location.occupantCount})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
