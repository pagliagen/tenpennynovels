import { logger } from '@/lib/logger';
/**
 * URL Filter Encoding/Decoding Utilities
 *
 * Standard system for managing cross-page filters via URL hash.
 * Uses Base64 + JSON encoding for reversible, readable filter serialization.
 *
 * Use case: Link from user-list to character-list with pre-applied userId filter.
 *
 * @example
 * // Encode filter
 * const encoded = encodeFilter({ userId: "123", status: "active" });
 * // → "eyJ1c2VySWQiOiIxMjMiLCJzdGF0dXMiOiJhY3RpdmUifQ=="
 *
 * // Create link
 * <a href={`/characters#filter=${encoded}`}>View Characters</a>
 *
 * // Decode on target page
 * const filter = readFilterFromHash();
 * // → { userId: "123", status: "active" }
 *
 * @module lib/utils/urlFilters
 */

/**
 * Filter parameters type
 * Supports string, number, boolean, and string arrays
 */
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Encode filter object to Base64 URL-safe string
 *
 * Uses JSON serialization + Base64 encoding for reversible filter storage.
 * Safe for use in URL fragments (hash).
 *
 * @param filter - Filter object to encode
 * @returns Base64 encoded string, or empty string on error
 *
 * @example
 * encodeFilter({ userId: "699b676...", status: "active" })
 * // → "eyJ1c2VySWQiOiI2OTliNjc2Li4uIiwic3RhdHVzIjoiYWN0aXZlIn0="
 */
export function encodeFilter(filter: FilterParams): string {
  try {
    const json = JSON.stringify(filter);
    return btoa(json);  // Base64 encode
  } catch (error) {
    logger.error('[urlFilters] Encode error:', { error });
    return '';
  }
}

/**
 * Decode Base64 URL filter string to object
 *
 * Reverses Base64 encoding and JSON parsing.
 * Returns null on invalid input or decoding errors.
 *
 * @param encoded - Base64 encoded filter string
 * @returns Decoded filter object, or null on error
 *
 * @example
 * decodeFilter("eyJ1c2VySWQiOiIxMjMifQ==")
 * // → { userId: "123" }
 */
export function decodeFilter(encoded: string): FilterParams | null {
  try {
    const json = atob(encoded);  // Base64 decode
    return JSON.parse(json);
  } catch (error) {
    logger.error('[urlFilters] Decode error:', { error });
    return null;
  }
}

/**
 * Read filter from current URL hash
 *
 * Expects format: #filter=<base64-encoded-json>
 * Returns null if no filter in hash or SSR context.
 *
 * @returns Decoded filter object, or null if not present/invalid
 *
 * @example
 * // URL: /page#filter=eyJ1c2VySWQiOiIxMjMifQ==
 * readFilterFromHash()
 * // → { userId: "123" }
 */
export function readFilterFromHash(): FilterParams | null {
  // SSR guard
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash.replace('#', '');

  // Check if hash contains filter
  if (!hash.startsWith('filter=')) return null;

  const encoded = hash.replace('filter=', '');
  return decodeFilter(encoded);
}

/**
 * Update URL hash with filter
 *
 * Sets hash to #filter=<encoded> without triggering page reload.
 * Only updates hash portion of URL.
 *
 * @param filter - Filter object to set in URL
 *
 * @example
 * setFilterInHash({ userId: "123" });
 * // URL changes to: /page#filter=eyJ1c2VySWQiOiIxMjMifQ==
 */
export function setFilterInHash(filter: FilterParams): void {
  // SSR guard
  if (typeof window === 'undefined') return;

  const encoded = encodeFilter(filter);
  window.location.hash = `filter=${encoded}`;
}

/**
 * Clear filter from URL hash
 *
 * Removes hash entirely using history API (no reload).
 * Preserves pathname and query params.
 *
 * @example
 * // URL: /page#filter=abc123
 * clearFilterHash();
 * // URL: /page
 */
export function clearFilterHash(): void {
  // SSR guard
  if (typeof window === 'undefined') return;

  // Remove hash without reload
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

/**
 * Check if URL contains a filter
 *
 * @returns true if current URL has #filter=... hash
 */
export function hasFilterInHash(): boolean {
  if (typeof window === 'undefined') return false;

  const hash = window.location.hash.replace('#', '');
  return hash.startsWith('filter=');
}
