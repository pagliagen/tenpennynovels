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
 * **ADVANTAGES**:
 * - Stable across database seeds/migrations
 * - Human-readable (easy debugging)
 * - SEO-friendly (matches URL patterns)
 * - Deterministic (always same for same name)
 */
export const DISTRICT_POLYGONS: Record<string, string> = {
  // Westminster - Central district, government area
  'westminster': '25,35 45,32 48,45 45,48 40,50 25,48',

  // Oldtown - Historic district, financial center
  'oldtown': '48,32 68,30 72,42 68,46 62,48 48,45',

  // Mayfair-Marylebone - Wealthy residential area
  'mayfair-marylebone': '8,25 25,23 25,35 25,48 18,50 8,45',

  // East-End - Working class district
  'east-end': '72,30 92,28 95,40 90,45 85,47 72,42',

  // Southwark - South of Thames, theaters and markets
  'southwark': '20,52 80,50 85,62 78,68 70,70 20,68 15,60',

  // Boroughs - Diverse districts (Kensington, Chelsea, Bloomsbury, etc.)
  'boroughs': '10,60 20,68 30,75 40,75 50,70 40,65 30,60 20,58',
};

/**
 * District Center Points (for tooltip positioning)
 *
 * Defines the center point of each district for better UX.
 * Tooltips and occupant indicators appear at these coordinates.
 */
export const DISTRICT_CENTERS: Record<string, { x: number; y: number }> = {
  'westminster': { x: 36, y: 42 },
  'oldtown': { x: 58, y: 39 },
  'mayfair-marylebone': { x: 17, y: 37 },
  'east-end': { x: 82, y: 38 },
  'southwark': { x: 50, y: 60 },
  'boroughs': { x: 25, y: 67 },
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
