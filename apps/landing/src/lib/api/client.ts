/**
 * Enhanced API Client with Retry, Timeout, and Deduplication
 *
 * Provides a robust HTTP client for API communication with advanced error handling.
 *
 * **Key Features**:
 * - **Exponential Backoff Retry**: Retries failed requests up to 3 times with increasing delays (1s, 2s, 4s)
 * - **Timeout Handling**: 30-second default timeout prevents infinite waiting
 * - **Request Deduplication**: Prevents duplicate API calls from simultaneous requests (e.g., double-click submit)
 * - **Automatic Interceptors**: Request/response interceptors for logging and auth handling
 * - **Type Safety**: Fully typed with TypeScript generics
 * - **Error Classification**: Distinguishes between network errors, timeouts, and API errors
 *
 * **Architecture**:
 * ```
 * apiRequest()
 *   ↓
 * Check in-flight cache (deduplication)
 *   ↓
 * Run request interceptors
 *   ↓
 * apiRequestWithRetry() (up to 3 attempts)
 *   ↓
 * fetchWithTimeout() (30s timeout)
 *   ↓
 * Run response interceptors
 *   ↓
 * Parse and return ApiResponse<T>
 * ```
 *
 * @module lib/api/client
 */

import type { ApiResponse } from '@/types';
import { logger } from '@/lib/logger';

import { requestCache } from './cache';
import { interceptorManager, type RequestConfig } from './interceptors';
import { ApiError, NetworkError, TimeoutError, isRetryableError } from './errors';

/**
 * API client configuration
 *
 * @constant
 */
const API_CONFIG = {
  /** Base URL for all API requests */
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  /** Default request timeout in milliseconds */
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  /** Maximum number of retry attempts for failed requests */
  MAX_RETRIES: 3,
  /** Initial delay for exponential backoff (milliseconds) */
  INITIAL_RETRY_DELAY: 1000, // 1 second
} as const;

/**
 * Sleeps for a specified duration
 *
 * Utility function for implementing retry delays with exponential backoff.
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Resolves after the specified delay
 *
 * @example
 * ```typescript
 * await sleep(1000); // Wait 1 second
 * ```
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches a URL with timeout support
 *
 * Wraps the native `fetch()` with a timeout mechanism using `Promise.race()`.
 * If the request takes longer than the timeout, a `TimeoutError` is thrown.
 *
 * @param {string} url - URL to fetch
 * @param {RequestInit} [options] - Fetch options
 * @param {number} [timeout=30000] - Timeout in milliseconds (default: 30s)
 * @returns {Promise<Response>} Fetch Response object
 * @throws {TimeoutError} If request exceeds timeout duration
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetchWithTimeout('/api/users', { method: 'GET' }, 10000);
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.error('Request took too long');
 *   }
 * }
 * ```
 */
async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeout: number = API_CONFIG.DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // AbortController throws AbortError on timeout
    if ((error as Error).name === 'AbortError') {
      throw new TimeoutError(`Request to ${url} timed out after ${timeout}ms`);
    }

    // Network errors (DNS failure, no connection, etc.)
    throw new NetworkError((error as Error).message || 'Network request failed');
  }
}

/**
 * Executes an API request with exponential backoff retry logic
 *
 * Attempts the request up to `MAX_RETRIES + 1` times (initial attempt + 3 retries).
 * Only retries on retryable errors (network errors, timeouts, 5xx, 408, 429).
 *
 * **Retry Schedule** (exponential backoff):
 * - Attempt 1: Immediate
 * - Attempt 2: Wait 1 second
 * - Attempt 3: Wait 2 seconds
 * - Attempt 4: Wait 4 seconds
 *
 * @template T - Type of the API response data
 * @param {RequestConfig} config - Request configuration with URL, method, body, etc.
 * @returns {Promise<ApiResponse<T>>} Parsed API response
 * @throws {ApiError | NetworkError | TimeoutError} If all retry attempts fail
 *
 * @example
 * ```typescript
 * const config: RequestConfig = {
 *   url: 'http://localhost:8000/auth/login',
 *   method: 'POST',
 *   body: JSON.stringify({ username, password }),
 * };
 *
 * const response = await apiRequestWithRetry<User>(config);
 * if (response.result) {
 *   console.log('User:', response.data);
 * }
 * ```
 */
