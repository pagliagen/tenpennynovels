/**
 * Authentication Service
 *
 * Business logic layer for authentication operations.
 * Provides high-level methods for login, register, logout, profile management.
 *
 * **Responsibilities**:
 * - User authentication (login, register)
 * - Session management
 * - Profile operations
 * - Password management
 * - Email verification
 * - Account deletion
 *
 * **Benefits**:
 * - **Abstraction**: Hides API implementation details
 * - **Reusability**: Single place for all auth logic
 * - **Type Safety**: Fully typed with TypeScript
 * - **Error Handling**: Consistent error handling across auth operations
 *
 * @module services/AuthService
 */

import { apiPost, apiGet } from '@/lib/api/client';
import { sanitizeUserInput } from '@/lib/validation/sanitizers';
import type { ApiResponse, User, LoginCredentials, RegisterData } from '@/types';

/**
 * Authentication Service Class
 *
 * Provides methods for all authentication-related operations.
 *
 * @class AuthService
 *
 * @example
 * ```typescript
 * import { AuthService } from '@/services/AuthService';
 *
 * const authService = new AuthService();
 *
 * // Login
 * const result = await authService.login({
 *   username: 'john',
 *   password: 'secret',
 *   rememberMe: true
 * });
 * ```
 */
export class AuthService {
  /**
   * Login user
   *
   * Authenticates user with username and password.
   * Sets session cookie on success.
   *
   * @param {LoginCredentials} credentials - Login credentials
   * @returns {Promise<ApiResponse<User>>} Login result with user data
   *
   * @example
   * ```typescript
   * const result = await authService.login({
   *   username: 'john',
   *   password: 'myPassword123',
   *   rememberMe: true
   * });
   *
   * if (result.result && result.data) {
   *   console.log('Logged in as:', result.data.username);
   *   // Character select modal will show automatically if needed
   * } else {
   *   console.error('Login failed:', result.error);
   * }
   * ```
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<User>> {
    // Sanitize inputs (XSS protection)
    const sanitized = {
      username: sanitizeUserInput(credentials.username),
      password: credentials.password, // Don't sanitize password (may break special chars)
      rememberMe: credentials.rememberMe,
    };

    return apiPost<User>('/auth/login', sanitized);
  }

  /**
   * Register new user
   *
   * Creates new user account with username, email, and password.
   * Sends verification email after registration.
   *
   * @param {RegisterData} data - Registration data
   * @returns {Promise<ApiResponse<User>>} Registration result
   *
   * @example
   * ```typescript
   * const result = await authService.register({
   *   username: 'john',
   *   email: 'john@example.com',
   *   password: 'SecurePass123!',
   *   agreeToTerms: true
   * });
   *
   * if (result.result) {
   *   console.log('Registration successful! Check email for verification.');
   * }
   * ```
   */
  async register(data: RegisterData): Promise<ApiResponse<User>> {
    // Sanitize inputs
    const sanitized = {
      username: sanitizeUserInput(data.username),
      email: sanitizeUserInput(data.email),
      password: data.password, // Don't sanitize password
      agreeToTerms: data.agreeToTerms,
    };

    return apiPost<User>('/auth/register', sanitized);
  }

  /**
   * Logout current user
   *
   * Destroys session and clears cookies.
   *
   * @returns {Promise<ApiResponse<void>>} Logout result
   *
   * @example
   * ```typescript
   * const result = await authService.logout();
   *
   * if (result.result) {
   *   router.push('/');
   * }
   * ```
   */
  async logout(): Promise<ApiResponse<void>> {
    return apiPost<void>('/auth/logout');
  }

  /**
   * Get current user profile
   *
   * Fetches authenticated user data.
   * Returns 401 if not authenticated.
   *
   * @returns {Promise<ApiResponse<User>>} User profile data
   *
   * @example
   * ```typescript
   * const result = await authService.getProfile();
   *
   * if (result.result && result.data) {
   *   console.log('Current user:', result.data.username);
   * } else {
   *   console.log('Not authenticated');
   * }
   * ```
   */
  async getProfile(): Promise<ApiResponse<User>> {
    return apiGet<User>('/auth/me');
  }

  /**
   * Request password reset
   *
   * Sends password reset email to user.
   *
   * @param {string} identifier - Username or email address
   * @returns {Promise<ApiResponse<void>>} Request result
   *
   * @example
   * ```typescript
   * const result = await authService.forgotPassword('user@example.com');
   *
   * if (result.result) {
   *   console.log('Reset email sent!');
   * }
   * ```
   */
  async forgotPassword(identifier: string): Promise<ApiResponse<void>> {
    const sanitized = {
      identifier: sanitizeUserInput(identifier),
    };

    return apiPost<void>('/auth/forgot-password', sanitized);
  }

