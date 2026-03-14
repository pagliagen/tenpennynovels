// =============================================================================
// Standardized API Response Helpers
// =============================================================================
// Utility functions to generate consistent API responses across all controllers

import { Request } from 'express';
import {
  ApiResponse,
  ApiListResponse,
  ApiSingleResponse,
  ApiErrorResponse,
  PaginationInfo,
  ErrorDetails
} from '../types/management';

/**
 * Generate success response for single record (GET by id, POST, PATCH)
 *
 * Returns: { result: true, data: T, ... }
 */
export function successResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiSingleResponse<T> {
  return {
    result: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Generate success response for list (GET list endpoints)
 *
 * CRITICAL: Returns list and pagination at ROOT level (not wrapped in data)
 * Returns: { result: true, list: T[], pagination: {...}, ... }
 *
 * USE THIS for all /admin/* list endpoints (users, characters, locations, etc.)
 */
export function listResponse<T>(
  list: T[],
  pagination: PaginationInfo,
  message?: string,
  requestId?: string
): ApiListResponse<T> {
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
 * Generate error response
 *
 * Returns: { result: false, error: string, code?: string, ... }
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: ErrorDetails,
  statusCode: number = 500,
  requestId?: string
): ApiErrorResponse {
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
 * Generate success response for DELETE operations
 */
export function deleteResponse(
  message?: string,
  requestId?: string
): ApiResponse {
  return {
    result: true,
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
  return req.headers['x-request-id'] as string | undefined;
}