async function apiRequestWithRetry<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= API_CONFIG.MAX_RETRIES; attempt++) {
    try {
      // Exponential backoff: 0ms, 1s, 2s, 4s
      if (attempt > 0) {
        const delay = API_CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        logger.debug(`[API Retry] Attempt ${attempt + 1}/${API_CONFIG.MAX_RETRIES + 1} after ${delay}ms delay`);
        await sleep(delay);
      }

      // Peel url/timeout so fetch() never receives non-RequestInit fields; force credentials last
      const { url: requestUrl, timeout: requestTimeout, ...fetchInit } = config;

      const response = await fetchWithTimeout(
        requestUrl,
        {
          ...fetchInit,
          credentials: 'include',
        },
        requestTimeout || API_CONFIG.DEFAULT_TIMEOUT
      );

      // Run response interceptors
      const interceptedResponse = await interceptorManager.runResponseInterceptors(response);

      // Parse JSON response
      const data: ApiResponse<T> = await interceptedResponse.json();

      // DEV ONLY: Extract dev headers and attach to response
      if (process.env.NODE_ENV === 'development') {
        const devHeaders: Record<string, string> = {};
        interceptedResponse.headers.forEach((value, key) => {
          if (key.toLowerCase().startsWith('x-dev-')) {
            devHeaders[key] = value;
          }
        });
        if (Object.keys(devHeaders).length > 0) {
          data.__devHeaders = devHeaders;
        }
      }

      // If response is not OK (4xx, 5xx), throw ApiError
      if (!interceptedResponse.ok) {
        throw new ApiError(
          data.code || 'UNKNOWN_ERROR',
          interceptedResponse.status,
          data.details
        );
      }

      // Success - return data
      return data;
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this is the last attempt
      if (attempt === API_CONFIG.MAX_RETRIES) {
        break;
      }

      // Only retry if error is retryable (network, timeout, 5xx, 408, 429)
      if (!isRetryableError(error)) {
        break;
      }

      // Continue to next retry attempt
      logger.warn(`[API] Retryable error on attempt ${attempt + 1}`, { error });
    }
  }

  // All retries failed - return ApiResponse with success: false
  // This prevents crashes and allows components to handle errors gracefully
  const error = lastError as NetworkError | ApiError | TimeoutError | Error;

  return {
    success: false,
    error: error.message || 'Errore di connessione',
    code: 'code' in error ? error.code : 'NETWORK_ERROR',
    message: error.message || 'Impossibile connettersi al server. Controlla la tua connessione internet.',
    details: 'details' in error ? error.details : undefined,
    timestamp: new Date().toISOString(),
  } as ApiResponse<T>;
}

