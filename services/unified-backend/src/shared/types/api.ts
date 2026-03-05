/**
 * Unified API Response Interface
 * Consolidates ApiResponse from authentication-backend, game-backend, and management-backend
 */

export interface ApiResponse<T = any> {
  result: boolean;    // Standard: true/false
  success?: boolean;  // Optional: backward compat (mirrors result)
  message?: string;   // Optional user-friendly message
  data?: T;           // Response data
  error?: string;     // Error message (when result = false)
  code?: string;      // Error/response code
  details?: any;      // Additional details/metadata
  timestamp: string;  // ISO timestamp - made required for consistency
  requestId?: string; // Optional request tracking ID
}

/**
 * Standardized error response helper
 */
export const createErrorResponse = (error: string, code?: string, details?: any): ApiResponse => ({
  result: false,
  error,
  code,
  details,
  timestamp: new Date().toISOString()
});

/**
 * Standardized success response helper
 */
export const createSuccessResponse = <T>(data?: T, message?: string, requestId?: string): ApiResponse<T> => ({
  result: true,
  data,
  message,
  timestamp: new Date().toISOString(),
  requestId
});