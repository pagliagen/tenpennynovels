/**
 * API Client with Axios
 *
 * CRITICAL: Single source of truth for all API communication.
 *
 * Features:
 * - Automatic auth token injection via interceptors
 * - Request/response interceptors for logging and error handling
 * - Retry logic for transient failures
 * - Timeout handling and cancellation
 * - Error transformation into structured ApiError
 * - Performance metrics tracking (development only)
 *
 * @module lib/api/client
 * @since 2.0.0
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { API_CONFIG, AUTH_CONFIG } from '@/constants/config';
import { useUIStore } from '@/store/uiStore';

import { parseAxiosError, ApiError } from './errors';
import { logger } from '@/lib/logger';

/** Payload errore JSON tipico del backend (403, ecc.). */
interface ApiErrorBody {
  error?: string;
  message?: string;
  requiredPermission?: string;
  code?: string;
}

function asApiErrorBody(data: unknown): ApiErrorBody | null {
  if (data === null || typeof data !== 'object') return null;
  return data as ApiErrorBody;
}

/**
 * Remove persisted user data from localStorage
 *
 * L'auth reale è via cookie HttpOnly (`auth_token`), non gestita da JS.
 * Questa funzione ripulisce solo lo snapshot che il middleware `persist`
 * di Zustand salva per `authStore` (vedi USER_KEY in store/authStore.ts).
 * Chiamata su logout esplicito o quando un 401 rivela che la sessione
 * cookie non è più valida.
 * No-op durante il server-side rendering.
 *
 * @returns {void}
 * @public
 * @since 2.0.0
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_CONFIG.USER_KEY);
}

/**
 * Create Axios instance with base configuration
 *
 * Factory function that creates and configures an Axios instance with:
 * - Base URL from environment
 * - Request/response interceptors
 * - Auth token injection
 * - Performance tracking
 * - Error transformation
 *
 * @returns {AxiosInstance} Configured Axios instance
 * @private
 * @since 2.0.0
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    withCredentials: true, // Enable sending HTTP-only cookies
    headers: {
      'Content-Type': 'application/json',
    },
  });

  /**
   * Request Interceptor
   *
   * Executed before every request:
   * - Injects X-Session-Id header from sessionStorage (multi-tab support)
   * - Adds timestamp for performance tracking
   * - Transforms request errors to ApiError
   *
   * NOTE: Auth token is sent via HTTP-only cookie (withCredentials: true).
   * Bearer token injection is disabled because backend uses cookie-based auth.
   *
   * @since 2.0.0
   */
  client.interceptors.request.use(
    (config) => {
      // NOTE: Bearer token injection disabled - using HTTP-only cookies instead
      // const token = getAuthToken();
      // if (token) {
      //   config.headers.Authorization = `Bearer ${token}`;
      // }

      // NEW: Inject X-Session-Id header from sessionStorage (multi-tab character selection)
      // sessionId è opaco UUID salvato dal frontend dopo character selection
      // Backend valida ownership (session.userId === auth_token.userId)
      if (typeof window !== 'undefined') {
        const sessionId = sessionStorage.getItem('character_session_id');

        if (sessionId) {
          config.headers['X-Session-Id'] = sessionId;
        }
      }

      // Add request timestamp for performance tracking
      config.metadata = { startTime: Date.now() };

      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(parseAxiosError(error));
    }
  );

  /**
   * Response Interceptor
   *
   * Executed after every response (success or error):
   * - Logs performance metrics in development
   * - Transforms errors to ApiError
   * - Handles 401 by clearing auth tokens
   * - Logs errors in development
   *
   * @since 2.0.0
   */
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        logger.info(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
      }

      return response;
    },
    async (error: AxiosError) => {
      const apiError = parseAxiosError(error);

      // Handle 401 Unauthorized
      if (apiError.requiresAuth() && typeof window !== 'undefined') {
        // Dynamic import per evitare dipendenza circolare (authStore importa clearAuthToken da qui)
        const { useAuthStore } = await import('@/store/authStore');
        const wasAuthenticated = useAuthStore.getState().isAuthenticated;

        clearAuthToken();

        // Un 401 durante il check di sessione iniziale (utente non ancora
        // autenticato) è gestito da useAuth/AuthError con una schermata
        // dedicata: qui reagiamo solo se la sessione è scaduta a metà
        // dell'uso dell'app, quando finora si credeva autenticati.
        if (wasAuthenticated) {
          useAuthStore.getState().logout();
          const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
          window.location.href = `${landingUrl}`;
        }
      }

      // Handle 403 Forbidden - Show permission denied toast
      if (error.response?.status === 403) {
        const errorData = asApiErrorBody(error.response.data);
        const message =
          errorData?.error || errorData?.message || 'Non sei autorizzato ad eseguire questa operazione';

        // Show toast notification
        if (typeof window !== 'undefined') {
          useUIStore.getState().addToast({
            type: 'error',
            message: message,
            duration: 5000,
          });
        }

        // Log for debugging in development
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[Permission Denied]', { value: {
            url: error.config?.url,
            requiredPermission: errorData?.requiredPermission,
            code: errorData?.code,
          } });
        }
      }

      // Log errors in development with full context
      if (process.env.NODE_ENV === 'development') {
        logger.error('[API Error]', { value: {
          url: error.config?.url,
          category: apiError.category,
          status: apiError.statusCode,
          message: apiError.message,
          details: apiError.details,
        } });
      }

      return Promise.reject(apiError);
    }
  );

  return client;
};

