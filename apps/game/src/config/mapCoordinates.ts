/**
 * Map Coordinates Configuration
 *
 * SVG Polygon coordinates for London Map districts.
 * Coordinates are percentage-based (0-100) matching SVG viewBox.
 *
 * Source: Traced from london.png (1536x1024)
 * Format: "x1,y1 x2,y2 x3,y3 ..." (SVG polygon points)
 *
 * @module config/mapCoordinates
 * @since 2.0.0
 */

import { DistrictCoordinates } from '@/types/location';

/**
 * District Polygon Coordinates (Slug-Based)
 *
 * Maps location slug to SVG polygon coordinates.
 * Slugs are stable and deterministic (generated from location names).
 *
 * Layout: 4 horizontal bands, north to south.
 * - Band 1 (y 22-44): West End | Central London | East End, side by side
 * - Band 2 (y 45-62): River Wards, full width (follows the Thames)
 * - Band 3 (y 63-79): Suburbs, full width
 * - Band 4 (y 80-97): Country Side, full width
 *
 * **ADVANTAGES**:
 * - Stable across database seeds/migrations
 * - Human-readable (easy debugging)
 * - SEO-friendly (matches URL patterns)
 * - Deterministic (always same for same name)
 */
export const DISTRICT_POLYGONS: Record<string, string> = {
  // West End - Wealthy, shopping and theatre district (band 1, left)
  'west-end': '4,22 34,22 34,44 4,44',

  // Central London - Government, financial and legal core (band 1, center)
  'central-london': '35,22 65,22 65,44 35,44',

  // East End - Working class, industrial district (band 1, right)
  'east-end': '66,22 96,22 96,44 66,44',

  // River Wards - Docks and riverside wards along the Thames (band 2, full width)
  'river-wards': '4,45 96,45 96,62 4,62',

  // Suburbs - Residential districts just outside the center (band 3, full width)
  'suburbs': '4,63 96,63 96,79 4,79',

  // Country Side - Rural outskirts of London (band 4, full width)
  'country-side': '4,80 96,80 96,97 4,97',
};

/**
 * District Center Points (for tooltip positioning)
 *
 * Defines the center point of each district for better UX.
 * Tooltips and occupant indicators appear at these coordinates.
 */
export const DISTRICT_CENTERS: Record<string, { x: number; y: number }> = {
  'west-end': { x: 19, y: 33 },
  'central-london': { x: 50, y: 33 },
  'east-end': { x: 81, y: 33 },
  'river-wards': { x: 50, y: 53 },
  'suburbs': { x: 50, y: 71 },
  'country-side': { x: 50, y: 88 },
};

/**
 * Get district coordinates by location slug
 *
 * @param slug - Location.slug (e.g., 'westminster', 'southwark')
 * @returns District coordinates or undefined if not found
 */
export function getDistrictCoordinates(
  slug: string
): DistrictCoordinates | undefined {
  const polygon = DISTRICT_POLYGONS[slug];
  const center = DISTRICT_CENTERS[slug];

  if (!polygon || !center) {
    return undefined;
  }

  return { polygon, center };
}

/**
 * Check if a location has map coordinates
 *
 * @param slug - Location.slug (e.g., 'westminster', 'southwark')
 * @returns True if location has polygon coordinates
 */
export function hasMapCoordinates(slug: string): boolean {
  return slug in DISTRICT_POLYGONS;
}

/**
 * Get all district slugs with coordinates
 *
 * @returns Array of location slugs that have map polygons
 */
export function getDistrictSlugs(): string[] {
  return Object.keys(DISTRICT_POLYGONS);
}
