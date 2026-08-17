/**
 * Request/Response Interceptors System
 *
 * Provides a middleware system for globally handling API requests and responses.
 * Interceptors can modify requests before they are sent and responses before they are returned.
 *
 * Use cases:
 * - Adding authentication headers to all requests
 * - Logging API calls in development mode
 * - Handling global errors (401 redirects, session expiry)
 * - Transforming request/response data
 * - Monitoring performance
 *
 * @module lib/api/interceptors
 */

import { logger } from '@/lib/logger';

/**
 * Extended RequestInit with additional configuration
 *
 * @interface RequestConfig
 * @extends RequestInit
 */
export interface RequestConfig extends RequestInit {
  /** Full URL for the request (including base URL) */
  url: string;
  /** Optional timeout in milliseconds (overrides default) */
  timeout?: number;
}

/**
 * Request interceptor function signature
 *
 * Interceptors can modify the request config before the request is sent.
 * They can be synchronous or asynchronous.
 *
 * @typedef {Function} RequestInterceptor
 * @param {RequestConfig} config - Current request configuration
 * @returns {RequestConfig | Promise<RequestConfig>} Modified request config
 *
 * @example
 * ```typescript
 * const authInterceptor: RequestInterceptor = (config) => {
 *   config.headers = {
 *     ...config.headers,
 *     'Authorization': `Bearer ${token}`
 *   };
 *   return config;
 * };
 * ```
 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

/**
 * Response interceptor function signature
 *
 * Interceptors can process responses before they are returned to the caller.
 * They can be synchronous or asynchronous.
 *
 * @typedef {Function} ResponseInterceptor
 * @param {Response} response - Fetch API Response object
 * @returns {Response | Promise<Response>} Response (original or modified)
 *
 * @example
 * ```typescript
 * const loggingInterceptor: ResponseInterceptor = (response) => {
 *   console.log(`Response status: ${response.status}`);
 *   return response;
 * };
 * ```
 */
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

/**
 * Interceptor Manager
 *
 * Manages request and response interceptors for the API client.
 * Interceptors are executed in the order they were registered.
 *
 * @class InterceptorManager
 *
 * @example
 * ```typescript
 * const manager = new InterceptorManager();
 *
 * // Add request interceptor
 * const unregister = manager.useRequestInterceptor((config) => {
 *   config.headers = { ...config.headers, 'X-Custom': 'value' };
 *   return config;
 * });
 *
 * // Later, remove the interceptor
 * unregister();
 *
 * // Run all interceptors
 * const config = await manager.runRequestInterceptors(initialConfig);
 * ```
 */
class InterceptorManager {
  /**
   * Array of registered request interceptors
   * Interceptors are executed in registration order
   */
  private requestInterceptors: RequestInterceptor[] = [];

  /**
   * Array of registered response interceptors
   * Interceptors are executed in registration order
   */
  private responseInterceptors: ResponseInterceptor[] = [];

