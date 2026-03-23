/**
 * Settings Service
 *
 * Business logic layer for user settings and preferences.
 * Minimal service for future expansion.
 *
 * **Responsibilities**:
 * - User preferences management
 * - UI settings (theme, language, etc.)
 * - Notification preferences
 *
 * **Note**: Currently minimal as landing app has limited settings.
 * Will be expanded as more settings are added.
 *
 * @module services/SettingsService
 */

import { apiGet, apiPost } from '@/lib/api/client';
import type { ApiResponse } from '@/types';

/**
 * User settings interface
 *
 * @interface UserSettings
 */
export interface UserSettings {
  /** User ID */
  userId: string;
  /** Email notifications enabled */
  emailNotifications?: boolean;
  /** Newsletter subscription */
  newsletter?: boolean;
  /** Language preference (currently Italian only) */
  language?: 'it';
  /** Last updated timestamp */
  updatedAt?: string;
}

/**
 * Settings Service Class
 *
 * Provides methods for user settings management.
 * Currently minimal, will be expanded in future.
 *
 * @class SettingsService
 *
 * @example
 * ```typescript
 * import { SettingsService } from '@/services/SettingsService';
 *
 * const settingsService = new SettingsService();
 *
 * // Get settings
 * const result = await settingsService.getSettings();
 * ```
 */
export class SettingsService {
  /**
   * Get user settings
   *
   * Fetches current user's settings and preferences.
   *
   * @returns {Promise<ApiResponse<UserSettings>>} User settings
   *
   * @example
   * ```typescript
   * const result = await settingsService.getSettings();
   *
   * if (result.success && result.data) {
   *   console.log('Email notifications:', result.data.emailNotifications);
   * }
   * ```
   */
  async getSettings(): Promise<ApiResponse<UserSettings>> {
    return apiGet<UserSettings>('/auth/settings');
  }

  /**
   * Update user settings
   *
   * Updates user settings and preferences.
   *
   * @param {Partial<UserSettings>} updates - Settings to update
   * @returns {Promise<ApiResponse<UserSettings>>} Updated settings
   *
   * @example
   * ```typescript
   * const result = await settingsService.updateSettings({
   *   emailNotifications: true,
   *   newsletter: false
   * });
   *
   * if (result.success) {
   *   console.log('Settings updated');
   * }
   * ```
   */
  async updateSettings(updates: Partial<UserSettings>): Promise<ApiResponse<UserSettings>> {
    return apiPost<UserSettings>('/auth/settings', updates);
  }

  /**
   * Update email notifications preference
   *
   * Quick method to toggle email notifications.
   *
   * @param {boolean} enabled - Whether to enable email notifications
   * @returns {Promise<ApiResponse<UserSettings>>} Updated settings
   *
   * @example
   * ```typescript
   * await settingsService.updateEmailNotifications(false);
   * ```
   */
  async updateEmailNotifications(enabled: boolean): Promise<ApiResponse<UserSettings>> {
    return this.updateSettings({ emailNotifications: enabled });
  }

  /**
   * Update newsletter subscription
   *
   * Quick method to toggle newsletter subscription.
   *
   * @param {boolean} subscribed - Whether to subscribe to newsletter
   * @returns {Promise<ApiResponse<UserSettings>>} Updated settings
   *
   * @example
   * ```typescript
   * await settingsService.updateNewsletterSubscription(true);
   * ```
   */
  async updateNewsletterSubscription(subscribed: boolean): Promise<ApiResponse<UserSettings>> {
    return this.updateSettings({ newsletter: subscribed });
  }
}

/**
 * Singleton instance of SettingsService
 *
 * Export a single instance to be shared across the application.
 *
 * @constant
 * @type {SettingsService}
 */
export const settingsService = new SettingsService();
