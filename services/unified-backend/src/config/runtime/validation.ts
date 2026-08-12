/**
 * Validation configuration for authentication backend
 *
 * Email normalization settings:
 * - Preserve email aliases (+ addressing) for all providers
 * - Allow users to use Gmail/iCloud/Outlook/Yahoo aliases for email filtering
 * - Maintain case-insensitive comparison via lowercase model field
 */

export const validationConfig = {
  /**
   * Options for express-validator normalizeEmail() method
   *
   * Note: We explicitly disable subaddress removal to allow users
   * to use provider-native email aliasing features (e.g., user+alias@gmail.com)
   *
   * All other normalizations remain enabled:
   * - Lowercase conversion (User@Gmail.com → user@gmail.com)
   * - Domain normalization (googlemail.com → gmail.com)
   * - Gmail dot removal (user.name@gmail.com → username@gmail.com)
   */
  normalizeEmail: {
    // Keep all default normalizations enabled
    all_lowercase: true,
    gmail_lowercase: true,
    gmail_remove_dots: true,
    gmail_remove_subaddress: false,    // DISABLED: Preserve Gmail aliases (user+alias@gmail.com)
    gmail_convert_googlemaildotcom: true,
    outlookdotcom_lowercase: true,
    outlookdotcom_remove_subaddress: false, // DISABLED: Preserve Outlook aliases
    yahoo_lowercase: true,
    yahoo_remove_subaddress: false,    // DISABLED: Preserve Yahoo aliases
    icloud_lowercase: true,
    icloud_remove_subaddress: false    // DISABLED: Preserve iCloud aliases
  },

  /**
   * Password strength validation configuration
   *
   * Configure which password requirements are enforced during registration and password changes.
   * Set flags to true to enable specific requirements, false to disable.
   *
   * Current configuration: Only minimum length is enforced (4 characters)
   */
  password: {
    minLength: 4,                      // Minimum password length (always enforced)
    requireUppercase: false,           // Require at least one uppercase letter (A-Z)
    requireLowercase: false,           // Require at least one lowercase letter (a-z)
    requireNumber: false,              // Require at least one number (0-9)
    requireSpecialChar: false,         // Require at least one special character
    checkCommonPasswords: false,       // Check against common/weak passwords list
    specialCharPattern: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/ // Pattern for special characters
  }
};
