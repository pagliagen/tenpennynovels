/**
 * API Error Handling System
 *
 * CRITICAL: Provides type-safe error handling with proper classification.
 * All API errors must flow through this system for consistent handling.
 *
 * @module lib/api/errors
 * @since 2.0.0
 */

import { AxiosError } from 'axios';
import { z } from 'zod';

/**
 * Error Response Schema from Backend
 *
 * Validates the structure of error responses returned by the API.
 * Backend returns: { error: string, details?: unknown, code?: string, statusCode?: number }
 *
 * @constant
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const result = ErrorResponseSchema.safeParse(response.data);
 * if (result.success) {
 *   logger.error(result.data.error);
 * }
 * ```
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
  code: z.string().optional(),
  statusCode: z.number().optional(),
});

/**
 * Type inference for Error Response Schema
 *
 * @typedef {Object} ErrorResponse
 * @property {string} error - Human-readable error message
 * @property {unknown} [details] - Additional error details (validation errors, stack traces, etc.)
 * @property {string} [code] - Machine-readable error code
 * @property {number} [statusCode] - HTTP status code
 *
 * @since 2.0.0
 */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Error Categories for Different Handling Strategies
 *
 * Categorizes API errors to enable appropriate handling logic.
 * Each category maps to specific HTTP status codes and requires different UI/UX treatment.
 *
 * @enum {string}
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * switch (error.category) {
 *   case ErrorCategory.AUTH:
 *     redirectToLogin();
 *     break;
 *   case ErrorCategory.NETWORK:
 *     showRetryButton();
 *     break;
 *   case ErrorCategory.VALIDATION:
 *     showFieldErrors(error.details);
 *     break;
 * }
 * ```
 */
export enum ErrorCategory {
  /**
   * Network errors (no response from server)
   * Typically indicates connection issues, DNS failures, or server unreachable.
   * RETRYABLE: Yes
   */
  NETWORK = 'NETWORK',

  /**
   * Authentication errors (HTTP 401)
   * Indicates missing, invalid, or expired authentication token.
   * RETRYABLE: No (requires re-authentication)
   */
  AUTH = 'AUTH',

  /**
   * Authorization errors (HTTP 403)
   * Indicates authenticated user lacks permissions for the requested resource.
   * RETRYABLE: No
   */
  FORBIDDEN = 'FORBIDDEN',

  /**
   * Not found errors (HTTP 404)
   * Indicates the requested resource does not exist.
   * RETRYABLE: No
   */
  NOT_FOUND = 'NOT_FOUND',

  /**
   * Validation errors (HTTP 400, 422)
   * Indicates request data failed backend validation.
   * RETRYABLE: No (requires data correction)
   */
  VALIDATION = 'VALIDATION',

  /**
   * Rate limiting errors (HTTP 429)
   * Indicates too many requests from client.
   * RETRYABLE: Yes (after delay)
   */
  RATE_LIMIT = 'RATE_LIMIT',

  /**
   * Server errors (HTTP 5xx)
   * Indicates internal server error or service unavailable.
   * RETRYABLE: Yes
   */
  SERVER = 'SERVER',

  /**
   * Unknown errors
   * Catch-all for unexpected error conditions.
   * RETRYABLE: No
   */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structured API Error Class
 *
 * Custom error class that extends native Error with API-specific metadata.
 * Provides categorization, retry logic, and user-friendly messaging.
 *
 * @class ApiError
 * @extends Error
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * const error = new ApiError(
 *   'User not found',
 *   ErrorCategory.NOT_FOUND,
 *   404,
 *   { userId: '123' },
 *   'USER_NOT_FOUND'
 * );
 *
 * if (error.isRetryable()) {
 *   // Retry the request
 * }
 *
 * toast.error(error.getUserMessage());
 * ```
 */
export class ApiError extends Error {
  /**
   * Error category for classification and handling
   * @type {ErrorCategory}
   * @readonly
   * @public
   */
  public readonly category: ErrorCategory;

  /**
   * HTTP status code (if available)
   * @type {number | undefined}
   * @readonly
   * @public
   */
  public readonly statusCode?: number;

  /**
   * Additional error details (validation errors, stack traces, etc.)
   * @type {unknown}
   * @readonly
   * @public
   */
  public readonly details?: unknown;

  /**
   * Machine-readable error code
   * @type {string | undefined}
   * @readonly
   * @public
   */
  public readonly code?: string;

