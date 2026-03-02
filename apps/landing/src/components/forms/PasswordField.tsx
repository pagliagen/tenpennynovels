/**
 * Password Field Component
 *
 * Password input with show/hide toggle and optional strength meter.
 * Uses MaskedInput for Victorian styling when password is hidden.
 *
 * **Features**:
 * - Show/hide password toggle button
 * - Optional password strength indicator
 * - Victorian mask when hidden
 * - Plain text when visible
 * - react-hook-form integration
 *
 * @module components/forms/PasswordField
 */

import React, { useState, useMemo } from 'react';
import { MaskedInput } from './MaskedInput';

/**
 * Password strength levels
 *
 * @typedef {string} PasswordStrength
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

/**
 * PasswordField component props
 *
 * @interface PasswordFieldProps
 */
export interface PasswordFieldProps {
  /** Unique input ID (for label association) */
  id: string;
  /** Input name attribute */
  name?: string;
  /** Current input value */
  value: string;
  /** Placeholder text */
  placeholder?: string;
  /** Error message (displayed below input) */
  error?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Whether input is required */
  required?: boolean;
  /** Whether to show password strength meter */
  showStrengthMeter?: boolean;
  /** Autocomplete attribute (e.g., 'current-password', 'new-password') */
  autoComplete?: string;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Blur handler */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Additional CSS classes */
  className?: string;
  /** react-hook-form register return (alternative to onChange/onBlur) */
  register?: any;
}

/**
 * Calculates password strength
 *
 * **Strength Criteria**:
 * - Weak: < 8 characters
 * - Medium: 8+ characters OR lowercase + uppercase
 * - Strong: 8+ characters AND lowercase + uppercase + number
 * - Very Strong: 12+ characters AND lowercase + uppercase + number + special char
 *
 * @param {string} password - Password to evaluate
 * @returns {PasswordStrength} Strength level
 *
 * @example
 * ```typescript
 * calculatePasswordStrength('abc'); // 'weak'
 * calculatePasswordStrength('Abcdefgh'); // 'medium'
 * calculatePasswordStrength('Abcdefgh1'); // 'strong'
 * calculatePasswordStrength('Abcdefgh1@#$'); // 'very-strong'
 * ```
 */
function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password || password.length < 8) {
    return 'weak';
  }

  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&#]/.test(password);

  const criteriaMet = [hasLowercase, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;

  if (password.length >= 12 && criteriaMet >= 4) {
    return 'very-strong';
  }

  if (password.length >= 8 && criteriaMet >= 3) {
    return 'strong';
  }

  if (password.length >= 8 && criteriaMet >= 2) {
    return 'medium';
  }

  return 'weak';
}

/**
 * Get strength meter label in Italian
 *
 * @param {PasswordStrength} strength - Password strength level
 * @returns {string} Italian label
 */
function getStrengthLabel(strength: PasswordStrength): string {
  const labels: Record<PasswordStrength, string> = {
    weak: 'Debole',
    medium: 'Media',
    strong: 'Forte',
    'very-strong': 'Molto forte',
  };

  return labels[strength];
}

/**
 * Password Field Component
 *
 * Renders a password input with show/hide toggle and optional strength meter.
 * Uses MaskedInput when password is hidden for Victorian styling.
 *
 * **Show/Hide Toggle**:
 * - Hidden: Victorian mask with bullets (●●●●●●)
 * - Visible: Plain text input showing actual password
 *
 * **Strength Meter** (optional):
 * - Shows color-coded strength bar
 * - Updates as user types
 * - Helps users create strong passwords
 *
 * @param {PasswordFieldProps} props - Component props
 * @returns {JSX.Element} Rendered password field
 *
 * @example
 * ```typescript
 * import { PasswordField } from '@/components/forms/PasswordField';
 *
 * function LoginForm() {
 *   const [password, setPassword] = useState('');
 *
 *   return (
 *     <PasswordField
 *       id="password"
 *       value={password}
 *       onChange={(e) => setPassword(e.target.value)}
 *       placeholder="Password"
 *       autoComplete="current-password"
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Register form with strength meter
 * function RegisterForm() {
 *   const { register, watch, formState: { errors } } = useForm();
 *
 *   return (
 *     <PasswordField
 *       id="password"
 *       value={watch('password') || ''}
 *       error={errors.password?.message}
 *       register={register('password')}
 *       showStrengthMeter={true}
 *       autoComplete="new-password"
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Reset password with error
 * <PasswordField
 *   id="newPassword"
 *   value={newPassword}
 *   onChange={(e) => setNewPassword(e.target.value)}
 *   placeholder="Nuova password"
 *   error="Password troppo debole"
 *   showStrengthMeter={true}
 *   autoComplete="new-password"
 * />
 * ```
 */
export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  name,
  value,
  placeholder = 'Password',
  error,
  disabled = false,
  required = false,
  showStrengthMeter = false,
  autoComplete = 'current-password',
  onChange,
  onBlur,
  className = '',
  register,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // Calculate password strength (memoized)
  const strength = useMemo(() => {
    if (!showStrengthMeter || !value) {
      return null;
    }
    return calculatePasswordStrength(value);
  }, [value, showStrengthMeter]);

  /**
   * Toggles password visibility
   */
  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  return (
    <div className={`password-field ${className}`}>
      {/* Password input (Victorian mask when hidden, plain when visible) */}
      {isVisible ? (
        // Visible: Plain text input
        <div className="password-field__input-wrapper">
          <input
            id={id}
            name={name || id}
            type="text"
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            autoComplete={autoComplete}
            onChange={onChange}
            onBlur={onBlur}
            className={`password-field__input ${error ? 'password-field__input--error' : ''}`}
            {...(register || {})}
          />

          {/* Error message */}
          {error && <div className="password-field__error">{error}</div>}
        </div>
      ) : (
        // Hidden: Victorian masked input
        <MaskedInput
          id={id}
          name={name}
          maskType="password"
          value={value}
          placeholder={placeholder}
          error={error}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          onChange={onChange}
          onBlur={onBlur}
          register={register}
        />
      )}

      {/* Show/Hide toggle button */}
      <button
        type="button"
        className="password-field__toggle"
        onClick={toggleVisibility}
        disabled={disabled}
        aria-label={isVisible ? 'Nascondi password' : 'Mostra password'}
      >
        {isVisible ? (
          // Eye with slash (hide)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // Eye (show)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>

      {/* Password strength meter */}
      {showStrengthMeter && strength && value.length > 0 && (
        <div className="password-field__strength">
          <div className="password-field__strength-bar">
            <div
              className={`password-field__strength-bar-fill password-field__strength-bar-fill--${strength}`}
            />
          </div>
          <div className={`password-field__strength-label password-field__strength-label--${strength}`}>
            {getStrengthLabel(strength)}
          </div>
        </div>
      )}
    </div>
  );
};
