/**
 * Standard API Response Utilities
 *
 * Provides consistent response formatting across all backend endpoints.
 * All responses include timestamp for debugging and optional requestId for tracing.
 */

import type { SuccessResponse, ErrorResponse, ListResponse, PaginationInfo } from '@shared/types/responses';
import type { Request } from 'express';

/**
 * Creates a standardized success response
 *
 * @example
 * const user = await User.findById(id);
 * res.status(200).json(successResponse(user));
 */
export function successResponse<T>(data: T, message?: string, requestId?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a standardized error response
 *
 * @example
 * res.status(404).json(errorResponse('User not found', 'USER_NOT_FOUND', { userId }));
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: any,
  _statusCode?: number,
  requestId?: string
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    details,
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a standardized list response with pagination
 *
 * @example
 * const users = await User.find().limit(25);
 * res.status(200).json(listResponse(users, pagination));
 */
export function listResponse<T>(
  list: T[],
  pagination: PaginationInfo,
  message?: string,
  requestId?: string
): ListResponse<T> {
  return {
    success: true,
    list,
    pagination,
    message,
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a standardized creation response (HTTP 201)
 *
 * @example
 * const newUser = await User.create(data);
 * res.status(201).json(createResponse(newUser, 'User created successfully'));
 */
export function createResponse<T>(data: T, message?: string, requestId?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a standardized update response
 *
 * @example
 * const updated = await User.findByIdAndUpdate(id, data);
 * res.status(200).json(updateResponse(updated, 'User updated successfully'));
 */
export function updateResponse<T>(data: T, message?: string, requestId?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a standardized delete response
 *
 * @example
 * await User.findByIdAndDelete(id);
 * res.status(200).json(deleteResponse('User deleted successfully'));
 */
export function deleteResponse(message?: string, requestId?: string): SuccessResponse<undefined> {
  return {
    success: true,
    data: undefined,
    message: message || 'Record eliminato con successo',
    requestId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Extracts request ID from Express request headers
 *
 * @example
 * const reqId = getRequestId(req);
 * res.json(successResponse(data, undefined, reqId));
 */
export function getRequestId(req: Request): string | undefined {
  return req.headers['x-request-id'] as string | undefined;
}
