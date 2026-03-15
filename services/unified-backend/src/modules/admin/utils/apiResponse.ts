/**
 * DEPRECATED - Temporary stub for migration
 * Use direct res.status().json() instead
 */

import type { SuccessResponse, ErrorResponse, ListResponse, PaginationInfo } from '@shared/types/responses';
import type { Request } from 'express';

/**
 * @deprecated Use res.status(200).json({ success: true, data }) instead
 */
export function successResponse<T>(data: T, message?: string, requestId?: string): any {
  return { result: true, success: true, data, message, requestId, timestamp: new Date().toISOString() };
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
): any {
  return { result: false, success: false, error, code, details, requestId, timestamp: new Date().toISOString() };
}

/**
 * @deprecated Use res.status(200).json({ success: true, list, pagination }) instead
 */
export function listResponse<T>(
  list: T[],
  pagination: PaginationInfo,
  message?: string,
  requestId?: string
): any {
  return { result: true, success: true, list, pagination, message, requestId, timestamp: new Date().toISOString() };
}

/**
 * @deprecated Use res.status(201).json({ success: true, data }) instead
 */
export function createResponse<T>(data: T, message?: string, requestId?: string): any {
  return { result: true, success: true, data, message, requestId, timestamp: new Date().toISOString() };
}

/**
 * @deprecated Use res.status(200).json({ success: true, data }) instead
 */
export function updateResponse<T>(data: T, message?: string, requestId?: string): any {
  return { result: true, success: true, data, message, requestId, timestamp: new Date().toISOString() };
}

/**
 * @deprecated Use res.status(200).json({ success: true, message }) instead
 */
export function deleteResponse(message?: string, requestId?: string): any {
  return { result: true, success: true, data: undefined, message: message || 'Record eliminato con successo', requestId, timestamp: new Date().toISOString() };
}

/**
 * @deprecated Use res.status(201).json({ success: true, data }) instead
 */
export function createdResponse<T>(data: T, message?: string, requestId?: string): any {
  return { result: true, success: true, data, message, requestId, timestamp: new Date().toISOString() };
}

/**
 * @deprecated Use res.status(200).json({ success: true, data }) instead
 */
export function updatedResponse<T>(data: T, message?: string, requestId?: string): any {
  return { result: true, success: true, data, message, requestId, timestamp: new Date().toISOString() };
}

/**
 * @deprecated Middleware auto-injects requestId, no need to call this
 */
export function getRequestId(req: Request): string | undefined {
  return req.headers['x-request-id'] as string | undefined;
}
