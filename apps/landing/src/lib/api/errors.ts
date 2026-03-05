/**
 * API Error Types and Utilities
 *
 * Provides custom error classes for different failure scenarios in API requests.
 * Includes type guards and error message mapping for consistent error handling.
 *
 * @module lib/api/errors
 */

/**
 * Custom error class for API-specific errors
 *
 * Thrown when the API returns a non-200 status code with error information.
 * Contains structured error data including error code, HTTP status, and field-level details.
 *
 * @class ApiError
 * @extends Error
 *
 * @example
 * ```typescript
 * throw new ApiError('VALIDATION_ERROR', 400, { email: 'Invalid email format' });
 * ```
 */
export class ApiError extends Error {
  /**
   * Creates an instance of ApiError
   *
   * @param {string} code - Application-level error code (e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED')
   * @param {number} statusCode - HTTP status code (e.g., 400, 401, 500)
   * @param {Record<string, string>} [details] - Optional field-level error details for forms
   */
  constructor(
    public code: string,
    public statusCode: number,
    public details?: Record<string, string>
  ) {
    super(getErrorMessage(code));
    this.name = 'ApiError';
  }
}

/**
 * Error class for network-level failures
 *
 * Thrown when the request fails due to network issues (no connection, DNS failure, etc.)
 * Indicates a transient failure that may succeed on retry.
 *
 * @class NetworkError
 * @extends Error
 *
 * @example
 * ```typescript
 * throw new NetworkError('Failed to connect to server');
 * ```
 */
export class NetworkError extends Error {
  /**
   * Creates an instance of NetworkError
   *
   * @param {string} message - Human-readable error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Error class for request timeout failures
 *
 * Thrown when a request exceeds the configured timeout duration.
 * Indicates the server is slow or unresponsive.
 *
 * @class TimeoutError
 * @extends Error
 *
 * @example
 * ```typescript
 * throw new TimeoutError('Request took longer than 30 seconds');
 * ```
 */
export class TimeoutError extends Error {
  /**
   * Creates an instance of TimeoutError
   *
   * @param {string} [message='Request timeout'] - Human-readable error message
   */
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Type guard to check if an error is a network error
 *
 * Returns true for NetworkError instances or native TypeError (which indicates network failure).
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is a network-related error
 *
 * @example
 * ```typescript
 * try {
 *   await fetch(url);
 * } catch (error) {
 *   if (isNetworkError(error)) {
 *     console.log('Network failure, will retry');
 *   }
 * }
 * ```
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError || error instanceof TypeError;
}

/**
 * Type guard to check if an error is a timeout error
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is a TimeoutError
 *
 * @example
 * ```typescript
 * if (isTimeoutError(error)) {
 *   console.log('Request timed out');
 * }
 * ```
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Determines if an error is retryable
 *
 * Returns true for:
 * - Network errors (transient connection failures)
 * - Timeout errors (server was slow)
 * - Specific HTTP status codes (408 Request Timeout, 429 Too Many Requests, 5xx Server Errors)
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error should trigger a retry
 *
 * @example
 * ```typescript
 * for (let attempt = 0; attempt < maxRetries; attempt++) {
 *   try {
 *     return await makeRequest();
 *   } catch (error) {
 *     if (!isRetryableError(error)) {
 *       throw error; // Don't retry non-retryable errors
 *     }
 *   }
 * }
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error) || isTimeoutError(error)) {
    return true;
  }

  if (error instanceof ApiError) {
    // Retryable HTTP status codes
    const retryableStatuses = [
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ];
    return retryableStatuses.includes(error.statusCode);
  }

  return false;
}

/**
 * Maps error codes to Italian error messages
 *
 * Provides user-friendly, localized error messages for common error scenarios.
 * Falls back to UNKNOWN_ERROR if the code is not recognized.
 *
 * @param {string} code - Application error code
 * @returns {string} Localized error message in Italian
 *
 * @example
 * ```typescript
 * const message = getErrorMessage('VALIDATION_ERROR');
 * // Returns: "I dati inseriti non sono validi."
 * ```
 */
export function getErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    NETWORK_ERROR: 'Errore di connessione. Verifica la tua connessione internet.',
    TIMEOUT_ERROR: 'La richiesta ha impiegato troppo tempo. Riprova.',
    UNAUTHORIZED: 'Sessione scaduta. Effettua nuovamente il login.',
    FORBIDDEN: 'Non hai i permessi per questa operazione.',
    NOT_FOUND: 'Risorsa non trovata.',
    VALIDATION_ERROR: 'I dati inseriti non sono validi.',
    SERVER_ERROR: 'Errore del server. Riprova più tardi.',
    INVALID_VERIFICATION_TOKEN: 'Token di verifica non valido o scaduto.',
    EMAIL_NOT_VERIFIED: 'Email non verificata. Controlla la tua casella di posta.',
    EMAIL_ALREADY_VERIFIED: 'Email già verificata.',
    USER_NOT_FOUND: 'Username o email non trovati.',
    INVALID_PASSWORD: 'Password errata.',
    UNKNOWN_ERROR: 'Errore sconosciuto. Riprova più tardi.',
  };

  return errorMessages[code] || errorMessages.UNKNOWN_ERROR;
}
