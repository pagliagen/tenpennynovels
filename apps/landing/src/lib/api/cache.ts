/**
 * In-Flight Request Cache for Request Deduplication
 *
 * Prevents duplicate API requests by caching promises for in-flight requests.
 * If multiple components request the same endpoint simultaneously, only one
 * actual HTTP request is made and the promise is shared.
 *
 * Cache entries expire after 1 second to prevent stale data issues.
 *
 * @module lib/api/cache
 */

import type { ApiResponse } from '@/types';

/**
 * Cache entry structure
 *
 * @interface CacheEntry
 * @template T - Type of the API response data
 */
interface CacheEntry<T> {
  /** The in-flight promise for this request */
  promise: Promise<ApiResponse<T>>;
  /** Timestamp when the cache entry was created (ms since epoch) */
  timestamp: number;
}

/**
 * Request cache manager
 *
 * Manages a Map of in-flight API requests to prevent duplicate network calls.
 * Uses endpoint + method + body as cache key for uniqueness.
 *
 * @class RequestCache
 *
 * @example
 * ```typescript
 * const cache = new RequestCache();
 *
 * // First request - makes actual HTTP call
 * const promise1 = apiRequest('/users');
 * cache.set('GET_/users_', promise1);
 *
 * // Second request (within 1 second) - reuses promise
 * const cachedPromise = cache.get('GET_/users_');
 * if (cachedPromise) {
 *   return cachedPromise; // No duplicate HTTP request
 * }
 * ```
 */
class RequestCache {
  /**
   * Internal cache storage
   * Map key format: "{METHOD}_{endpoint}_{JSON.stringify(body)}"
   */
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Maximum age for cache entries in milliseconds
   * After this time, cached promises are considered stale and removed
   */
  private readonly MAX_AGE = 1000; // 1 second

  /**
   * Generates a unique cache key for a request
   *
   * @param {string} endpoint - API endpoint path (e.g., '/auth/login')
   * @param {string} method - HTTP method (e.g., 'GET', 'POST')
   * @param {any} [body] - Optional request body (for POST/PUT/PATCH)
   * @returns {string} Unique cache key
   *
   * @example
   * ```typescript
   * const key = cache.getCacheKey('/users', 'GET');
   * // Returns: "GET_/users_"
   *
   * const key2 = cache.getCacheKey('/users', 'POST', { name: 'John' });
   * // Returns: "POST_/users_{\"name\":\"John\"}"
   * ```
   */
  getCacheKey(endpoint: string, method: string, body?: any): string {
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}_${endpoint}_${bodyStr}`;
  }

  /**
   * Retrieves a cached promise if available and not expired
   *
   * @template T - Type of the API response data
   * @param {string} key - Cache key from getCacheKey()
   * @returns {Promise<ApiResponse<T>> | null} Cached promise or null if not found/expired
   *
   * @example
   * ```typescript
   * const cachedPromise = cache.get<User>('GET_/users/123_');
   * if (cachedPromise) {
   *   const result = await cachedPromise;
   *   console.log('Using cached response:', result);
   * }
   * ```
   */
  get<T>(key: string): Promise<ApiResponse<T>> | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry is still valid (not expired)
    const age = Date.now() - entry.timestamp;
    if (age > this.MAX_AGE) {
      this.cache.delete(key);
      return null;
    }

    return entry.promise;
  }

  /**
   * Stores a promise in the cache
   *
   * Automatically sets up cleanup:
   * - Removes entry after MAX_AGE milliseconds post-resolution
   * - Ensures cache doesn't grow indefinitely
   *
   * @template T - Type of the API response data
   * @param {string} key - Cache key from getCacheKey()
   * @param {Promise<ApiResponse<T>>} promise - The in-flight request promise
   *
   * @example
   * ```typescript
   * const promise = apiRequest('/users');
   * cache.set('GET_/users_', promise);
   * ```
   */
  set<T>(key: string, promise: Promise<ApiResponse<T>>): void {
    this.cache.set(key, {
      promise,
      timestamp: Date.now(),
    });

    // Auto-cleanup after resolution
    promise.finally(() => {
      // Keep in cache for MAX_AGE after resolution to allow sharing
      setTimeout(() => {
        this.cache.delete(key);
      }, this.MAX_AGE);
    });
  }

  /**
   * Clears all cached entries
   *
   * Useful for testing or when user logs out and cache should be invalidated.
   *
   * @example
   * ```typescript
   * // On logout
   * cache.clear();
   * ```
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Singleton instance of RequestCache
 *
 * Export a single instance to be shared across the entire application.
 * This ensures all API calls benefit from deduplication.
 *
 * @constant
 * @type {RequestCache}
 */
export const requestCache = new RequestCache();