  /**
   * Reset password with token
   *
   * Sets new password using reset token from email.
   *
   * @param {string} token - Reset token from email
   * @param {string} newPassword - New password
   * @param {string} confirmPassword - Password confirmation
   * @returns {Promise<ApiResponse<void>>} Reset result
   *
   * @example
   * ```typescript
   * const result = await authService.resetPassword(token, 'NewSecurePass123!', 'NewSecurePass123!');
   *
   * if (result.result) {
   *   console.log('Password updated successfully!');
   *   router.push('/');
   * }
   * ```
   */
  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<ApiResponse<void>> {
    return apiPost<void>(`/auth/reset-password/${token}`, {
      newPassword,
      confirmPassword,
    });
  }

  /**
   * Verify email address
   *
   * Confirms email using verification token from email.
   *
   * @param {string} token - Verification token from email
   * @returns {Promise<ApiResponse<void>>} Verification result
   *
   * @example
   * ```typescript
   * const result = await authService.verifyEmail(token);
   *
   * if (result.result) {
   *   console.log('Email verified successfully!');
   * }
   * ```
   */
  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return apiGet<void>(`/auth/verify-email/${token}`);
  }

  /**
   * Resend email verification
   *
   * Sends a new verification email to user.
   * Used when user tries to login with unverified email.
   *
   * @param {string} username - Username or email address
   * @returns {Promise<ApiResponse<{ emailSent: boolean; canResendAt: string; expiresAt: string }>>} Resend result
   *
   * @example
   * ```typescript
   * const result = await authService.resendVerification('john');
   *
   * if (result.result && result.data) {
   *   console.log('Verification email sent!');
   *   console.log('Can resend at:', result.data.canResendAt);
   * }
   * ```
   */
  async resendVerification(username: string): Promise<ApiResponse<{ emailSent: boolean; canResendAt: string; expiresAt: string }>> {
    const sanitized = {
      username: sanitizeUserInput(username),
    };

    return apiPost<{ emailSent: boolean; canResendAt: string; expiresAt: string }>('/auth/resend-verification', sanitized);
  }

  /**
   * Delete account
   *
   * Permanently deletes user account and all associated data.
   * Requires confirmation token from email.
   *
   * @param {string} token - Deletion confirmation token from email
   * @returns {Promise<ApiResponse<void>>} Deletion result
   *
   * @example
   * ```typescript
   * const result = await authService.deleteAccount(token);
   *
   * if (result.result) {
   *   console.log('Account deleted permanently');
   *   router.push('/');
   * }
   * ```
   */
  async deleteAccount(token: string): Promise<ApiResponse<void>> {
    return apiPost<void>('/auth/delete-account', { token });
  }

  /**
   * Check username availability
   *
   * Checks if username is available for registration.
   * Used for real-time validation during registration.
   *
   * @param {string} username - Username to check
   * @returns {Promise<ApiResponse<{ available: boolean }>>} Availability result
   *
   * @example
   * ```typescript
   * const result = await authService.checkUsernameAvailability('john');
   *
   * if (result.result && result.data?.available) {
   *   console.log('Username available!');
   * } else {
   *   console.log('Username already taken');
   * }
   * ```
   */
  async checkUsernameAvailability(username: string): Promise<ApiResponse<{ available: boolean }>> {
    const sanitized = sanitizeUserInput(username);
    return apiGet<{ available: boolean }>(`/auth/check-username?username=${encodeURIComponent(sanitized)}`);
  }

  /**
   * Check email availability
   *
   * Checks if email is available for registration.
   * Used for real-time validation during registration.
   *
   * @param {string} email - Email to check
   * @returns {Promise<ApiResponse<{ available: boolean }>>} Availability result
   *
   * @example
   * ```typescript
   * const result = await authService.checkEmailAvailability('user@example.com');
   *
   * if (result.result && result.data?.available) {
   *   console.log('Email available!');
   * } else {
   *   console.log('Email already registered');
   * }
   * ```
   */
  async checkEmailAvailability(email: string): Promise<ApiResponse<{ available: boolean }>> {
    const sanitized = sanitizeUserInput(email);
    return apiGet<{ available: boolean }>(`/auth/check-email?email=${encodeURIComponent(sanitized)}`);
  }
}

/**
 * Singleton instance of AuthService
 *
 * Export a single instance to be shared across the application.
 *
 * @constant
 * @type {AuthService}
 */
export const authService = new AuthService();
