/**
 * Form Error Handler Utilities
 *
 * Utilities for handling API errors and mapping them to form fields.
 *
 * **Features**:
 * - Map API errors to react-hook-form field errors
 * - Extract error messages from React 19 SSR-safe format
 * - Handle field-specific and global errors
 *
 * @module utils/formErrorHandler
 */

import type { UseFormSetError, FieldErrors } from 'react-hook-form';
import type { ApiResponse } from '@/types';

/**
 * Handle API Form Errors
 *
 * Maps API response errors to react-hook-form field errors.
 *
 * @template T - Form data type
 * @param {ApiResponse} result - API response
 * @param {UseFormSetError<T>} setError - react-hook-form setError function
 * @param {(message: string) => void} [setGlobalError] - Optional global error setter
 *
 * @example
 * ```typescript
 * const result = await apiCall();
 * handleApiFormErrors(result, setError, setGlobalError);
 * ```
 */
export function handleApiFormErrors<T extends Record<string, any>>(
  result: ApiResponse,
  setError: UseFormSetError<T>,
  setGlobalError?: (message: string) => void
): void {
  // Success - no errors
  if (result.success) {
    return;
  }

  // Handle field-specific errors (details contains per-field errors)
  if (result.details) {
    Object.entries(result.details).forEach(([field, message]) => {
      setError(field as any, {
        type: 'server',
        message: typeof message === 'string' ? message : 'Errore di validazione',
      });
    });

    // Also show global error when there are field errors
    if (result.error && setGlobalError) {
      setGlobalError(result.error);
    }
  }

  // Handle general error (when no field errors)
  if (result.error && !result.details) {
    if (setGlobalError) {
      setGlobalError(result.error);
    } else {
      console.warn('API error without global error handler:', result.error);
    }
  }
}

/**
 * Get Form Error Message
 *
 * Extract error message from react-hook-form in an SSR-safe way.
 * Compatible with React 19 and server-side rendering.
 *
 * @param {any} message - Error message (string, React element, or object)
 * @returns {string} Extracted error message
 *
 * @example
 * ```typescript
 * const errorMessage = getFormErrorMessage(errors.username?.message);
 * ```
 */
export function getFormErrorMessage(message: any): string {
  // Handle null/undefined
  if (message == null) return '';

  // Handle string messages (most common case)
  if (typeof message === 'string') return message;

  // Handle React elements or objects (React 19 may pass React elements during SSR)
  if (typeof message === 'object') {
    // Check if it's a React element (has $$typeof property)
    if ('$$typeof' in message || ('_owner' in message && '_store' in message)) {
      // Try to extract text from React element
      if ('props' in message && message.props) {
        if (typeof message.props.children === 'string') {
          return message.props.children;
        }
        if (typeof message.props.message === 'string') {
          return message.props.message;
        }
      }
      return 'Errore di validazione';
    }

    // Handle Error objects
    if (message instanceof Error) {
      return message.message || 'Errore di validazione';
    }

    // For other objects, try to extract meaningful info
    if ('message' in message && typeof message.message === 'string') {
      return message.message;
    }

    // Last resort: generic error message (never render object directly)
    return 'Errore di validazione';
  }

  // Handle other primitive types (numbers, booleans, etc.)
  return String(message);
}

/**
 * Check if Field Has Error
 *
 * @template T - Form data type
 * @param {FieldErrors<T>} errors - Form errors object
 * @param {keyof T} fieldName - Field name to check
 * @returns {boolean} True if field has error
 */
export function hasFieldError<T extends Record<string, any>>(
  errors: FieldErrors<T>,
  fieldName: keyof T
): boolean {
  return !!errors[fieldName];
}

/**
 * Get Field Error Message
 *
 * @template T - Form data type
 * @param {FieldErrors<T>} errors - Form errors object
 * @param {keyof T} fieldName - Field name to get error for
 * @returns {string} Error message or empty string
 */
export function getFieldError<T extends Record<string, any>>(
  errors: FieldErrors<T>,
  fieldName: keyof T
): string {
  const error = errors[fieldName];
  if (!error) return '';
  return getFormErrorMessage(error.message);
}