  /**
   * Creates an instance of ApiError
   *
   * @param {string} message - Human-readable error message
   * @param {ErrorCategory} category - Error category for classification
   * @param {number} [statusCode] - HTTP status code
   * @param {unknown} [details] - Additional error details
   * @param {string} [code] - Machine-readable error code
   *
   * @constructor
   * @since 2.0.0
   */
  constructor(
    message: string,
    category: ErrorCategory,
    statusCode?: number,
    details?: unknown,
    code?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.category = category;
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if error is retryable
   *
   * Network errors, server errors (5xx), and specific service errors are retryable.
   *
   * @returns {boolean} True if the request can be safely retried
   * @public
   * @since 2.0.0
   *
   * @example
   * ```typescript
   * if (error.isRetryable()) {
   *   await retry(() => apiCall());
   * } else {
   *   toast.error(error.getUserMessage());
   * }
   * ```
   */
  public isRetryable(): boolean {
    return (
      this.category === ErrorCategory.NETWORK ||
      this.category === ErrorCategory.SERVER ||
      this.statusCode === 503 || // Service Unavailable
      this.statusCode === 504    // Gateway Timeout
    );
  }

  /**
   * Check if error requires authentication
   *
   * Returns true for 401 errors, indicating the user needs to log in.
   *
   * @returns {boolean} True if error indicates missing or invalid authentication
   * @public
   * @since 2.0.0
   *
   * @example
   * ```typescript
   * if (error.requiresAuth()) {
   *   clearAuthToken();
   *   router.push(ROUTES.LOGIN);
   * }
   * ```
   */
  public requiresAuth(): boolean {
    return this.category === ErrorCategory.AUTH;
  }

  /**
   * Get user-friendly error message in Italian
   *
   * Converts technical error categories into human-readable messages
   * suitable for displaying to end users.
   *
   * @returns {string} Localized, user-friendly error message
   * @public
   * @since 2.0.0
   *
   * @example
   * ```typescript
   * toast.error(error.getUserMessage());
   * // Displays: "Impossibile connettersi al server. Verifica la tua connessione."
   * ```
   */
  public getUserMessage(): string {
    switch (this.category) {
      case ErrorCategory.NETWORK:
        return 'Impossibile connettersi al server. Verifica la tua connessione.';
      case ErrorCategory.AUTH:
        return 'Sessione scaduta. Effettua nuovamente il login.';
      case ErrorCategory.FORBIDDEN:
        return 'Non hai i permessi per eseguire questa operazione.';
      case ErrorCategory.NOT_FOUND:
        return 'Risorsa non trovata.';
      case ErrorCategory.VALIDATION:
        return this.message || 'Dati non validi. Verifica i campi inseriti.';
      case ErrorCategory.RATE_LIMIT:
        return 'Troppe richieste. Attendi qualche secondo e riprova.';
      case ErrorCategory.SERVER:
        return 'Errore del server. Riprova più tardi.';
      default:
        return 'Si è verificato un errore. Riprova.';
    }
  }
}

/**
 * Parse Axios Error into Structured ApiError
 *
 * Transforms Axios errors into our custom ApiError class with proper categorization.
 * Handles both network errors (no response) and HTTP errors (with response).
 *
 * @param {AxiosError} error - Axios error object from failed request
 * @returns {ApiError} Structured error with category, status code, and details
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * try {
 *   await axios.get('/api/users/me');
 * } catch (error) {
 *   const apiError = parseAxiosError(error as AxiosError);
 *   logger.info(apiError.category); // ErrorCategory.AUTH
 *   logger.info(apiError.statusCode); // 401
 * }
 * ```
 */
export function parseAxiosError(error: AxiosError): ApiError {
  // Network error (no response from server)
  if (!error.response) {
    return new ApiError(
      'Network error',
      ErrorCategory.NETWORK,
      undefined,
      error.message
    );
  }

  const statusCode = error.response.status;
  const data = error.response.data;

  // Parse error response using Zod schema
  const parseResult = ErrorResponseSchema.safeParse(data);
  const errorMessage = parseResult.success
    ? parseResult.data.error
    : 'Unknown error';
  const errorDetails = parseResult.success
    ? parseResult.data.details
    : data;
  const errorCode = parseResult.success
    ? parseResult.data.code
    : undefined;

  // Categorize error by HTTP status code
  let category: ErrorCategory;

  if (statusCode === 401) {
    category = ErrorCategory.AUTH;
  } else if (statusCode === 403) {
    category = ErrorCategory.FORBIDDEN;
  } else if (statusCode === 404) {
    category = ErrorCategory.NOT_FOUND;
  } else if (statusCode === 400 || statusCode === 422) {
    category = ErrorCategory.VALIDATION;
  } else if (statusCode === 429) {
    category = ErrorCategory.RATE_LIMIT;
  } else if (statusCode >= 500) {
    category = ErrorCategory.SERVER;
  } else {
    category = ErrorCategory.UNKNOWN;
  }

  return new ApiError(errorMessage, category, statusCode, errorDetails, errorCode);
}

/**
 * Generic error parser (handles both ApiError and unknown errors)
 *
 * Universal error handler that normalizes all error types into ApiError.
 * Handles ApiError (pass-through), AxiosError (parse), Error (wrap), and unknown types.
 *
 * @param {unknown} error - Any error object or value
 * @returns {ApiError} Normalized ApiError instance
 *
 * @function
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * try {
 *   await someAsyncOperation();
 * } catch (error) {
 *   const apiError = parseError(error);
 *   toast.error(apiError.getUserMessage());
 *   if (apiError.requiresAuth()) {
 *     router.push(ROUTES.LOGIN);
 *   }
 * }
 * ```
 */
export function parseError(error: unknown): ApiError {
  // Already an ApiError - return as-is
  if (error instanceof ApiError) {
    return error;
  }

  // Axios error - parse into ApiError
  if (error instanceof AxiosError) {
    return parseAxiosError(error);
  }

  // Standard Error - wrap in ApiError
  if (error instanceof Error) {
    return new ApiError(
      error.message,
      ErrorCategory.UNKNOWN,
      undefined,
      error
    );
  }

  // Unknown error type - wrap with generic message
  return new ApiError(
    'Unknown error occurred',
    ErrorCategory.UNKNOWN,
    undefined,
    error
  );
}