/**
 * Singleton API client instance
 *
 * Pre-configured Axios instance used throughout the application.
 * Use this instead of creating new Axios instances.
 *
 * @constant
 * @type {AxiosInstance}
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * import { apiClient } from '@/lib/api/client';
 *
 * const response = await apiClient.get<User>('/users/me');
 * ```
 */
export const apiClient = createApiClient();

/**
 * Retry wrapper for API calls
 *
 * Automatically retries failed requests with exponential backoff.
 * Only retries network errors and server errors (5xx).
 * Does not retry auth, validation, or forbidden errors.
 *
 * @template T - Return type of the async function
 * @param {() => Promise<T>} fn - Async function to execute with retry logic
 * @param {number} [attempts=API_CONFIG.RETRY_ATTEMPTS] - Number of retry attempts
 * @param {number} [delay=API_CONFIG.RETRY_DELAY] - Initial delay between retries in ms
 * @returns {Promise<T>} Result of the async function
 * @throws {ApiError} If all retry attempts fail or error is not retryable
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const user = await withRetry(
 *   () => api.get<User>('/users/me'),
 *   3,  // 3 attempts
 *   1000 // 1 second initial delay
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = API_CONFIG.RETRY_ATTEMPTS,
  delay: number = API_CONFIG.RETRY_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const apiError = error instanceof ApiError ? error : parseAxiosError(error as AxiosError);

    // Don't retry if error is not retryable or no attempts left
    if (!apiError.isRetryable() || attempts <= 1) {
      throw apiError;
    }

    // Wait before retrying (exponential backoff: 1s, 2s, 4s, ...)
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry with reduced attempts and doubled delay
    return withRetry(fn, attempts - 1, delay * 2);
  }
}

/**
 * Type-safe API request wrapper
 *
 * Generic wrapper around apiClient.request with automatic type inference.
 * Extracts response.data and provides type safety.
 *
 * @template T - Expected response data type
 * @param {AxiosRequestConfig} config - Axios request configuration
 * @returns {Promise<T>} Typed response data
 * @throws {ApiError} If request fails
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const user = await request<User>({
 *   method: 'GET',
 *   url: '/users/me'
 * });
 * ```
 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.request<T>(config);
  return response.data;
}

/**
 * Convenience methods for common HTTP verbs
 *
 * Type-safe wrappers around the request function for standard HTTP methods.
 * Use these instead of apiClient directly for better type inference.
 *
 * @namespace api
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * // GET request
 * const user = await api.get<User>('/users/me');
 *
 * // POST request
 * const newUser = await api.post<User>('/users', { username: 'john' });
 *
 * // PUT request
 * const updated = await api.put<User>('/users/123', userData);
 *
 * // PATCH request
 * const patched = await api.patch<User>('/users/123', { status: 'active' });
 *
 * // DELETE request
 * await api.delete('/users/123');
 * ```
 */
export const api = {
  /**
   * Perform GET request
   *
   * @template T - Expected response type
   * @param {string} url - Request URL
   * @param {AxiosRequestConfig} [config] - Additional Axios config
   * @returns {Promise<T>} Typed response data
   */
  get: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'GET', url }),

  /**
   * Perform POST request
   *
   * @template T - Expected response type
   * @param {string} url - Request URL
   * @param {unknown} [data] - Request body data
   * @param {AxiosRequestConfig} [config] - Additional Axios config
   * @returns {Promise<T>} Typed response data
   */
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'POST', url, data }),

  /**
   * Perform PUT request
   *
   * @template T - Expected response type
   * @param {string} url - Request URL
   * @param {unknown} [data] - Request body data
   * @param {AxiosRequestConfig} [config] - Additional Axios config
   * @returns {Promise<T>} Typed response data
   */
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'PUT', url, data }),

  /**
   * Perform PATCH request
   *
   * @template T - Expected response type
   * @param {string} url - Request URL
   * @param {unknown} [data] - Request body data
   * @param {AxiosRequestConfig} [config] - Additional Axios config
   * @returns {Promise<T>} Typed response data
   */
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'PATCH', url, data }),

  /**
   * Perform DELETE request
   *
   * @template T - Expected response type
   * @param {string} url - Request URL
   * @param {AxiosRequestConfig} [config] - Additional Axios config
   * @returns {Promise<T>} Typed response data
   */
  delete: <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    request<T>({ ...config, method: 'DELETE', url }),
};

/**
 * Extend Axios config type to include metadata
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}
