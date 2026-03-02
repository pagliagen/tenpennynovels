// =============================================================================
// Standardized API Response Helpers
// =============================================================================
// Utility functions to generate consistent API responses across all controllers

import { Request } from 'express';
import { ApiResponse, PaginationInfo, ErrorDetails } from '../types/management';

/**
 * Generate success response for single record (GET by id, POST, PATCH)
 */
export function successResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    result: true,
    success: true, // Backward compatibility
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Generate success response for list (GET list endpoints)
 */
export function listResponse<T>(
  list: T[],
  pagination: PaginationInfo,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    result: true,
    success: true, // Backward compatibility
    list,
    pagination,
    message,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Generate error response
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: ErrorDetails,
  statusCode: number = 500,
  requestId?: string
): ApiResponse {
  return {
    result: false,
    success: false, // Backward compatibility
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Generate success response for DELETE operations
 */
export function deleteResponse(
  message?: string,
  requestId?: string
): ApiResponse {
  return {
    result: true,
    success: true, // Backward compatibility
    message: message || 'Record eliminato con successo',
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Generate success response for POST create operations
 */
export function createResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    result: true,
    success: true, // Backward compatibility
    data,
    message: message || 'Record creato con successo',
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Generate success response for PATCH/PUT update operations
 */
export function updateResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    result: true,
    success: true, // Backward compatibility
    data,
    message: message || 'Record aggiornato con successo',
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Helper to extract request ID from request (if available)
 */
export function getRequestId(req: Request): string | undefined {
  return req.headers['x-request-id'] as string | undefined || (req as any).id;
}

