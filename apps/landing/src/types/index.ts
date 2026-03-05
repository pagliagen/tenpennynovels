/**
 * Core TypeScript Type Definitions
 *
 * Centralized type definitions for the entire landing application.
 * Includes API response types, user/character models, auth types, and form types.
 *
 * @module types
 */

/**
 * Standard API response structure
 *
 * All API endpoints return this structure for consistency.
 * Either contains data/list on success, or error/details on failure.
 *
 * @interface ApiResponse
 * @template T - Type of the data payload
 *
 * @example
 * ```typescript
 * // Success response
 * const response: ApiResponse<User> = {
 *   result: true,
 *   data: { id: '123', username: 'john' },
 *   timestamp: '2024-02-24T20:00:00Z'
 * };
 *
 * // Error response
 * const errorResponse: ApiResponse = {
 *   result: false,
 *   error: 'Invalid credentials',
 *   code: 'UNAUTHORIZED',
 *   timestamp: '2024-02-24T20:00:00Z'
 * };
 * ```
 */
export interface ApiResponse<T = any> {
  /** Whether the request was successful */
  result: boolean;
  /** Single data object (for GET by ID, POST create, etc.) */
  data?: T;
  /** Array of data objects (for GET list endpoints) */
  list?: T[];
  /** Success message from server */
  message?: string;
  /** Error message (present when result=false) */
  error?: string;
  /** Application-level error code (e.g., 'VALIDATION_ERROR', 'UNAUTHORIZED') */
  code?: string;
  /** Field-level error details for form validation */
  details?: Record<string, string>;
  /** ISO timestamp of the response */
  timestamp: string;
  /** @internal - DEV ONLY: Internal dev headers (not part of API contract) */
  __devHeaders?: Record<string, string>;
}

/**
 * User account data
 *
 * Represents a registered user account in the system.
 *
 * @interface User
 */
export interface User {
  /** Unique user identifier (UUID) */
  id: string;
  /** Username (unique, 3-20 characters) */
  username: string;
  /** Email address (unique) */
  email: string;
  /** User role ('user', 'master', 'admin') */
  role: string;
  /** Whether user can create multiple characters */
  multipleCharactersAllowed: boolean;
  /** User's characters (populated by backend) */
  characters?: Character[];
  /** ISO timestamp of account creation */
  createdAt: string;
}

/**
 * Character data
 *
 * Represents a game character owned by a user.
 * Characters go through approval workflow: draft → pending → approved/rejected.
 *
 * @interface Character
 */
export interface Character {
  /** Unique character identifier (UUID) */
  id: string;
  /** Character name (2-50 characters) */
  name: string;
  /** Owner user ID */
  userId: string;
  /** Selected occupation ID (from occupations list) */
  occupation?: string;
  /** Populated occupation details (when included in response) */
  occupationDetails?: Occupation;
  /** Free-text current occupation (if not in predefined list) */
  currentOccupation?: string;
  /** Character age (16-80 years) */
  age?: number;
  /** Physical/personality description (max 500 chars) */
  description?: string;
  /** Character backstory (max 1000 chars) */
  background?: string;
  /** Approval status */
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  /** Reason for rejection (if status=rejected) */
  rejectedReason?: string;
  /** ISO timestamp of character creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Occupation/profession data
 *
 * Predefined list of Victorian-era occupations that characters can choose from.
 *
 * @interface Occupation
 */
export interface Occupation {
  /** Unique occupation identifier (UUID) */
  id: string;
  /** Occupation name (e.g., "Medico", "Commerciante") */
  name: string;
  /** Optional description of the occupation */
  description?: string;
  /** Occupation category (e.g., "Sanità", "Commercio") */
  category?: string;
}

/**
 * Login form credentials
 *
 * @interface LoginCredentials
 */
export interface LoginCredentials {
  /** Username (3-20 characters) */
  username: string;
  /** Password (min 8 characters) */
  password: string;
  /** Whether to keep user logged in for 30 days */
  rememberMe?: boolean;
}

/**
 * Registration form data
 *
 * @interface RegisterData
 */
export interface RegisterData {
  /** Username (3-20 characters, alphanumeric + underscore/hyphen) */
  username: string;
  /** Email address (valid email format) */
  email: string;
  /** Password (min 8 chars, must contain: lowercase, uppercase, number, special char) */
  password: string;
  /** User must explicitly agree to terms */
  agreeToTerms: boolean;
}

/**
 * Authentication response
 *
 * Returned by login/register endpoints.
 *
 * @interface AuthResponse
 */
export interface AuthResponse {
  /** Whether authentication was successful */
  result: boolean;
  /** User data (if authentication succeeded) */
  user?: User;
  /** Success message */
  message?: string;
  /** Error message (if authentication failed) */
  error?: string;
  /** Error code (e.g., 'INVALID_CREDENTIALS') */
  code?: string;
  /** Field-level validation errors */
  details?: Record<string, string>;
}

/**
 * Character creation form data
 *
 * @interface CharacterData
 */
export interface CharacterData {
  /** Character name (2-50 characters) */
  name: string;
  /** Selected occupation ID (optional) */
  occupation?: string;
  /** Free-text occupation (if not in predefined list) */
  currentOccupation?: string;
  /** Character age (16-80 years) */
  age?: number;
  /** Physical/personality description (50-500 chars if provided) */
  description?: string;
  /** Character backstory (max 1000 chars) */
  background?: string;
}

/**
 * Character creation response
 *
 * @interface CharacterResponse
 */
export interface CharacterResponse {
  /** Whether character creation was successful */
  result: boolean;
  /** Created character data (if successful) */
  character?: Character;
  /** Success message */
  message?: string;
  /** Error message (if failed) */
  error?: string;
  /** Error code */
  code?: string;
  /** Field-level validation errors */
  details?: Record<string, string>;
}

/**
 * Form field error structure
 *
 * Used by react-hook-form for field-level errors.
 *
 * @interface FormFieldError
 */
export interface FormFieldError {
  /** Error message for the field */
  message: string;
}

/**
 * Form errors collection
 *
 * Map of field names to their error messages.
 *
 * @interface FormErrors
 *
 * @example
 * ```typescript
 * const errors: FormErrors = {
 *   username: { message: 'Username già in uso' },
 *   email: { message: 'Email non valida' }
 * };
 * ```
 */
export interface FormErrors {
  [field: string]: FormFieldError;
}

/**
 * Token validation result
 *
 * Used by token-based pages (verify-email, reset-password, delete-account).
 *
 * @interface TokenValidation
 */
export interface TokenValidation {
  /** Whether the token is valid and not expired */
  valid: boolean;
  /** Optional message (error reason if invalid) */
  message?: string;
}
