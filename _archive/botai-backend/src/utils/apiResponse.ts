export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export function successResponse<T>(data?: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

export function errorResponse(
  error: string,
  code?: string,
  details?: any
): ApiResponse {
  return {
    success: false,
    error,
    code,
    data: details,
    timestamp: new Date().toISOString()
  };
}

export function createResponse<T>(data: T, message: string = 'Resource created successfully'): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

export function updateResponse<T>(data: T, message: string = 'Resource updated successfully'): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

export function deleteResponse(message: string = 'Resource deleted successfully'): ApiResponse {
  return {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
}
