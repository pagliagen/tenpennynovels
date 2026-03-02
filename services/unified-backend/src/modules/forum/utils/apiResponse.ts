/**
 * Forum API Response Utilities
 * Returns response objects (does not send responses directly)
 */

export interface ForumApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Success response object
 */
export function successResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ForumApiResponse<T> {
  const response: any = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  if (message) {
    response.message = message;
  }

  if (requestId) {
    response.requestId = requestId;
  }

  return response;
}

/**
 * Error response object
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: Record<string, any>,
  statusCode?: number,
  requestId?: string
): ForumApiResponse {
  const response: any = {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };

  if (code) {
    response.code = code;
  }

  if (details) {
    response.details = details;
  }

  if (statusCode) {
    response.statusCode = statusCode;
  }

  if (requestId) {
    response.requestId = requestId;
  }

  return response;
}

/**
 * Create response object (201)
 */
export function createResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ForumApiResponse<T> {
  return successResponse(data, message, requestId);
}

/**
 * List response object with pagination
 */
export function listResponse<T>(
  items: T[],
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  },
  message?: string,
  requestId?: string
): ForumApiResponse {
  const response: any = {
    success: true,
    data: {
      items
    },
    timestamp: new Date().toISOString()
  };

  if (pagination) {
    response.data.pagination = pagination;
  }

  if (message) {
    response.message = message;
  }

  if (requestId) {
    response.requestId = requestId;
  }

  return response;
}

/**
 * Get request ID from Express request
 */
export function getRequestId(req: any): string | undefined {
  return req.id || req.requestId || req.headers['x-request-id'];
}
