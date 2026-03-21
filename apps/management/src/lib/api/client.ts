/**
 * API Client - Axios singleton with interceptors
 *
 * Provides:
 * - HTTP-only cookie authentication
 * - Automatic retry with exponential backoff
 * - 401 redirect to landing login
 * - Request/response logging
 * - Error standardization
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG } from '@/constants/config';
import { ApiError, ApiResponse } from '@/types/api/common';

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create Axios instance with default configuration
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // CRITICAL: HTTP-only cookie auth
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Request interceptor - Add auth headers if needed
 */
apiClient.interceptors.request.use(
  config => {
    // Add X-Session-Id header from sessionStorage (multi-tab support)
    if (typeof window !== 'undefined') {
      const sessionId = sessionStorage.getItem('character_session_id');
      if (sessionId) {
        config.headers['X-Session-Id'] = sessionId;
      }
    }

    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => Promise.reject(error)
);

/**
 * Response interceptor - Handle errors and 401 redirects
 */
apiClient.interceptors.response.use(
  response => {
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  (error: AxiosError) => {
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[API Error]`, error);
    }

    // Handle 401 - Redirect to landing login
    // CRITICAL: Login è gestito da apps/landing, non nel management
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = `${API_CONFIG.LANDING_URL}/auth/login`;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = API_CONFIG.RETRY_COUNT,
  baseDelay: number = API_CONFIG.RETRY_DELAY
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (except 408 Request Timeout and 429 Too Many Requests)
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          throw error;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Retry] Attempt ${attempt + 1}/${retries} failed, retrying in ${delay}ms...`);
        }
        await sleep(delay);
      }
    }
  }

  // Transform Axios error into user-friendly format before throwing
  if (axios.isAxiosError(lastError)) {
    const status = lastError.response?.status;
    const errorData = lastError.response?.data;

    throw new Error(
      errorData?.error ||
      errorData?.message ||
      lastError.message ||
      `Request failed with status ${status || 'unknown'}`
    );
  }

  throw lastError;
}

/**
 * Type-safe API wrapper functions
 */

/**
 * GET request
 */
export async function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response = await withRetry(() => apiClient.get<ApiResponse<T>>(url, config));
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * POST request
 */
export async function post<T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response = await withRetry(() => apiClient.post<ApiResponse<T>>(url, data, config));
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * PUT request
 */
export async function put<T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response = await withRetry(() => apiClient.put<ApiResponse<T>>(url, data, config));
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * PATCH request
 */
export async function patch<T = unknown, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response = await withRetry(() => apiClient.patch<ApiResponse<T>>(url, data, config));
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * DELETE request
 */
export async function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  try {
    const response = await withRetry(() => apiClient.delete<ApiResponse<T>>(url, config));
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Normalize error to ApiError
 */
function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Request failed';
    const statusCode = error.response?.status;
    const details = error.response?.data;

    return new ApiError(message, statusCode, details);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError('An unknown error occurred');
}

/**
 * Build query string from params object
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Export default API object with all methods
 */
export const api = {
  get,
  post,
  put,
  patch,
  delete: del,
  buildQueryString
};