/**
 * Main API request function with deduplication
 *
 * This is the primary function for making API calls. It handles:
 * 1. **Request deduplication**: Prevents duplicate in-flight requests
 * 2. **Request interceptors**: Adds auth headers, logging, etc.
 * 3. **Retry logic**: Exponential backoff for transient failures
 * 4. **Timeout handling**: Prevents infinite waiting
 * 5. **Response interceptors**: Handles 401 redirects, logging, etc.
 *
 * **Request Deduplication**:
 * If the same endpoint is called multiple times before the first request completes
 * (e.g., user double-clicks submit button), only ONE actual HTTP request is made.
 * All callers receive the same promise.
 *
 * @template T - Type of the expected response data
 * @param {string} endpoint - API endpoint path (e.g., '/auth/login', '/characters')
 * @param {RequestInit} [options] - Fetch options (method, headers, body, etc.)
 * @returns {Promise<ApiResponse<T>>} API response with result, data, error, etc.
 *
 * @example
 * ```typescript
 * // GET request
 * const response = await apiRequest<Character[]>('/characters');
 * if (response.result) {
 *   console.log('Characters:', response.list);
 * }
 *
 * // POST request
 * const loginResponse = await apiRequest<User>('/auth/login', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ username, password }),
 * });
 * ```
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const method = options?.method || 'GET';
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  // Build request config
  const config: RequestConfig = {
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  };

  // Generate cache key for deduplication
  const cacheKey = requestCache.getCacheKey(endpoint, method, options?.body);

  // Check if this request is already in-flight
  const cachedPromise = requestCache.get<T>(cacheKey);
  if (cachedPromise) {
    logger.debug(`[API Cache] Using cached promise for ${method} ${endpoint}`);
    return cachedPromise;
  }

  // Run request interceptors
  const interceptedConfig = await interceptorManager.runRequestInterceptors(config);

  // Create new request promise
  const requestPromise = apiRequestWithRetry<T>(interceptedConfig);

  // Store in cache for deduplication
  requestCache.set(cacheKey, requestPromise);

  return requestPromise;
}

/**
 * Performs a GET request
 *
 * Convenience wrapper around `apiRequest()` for GET requests.
 *
 * @template T - Type of the expected response data
 * @param {string} endpoint - API endpoint path
 * @param {RequestInit} [options] - Additional fetch options (headers, etc.)
 * @returns {Promise<ApiResponse<T>>} API response
 *
 * @example
 * ```typescript
 * const response = await apiGet<Character[]>('/characters');
 * if (response.result && response.list) {
 *   console.log('Found', response.list.length, 'characters');
 * }
 * ```
 */
export function apiGet<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * Performs a POST request
 *
 * Convenience wrapper around `apiRequest()` for POST requests.
 * Automatically serializes body to JSON if it's an object.
 *
 * @template T - Type of the expected response data
 * @param {string} endpoint - API endpoint path
 * @param {any} [body] - Request body (will be JSON.stringify'd if object)
 * @param {RequestInit} [options] - Additional fetch options (headers, etc.)
 * @returns {Promise<ApiResponse<T>>} API response
 *
 * @example
 * ```typescript
 * const response = await apiPost<User>('/auth/login', {
 *   username: 'john',
 *   password: 'secret123'
 * });
 * ```
 */
export function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Performs a PUT request
 *
 * Convenience wrapper around `apiRequest()` for PUT requests.
 * Automatically serializes body to JSON if it's an object.
 *
 * @template T - Type of the expected response data
 * @param {string} endpoint - API endpoint path
 * @param {any} [body] - Request body (will be JSON.stringify'd if object)
 * @param {RequestInit} [options] - Additional fetch options (headers, etc.)
 * @returns {Promise<ApiResponse<T>>} API response
 *
 * @example
 * ```typescript
 * const response = await apiPut<Character>('/characters/123', {
 *   name: 'Updated Name',
 *   age: 30
 * });
 * ```
 */
export function apiPut<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Performs a PATCH request
 *
 * Convenience wrapper around `apiRequest()` for PATCH requests.
 * Automatically serializes body to JSON if it's an object.
 *
 * @template T - Type of the expected response data
 * @param {string} endpoint - API endpoint path
 * @param {any} [body] - Request body (will be JSON.stringify'd if object)
 * @param {RequestInit} [options] - Additional fetch options (headers, etc.)
 * @returns {Promise<ApiResponse<T>>} API response
 *
 * @example
 * ```typescript
 * const response = await apiPatch<Character>('/characters/123', {
 *   description: 'Updated description only'
 * });
 * ```
 */
export function apiPatch<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Performs a DELETE request
 *
 * Convenience wrapper around `apiRequest()` for DELETE requests.
 *
 * @template T - Type of the expected response data
 * @param {string} endpoint - API endpoint path
 * @param {RequestInit} [options] - Additional fetch options (headers, etc.)
 * @returns {Promise<ApiResponse<T>>} API response
 *
 * @example
 * ```typescript
 * const response = await apiDelete<void>('/characters/123');
 * if (response.result) {
 *   console.log('Character deleted successfully');
 * }
 * ```
 */
export function apiDelete<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}
