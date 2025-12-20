/**
 * Unified Validation Error Interface
 * Consolidates ValidationError from authentication-backend and game-backend
 */

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Multiple validation errors collection
 */
export interface ValidationErrors {
  errors: ValidationError[];
  count: number;
}

/**
 * Helper to create validation error
 */
export const createValidationError = (field: string, message: string, value?: any): ValidationError => ({
  field,
  message,
  value
});

/**
 * Helper to collect multiple validation errors
 */
export const collectValidationErrors = (errors: ValidationError[]): ValidationErrors => ({
  errors,
  count: errors.length
});