/**
 * Forum API Response Utilities
 * Returns response objects (does not send responses directly)
 * Standardized to match game/auth module format.
 */

import { Request } from 'express';
import type { ApiResponse, PaginationInfo, ErrorDetails } from '../../auth/types/auth';

/**
 * Success response object
 */
export function successResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    result: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Error response object
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: ErrorDetails,
  _statusCode?: number,
  requestId?: string
): ApiResponse {
  return {
    result: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Create response object (201)
 */
export function createResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return successResponse(data, message, requestId);
}

/**
 * List response object with pagination
 */
export function listResponse<T>(
  list: T[],
  pagination: PaginationInfo,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    result: true,
    list,
    pagination,
    message,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Get request ID from Express request
 */
export function getRequestId(req: Request): string | undefined {
  return (req.headers['x-request-id'] as string | undefined) || (req as Request & { id?: string }).id;
}
