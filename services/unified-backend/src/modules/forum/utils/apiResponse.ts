/**
 * DEPRECATED - Temporary stub for migration
 * Use direct res.status().json() instead
 */

import type { SuccessResponse, ErrorResponse, ListResponse, PaginationInfo } from '@shared/types/responses';
import type { Request } from 'express';

/**
 * @deprecated Use res.status(200).json({ success: true, data }) instead
 */
export function successResponse<T>(data: T, message?: string, requestId?: string): SuccessResponse<T> {
  return { success: true, data, message, requestId };
}

/**
 * @deprecated Use res.status(code).json({ success: false, error, code }) instead
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: any,
  _statusCode?: number,
  requestId?: string
): ErrorResponse {
  return { success: false, error, code, details, requestId };
}

/**
 * @deprecated Use res.status(200).json({ success: true, list, pagination }) instead
 */
export function listResponse<T>(
  list: T[],
  pagination: PaginationInfo,
  message?: string,
  requestId?: string
): ListResponse<T> {
  return { success: true, list, pagination, message, requestId };
}

/**
 * @deprecated Use res.status(201).json({ success: true, data }) instead
 */
export function createResponse<T>(data: T, message?: string, requestId?: string): SuccessResponse<T> {
  return { success: true, data, message, requestId };
}

/**
 * @deprecated Use res.status(200).json({ success: true, data }) instead
 */
export function updateResponse<T>(data: T, message?: string, requestId?: string): SuccessResponse<T> {
  return { success: true, data, message, requestId };
}

/**
 * @deprecated Use res.status(200).json({ success: true, message }) instead
 */
export function deleteResponse(message?: string, requestId?: string): SuccessResponse<undefined> {
  return { success: true, data: undefined, message: message || 'Record eliminato con successo', requestId };
}

/**
 * @deprecated Middleware auto-injects requestId, no need to call this
 */
export function getRequestId(req: Request): string | undefined {
  return req.headers['x-request-id'] as string | undefined;
}