  /**
   * Registers a new request interceptor
   *
   * @param {RequestInterceptor} interceptor - Interceptor function to register
   * @returns {() => void} Unregister function - call to remove this interceptor
   *
   * @example
   * ```typescript
   * const unregister = manager.useRequestInterceptor((config) => {
   *   console.log('Sending request to:', config.url);
   *   return config;
   * });
   *
   * // Later, to remove the interceptor:
   * unregister();
   * ```
   */
  useRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);

    // Return unregister function
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Registers a new response interceptor
   *
   * @param {ResponseInterceptor} interceptor - Interceptor function to register
   * @returns {() => void} Unregister function - call to remove this interceptor
   *
   * @example
   * ```typescript
   * const unregister = manager.useResponseInterceptor(async (response) => {
   *   if (response.status === 401) {
   *     console.log('Unauthorized - redirecting to login');
   *   }
   *   return response;
   * });
   *
   * // Later, to remove the interceptor:
   * unregister();
   * ```
   */
  useResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);

    // Return unregister function
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  /**
   * Executes all registered request interceptors in sequence
   *
   * Each interceptor receives the config from the previous interceptor.
   * If any interceptor throws an error, the chain is interrupted.
   *
   * @param {RequestConfig} config - Initial request configuration
   * @returns {Promise<RequestConfig>} Final request config after all interceptors
   *
   * @example
   * ```typescript
   * const initialConfig = { url: '/api/users', method: 'GET' };
   * const finalConfig = await manager.runRequestInterceptors(initialConfig);
   * // finalConfig may have been modified by interceptors
   * ```
   */
  async runRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let currentConfig = config;

    for (const interceptor of this.requestInterceptors) {
      currentConfig = await interceptor(currentConfig);
    }

    return currentConfig;
  }

  /**
   * Executes all registered response interceptors in sequence
   *
   * Each interceptor receives the response from the previous interceptor.
   * If any interceptor throws an error, the chain is interrupted.
   *
   * @param {Response} response - Initial Fetch API Response object
   * @returns {Promise<Response>} Final response after all interceptors
   *
   * @example
   * ```typescript
   * const response = await fetch(url);
   * const processedResponse = await manager.runResponseInterceptors(response);
   * // processedResponse may have been handled by interceptors
   * ```
   */
  async runResponseInterceptors(response: Response): Promise<Response> {
    let currentResponse = response;

    for (const interceptor of this.responseInterceptors) {
      currentResponse = await interceptor(currentResponse);
    }

    return currentResponse;
  }
}

/**
 * Singleton instance of InterceptorManager
 *
 * Export a single instance to be shared across the entire application.
 * This ensures all API calls use the same interceptor configuration.
 *
 * @constant
 * @type {InterceptorManager}
 */
export const interceptorManager = new InterceptorManager();

/** Paths where a 401 should not force redirect to login (token flows, auth forms). */
const AUTH_FLOW_EXACT_PATHS = ['/', '/register', '/forgot-password'] as const;

const AUTH_FLOW_PREFIXES = ['/reset-password', '/delete-account'] as const;

function isAuthFlowPath(pathname: string): boolean {
  if (AUTH_FLOW_EXACT_PATHS.includes(pathname as (typeof AUTH_FLOW_EXACT_PATHS)[number])) {
    return true;
  }
  return AUTH_FLOW_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Default Request Interceptor - Development Logging
 *
 * Logs all outgoing API requests in development mode.
 * Note: Authentication is handled via cookies (credentials: 'include'),
 * so no manual Authorization header is added.
 */
interceptorManager.useRequestInterceptor((config) => {
  logger.debug(`[API Request] ${config.method || 'GET'} ${config.url}`);

  return config;
});

/**
 * Request Interceptor - Session ID Header
 *
 * Attaches X-Session-Id header from sessionStorage to all requests.
 * Required for multi-tab session isolation.
 *
 * **Multi-Tab Flow**:
 * - sessionId stored in sessionStorage (isolated per tab)
 * - Backend validates session ownership (session.userId === auth_token.userId)
 * - Prevents cross-tab character contamination
 */
interceptorManager.useRequestInterceptor((config) => {
  // Only run on client-side
  if (typeof window !== 'undefined') {
    const sessionId = sessionStorage.getItem('character_session_id');
    if (sessionId) {
      config.headers = {
        ...config.headers,
        'X-Session-Id': sessionId,
      };

      logger.debug('[API Interceptor] Attached X-Session-Id', { sessionId });
    }
  }

  return config;
});

/**
 * Default Response Interceptor - Auth Error Handling
 *
 * Handles global authentication errors and development logging.
 *
 * **401 Unauthorized Handling**:
 * - Detects expired sessions
 * - Clears any local state
 * - Redirects user to login page (/)
 *
 * **Development Logging**:
 * - Logs all API responses with status code and URL
 */
interceptorManager.useResponseInterceptor(async (response) => {
  logger.debug(`[API Response] ${response.status} ${response.url}`);

  // Handle 401 - Unauthorized (session expired)
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;

      if (!isAuthFlowPath(currentPath)) {
        window.location.href = '/';
      }
    }
  }

  return response;
});
