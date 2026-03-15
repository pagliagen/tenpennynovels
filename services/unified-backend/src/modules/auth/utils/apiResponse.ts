/**
 * DEPRECATED - Auth module stub (vecchia signature con res param)
 */

import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import type { Request, Response } from 'express';

/**
 * @deprecated Old signature - Use res.status(200).json({ result: true, data }) instead
 */
export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    result: true,
    success: true,  // backward compat
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * @deprecated Old signature - Use res.status(code).json({ result: false, error }) instead
 */
export function errorResponse(
  res: Response,
  error: string,
  code?: string,
  details?: any,
  statusCode: number = 500
): void {
  res.status(statusCode).json({
    result: false,
    success: false,  // backward compat
    error,
    code,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * @deprecated Old signature
 */
export function createdResponse<T>(
  res: Response,
  data: T,
  message?: string
): void {
  res.status(201).json({
    result: true,
    success: true,  // backward compat
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * @deprecated Old signature
 */
export function updatedResponse<T>(
  res: Response,
  data: T,
  message?: string
): void {
  res.status(200).json({
    result: true,
    success: true,  // backward compat
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * @deprecated Old signature - Use res.status(200).json({ result: true, list, pagination }) instead
 */
export function listResponse<T>(
  res: Response,
  list: T[],
  pagination?: any,
  message?: string
): void {
  res.status(200).json({
    result: true,
    success: true,  // backward compat
    list,
    pagination,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * @deprecated Old signature - Use res.status(200).json({ result: true, message }) instead
 */
export function deletedResponse(
  res: Response,
  message?: string
): void {
  res.status(200).json({
    result: true,
    success: true,  // backward compat
    message: message || 'Deleted successfully',
    timestamp: new Date().toISOString()
  });
}

/**
 * @deprecated
 */
export function getRequestId(req: Request): string | undefined {
  return req.headers['x-request-id'] as string | undefined;
}
