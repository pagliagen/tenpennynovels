/**
 * Button Component
 *
 * Reusable button component with Victorian styling and multiple variants.
 * Supports loading states, icons, and different sizes.
 *
 * **Features**:
 * - 3 variants: primary (gold), secondary (outline), ghost (transparent)
 * - 3 sizes: small, base, large
 * - Loading state with disabled interaction
 * - Optional icons (left or right positioned)
 * - Full width option
 * - Accessibility: ARIA attributes, keyboard navigation
 *
 * **Design Pattern**:
 * Primary buttons for main actions (Submit, Login, Register)
 * Secondary buttons for alternative actions (Cancel, Back)
 * Ghost buttons for tertiary actions (Link-style buttons)
 *
 * @module components/Button
 */

import React from 'react';

/**
 * Button variant types
 *
 * @typedef {string} ButtonVariant
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/**
 * Button size types
 *
 * @typedef {string} ButtonSize
 */
export type ButtonSize = 'small' | 'base' | 'large';

/**
 * Button component props
 *
 * @interface ButtonProps
 * @extends React.ButtonHTMLAttributes<HTMLButtonElement>
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant (default: 'primary') */
  variant?: ButtonVariant;
  /** Button size (default: 'base') */
  size?: ButtonSize;
  /** Whether button is in loading state */
  loading?: boolean;
  /** Whether button should span full container width */
  fullWidth?: boolean;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Icon position relative to text (default: 'left') */
  iconPosition?: 'left' | 'right';
  /** Button content (text, elements) */
  children: React.ReactNode;
}

/**
 * Button Component
 *
 * Renders a styled button with Victorian aesthetics.
 * Automatically handles loading and disabled states.
 *
 * **Variants**:
 * - **Primary**: Gold background, dark text (main CTA)
 * - **Secondary**: Outline style, transparent background
 * - **Ghost**: No border, transparent background (link-style)
 *
 * **Accessibility**:
 * - Proper `type` attribute (button, submit, reset)
 * - `aria-busy` during loading state
 * - `disabled` attribute prevents interaction
 * - Icon has `aria-hidden` to avoid duplicate announcement
 *
 * @param {ButtonProps} props - Component props
 * @returns {JSX.Element} Rendered button
 *
 * @example
 * ```typescript
 * import { Button } from '@/components/Button';
 *
 * // Primary submit button
 * <Button type="submit" loading={isSubmitting}>
 *   Gioca >>
 * </Button>
 * ```
 *
 * @example
 * ```typescript
 * // Secondary cancel button
 * <Button variant="secondary" onClick={handleCancel}>
 *   Annulla
 * </Button>
 * ```
 *
 * @example
 * ```typescript
 * // Button with icon
 * <Button
 *   icon={<ArrowLeftIcon />}
 *   iconPosition="left"
 *   variant="ghost"
 *   onClick={handleBack}
 * >
 *   Indietro
 * </Button>
 * ```
 *
 * @example
 * ```typescript
 * // Full width button
 * <Button fullWidth size="large">
 *   Registrati
 * </Button>
 * ```
 *
 * @example
 * ```typescript
 * // Loading state
 * <Button loading={true}>
 *   {loading ? 'Caricamento...' : 'Invia'}
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'base',
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  disabled,
  children,
  type = 'button',
  ...props
}) => {
  // Button is disabled if explicitly disabled or loading
  const isDisabled = disabled || loading;

  // Build CSS classes
  const buttonClasses = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    loading && 'button--loading',
    fullWidth && 'button--full-width',
    icon && 'button--with-icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={isDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        // Loading state: CSS handles spinner
        <span className="button__content">{children}</span>
      ) : (
        // Normal state: Icon + children
        <span className="button__content">
          {icon && iconPosition === 'left' && (
            <span className="button__icon button__icon--left" aria-hidden="true">
              {icon}
            </span>
          )}

          <span className="button__text">{children}</span>

          {icon && iconPosition === 'right' && (
            <span className="button__icon button__icon--right" aria-hidden="true">
              {icon}
            </span>
          )}
        </span>
      )}
    </button>
  );
};

/**
 * ButtonGroup component props
 *
 * @interface ButtonGroupProps
 */
export interface ButtonGroupProps {
  /** Button elements to group */
  children: React.ReactNode;
  /** Whether buttons should stack vertically (default: false) */
  vertical?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ButtonGroup Component
 *
 * Groups multiple buttons together with consistent spacing.
 * Useful for form actions (Submit + Cancel), toolbars, etc.
 *
 * **Layout**:
 * - Horizontal (default): Buttons side-by-side
 * - Vertical: Buttons stacked
 *
 * @param {ButtonGroupProps} props - Component props
 * @returns {JSX.Element} Rendered button group
 *
 * @example
 * ```typescript
 * import { Button, ButtonGroup } from '@/components/Button';
 *
 * // Horizontal button group
 * <ButtonGroup>
 *   <Button variant="secondary">Annulla</Button>
 *   <Button type="submit">Conferma</Button>
 * </ButtonGroup>
 * ```
 *
 * @example
 * ```typescript
 * // Vertical button group
 * <ButtonGroup vertical>
 *   <Button fullWidth>Option 1</Button>
 *   <Button fullWidth>Option 2</Button>
 *   <Button fullWidth>Option 3</Button>
 * </ButtonGroup>
 * ```
 */
export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  vertical = false,
  className = '',
}) => {
  const groupClasses = [
    'button-group',
    vertical && 'button-group--vertical',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={groupClasses}>{children}</div>;
};
