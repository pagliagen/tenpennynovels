/**
 * Standard API Response Types
 *
 * Single source of truth for ALL API response structures.
 * Used by backend (Express Response<T>) and frontend (type assertions).
 *
 * @module shared/types/responses
 */

/**
 * Pagination metadata
 */
export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Success response for single record (GET by id, POST, PATCH)
 *
 * Usage:
 * ```typescript
 * return res.status(200).json<SuccessResponse<User>>({
 *   success: true,
 *   data: user,
 *   message: 'User retrieved successfully'
 * });
 * ```
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string; // Auto-injected by middleware
  requestId?: string; // Auto-injected by middleware
}

/**
 * Success response for list endpoints (GET /resources)
 *
 * Usage:
 * ```typescript
 * return res.status(200).json<ListResponse<User>>({
 *   success: true,
 *   list: users,
 *   pagination: { currentPage: 1, pageSize: 25, ... }
 * });
 * ```
 */
export interface ListResponse<T = any> {
  success: true;
  list: T[];
  pagination: PaginationInfo;
  message?: string;
  timestamp?: string; // Auto-injected by middleware
  requestId?: string; // Auto-injected by middleware
}

/**
 * Error response (4xx, 5xx)
 *
 * Usage:
 * ```typescript
 * return res.status(404).json<ErrorResponse>({
 *   success: false,
 *   error: 'User not found',
 *   code: 'USER_NOT_FOUND',
 *   details: { userId: '123' }
 * });
 * ```
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
  timestamp?: string; // Auto-injected by middleware
  requestId?: string; // Auto-injected by middleware
}

/**
 * Union type for all possible API responses
 */
export type ApiResponse<T = any> =
  | SuccessResponse<T>
  | ListResponse<T>
  | ErrorResponse;
