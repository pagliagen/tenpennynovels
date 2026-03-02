/**
 * Alert Component
 *
 * Displays contextual feedback messages for user actions.
 * Commonly used for form-level success, error, warning, and info messages.
 *
 * **Features**:
 * - 4 alert types: success, error, warning, info
 * - Dismissible (optional close button)
 * - Accessibility: ARIA live regions, semantic roles
 * - Auto-hide support (optional)
 * - Victorian styling integration
 *
 * **Use Cases**:
 * - Form submission success: "Account created successfully!"
 * - Form submission error: "Login failed. Invalid credentials."
 * - Warnings: "Your session will expire soon."
 * - Info messages: "Verification email sent to your inbox."
 *
 * @module components/Alert
 */

import React, { useState, useEffect } from 'react';

/**
 * Alert type variants
 *
 * @typedef {string} AlertType
 */
export type AlertType = 'success' | 'error' | 'warning' | 'info';

/**
 * Alert component props
 *
 * @interface AlertProps
 */
export interface AlertProps {
  /** Alert type (determines color and icon) */
  type?: AlertType;
  /** Alert message text */
  message: string;
  /** Whether alert can be dismissed by user */
  dismissible?: boolean;
  /** Callback when alert is dismissed */
  onDismiss?: () => void;
  /** Auto-hide duration in milliseconds (0 = don't auto-hide) */
  autoHideDuration?: number;
  /** Additional CSS classes */
  className?: string;
  /** ARIA live region politeness level */
  'aria-live'?: 'polite' | 'assertive' | 'off';
}

/**
 * Get icon for alert type
 *
 * Returns appropriate icon symbol for each alert type.
 *
 * @param {AlertType} type - Alert type
 * @returns {string} Icon symbol
 */
function getAlertIcon(type: AlertType): string {
  const icons: Record<AlertType, string> = {
    success: '✓',
    error: '⚠️',
    warning: '⚠',
    info: 'ℹ️',
  };

  return icons[type];
}

/**
 * Alert Component
 *
 * Renders a contextual feedback message with appropriate styling and icon.
 * Supports dismissal (manual or automatic) and accessibility features.
 *
 * **Accessibility**:
 * - Uses `role="alert"` for screen reader announcements
 * - `aria-live` regions (assertive for errors, polite for others)
 * - `aria-atomic="true"` ensures full message is read
 * - Close button has descriptive `aria-label`
 *
 * **Auto-Hide**:
 * If `autoHideDuration` is set, alert automatically disappears after timeout.
 * Useful for temporary success messages that don't require manual dismissal.
 *
 * @param {AlertProps} props - Component props
 * @returns {JSX.Element | null} Rendered alert or null if dismissed/empty
 *
 * @example
 * ```typescript
 * import { Alert } from '@/components/Alert';
 *
 * function LoginForm() {
 *   const [error, setError] = useState<string | null>(null);
 *
 *   return (
 *     <form>
 *       {error && (
 *         <Alert
 *           type="error"
 *           message={error}
 *           onDismiss={() => setError(null)}
 *         />
 *       )}
 *       {/* Form fields... *\/}
 *     </form>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Success message with auto-hide
 * <Alert
 *   type="success"
 *   message="Account created successfully!"
 *   autoHideDuration={5000}
 *   onDismiss={() => setSuccess(null)}
 * />
 * ```
 *
 * @example
 * ```typescript
 * // Warning message (non-dismissible)
 * <Alert
 *   type="warning"
 *   message="Your session will expire in 5 minutes"
 *   dismissible={false}
 *   aria-live="polite"
 * />
 * ```
 *
 * @example
 * ```typescript
 * // Info message
 * <Alert
 *   type="info"
 *   message="Verification email sent to your inbox"
 *   aria-live="polite"
 * />
 * ```
 */
export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  message,
  dismissible = true,
  onDismiss,
  autoHideDuration = 0,
  className = '',
  'aria-live': ariaLive = 'assertive',
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(true);

  /**
   * Auto-hide effect
   *
   * If autoHideDuration is set, automatically dismiss alert after timeout.
   */
  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [autoHideDuration]);

  /**
   * Handles alert dismissal
   *
   * Sets visibility to false and triggers onDismiss callback.
   */
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  // Don't render if no message or already dismissed
  if (!message || !isVisible) {
    return null;
  }

  const icon = getAlertIcon(type);

  return (
    <div
      className={`alert alert--${type} ${dismissible ? 'alert--dismissible' : ''} ${className}`}
      role="alert"
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <div className="alert__content">
        {/* Icon */}
        <span className="alert__icon" aria-hidden="true">
          {icon}
        </span>

        {/* Message */}
        <span className="alert__message">{message}</span>
      </div>

      {/* Dismiss button (optional) */}
      {dismissible && (
        <button
          type="button"
          className="alert__dismiss"
          onClick={handleDismiss}
          aria-label="Chiudi messaggio"
        >
          ×
        </button>
      )}
    </div>
  );
};
