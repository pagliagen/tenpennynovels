/**
 * Common API types and interfaces
 */

/**
 * Standard API response wrapper
 * Matches backend standard: services/unified-backend/src/shared/utils/apiResponse.ts
 */
export interface ApiResponse<T = unknown> {
  result: boolean;                // ✅ Backend standard
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  timestamp?: string;
  requestId?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T = unknown> {
  result: boolean;
  data?: {
    items: T[];
    pagination: PaginationInfo;
  };
  error?: string;
  code?: string;
  message?: string;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * API Error class for custom error handling
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Query parameters for list endpoints
 */
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}
