import { Response } from 'express';

// ✅ Standard Response Interface
export interface ApiResponse<T = any> {
  result: boolean;
  data?: T;
  message?: string;          // Messaggio di successo
  error?: string;           // Messaggio user-friendly IN ITALIANO
  code?: string;            // Codice errore (es: USER_NOT_FOUND)
  details?: Record<string, any>;
  timestamp: string;        // ISO 8601
  requestId: string;        // SEMPRE presente
}

// ✅ Success Response
export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const response: ApiResponse<T> = {
    result: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId
  };

  if (message) {
    response.message = message;
  }

  res.status(statusCode).json(response);
}

// ✅ List Response (con paginazione)
export function listResponse<T>(
  res: Response,
  items: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  },
  message?: string,
  statusCode: number = 200
): void {
  const response: ApiResponse = {
    result: true,
    data: {
      items,
      pagination
    },
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId
  };

  if (message) {
    response.message = message;
  }

  res.status(statusCode).json(response);
}

// ✅ Error Response (messaggi IN ITALIANO)
export function errorResponse(
  res: Response,
  error: string,
  code?: string,
  details?: Record<string, any>,
  statusCode: number = 400
): void {
  const response: ApiResponse = {
    result: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId
  };

  res.status(statusCode).json(response);
}

// ✅ Created Response (201)
export function createdResponse<T>(
  res: Response,
  data: T,
  message?: string
): void {
  successResponse(res, data, message, 201);
}

// ✅ Updated Response (200)
export function updatedResponse<T>(
  res: Response,
  data: T,
  message?: string
): void {
  successResponse(res, data, message, 200);
}

// ✅ Deleted Response (200)
export function deletedResponse(
  res: Response,
  message?: string
): void {
  successResponse(res, { deleted: true }, message, 200);
}
