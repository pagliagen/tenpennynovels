/**
 * Shared Utils Package - Main Export File
 * Consolidates all shared utility functions
 */

// Logger utilities
export * from './logger';

// Re-export existing utils
export * from './characterVisibility';

// Validation utilities
export { escapeRegex, validateObjectId, isValidObjectId } from './validation';

// Query params and pagination utilities
export { parsePagination, buildPaginationMeta } from './queryParams';