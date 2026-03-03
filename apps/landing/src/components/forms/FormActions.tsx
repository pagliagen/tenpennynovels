/**
 * Form Actions Component
 *
 * Centralized button group for form submit and secondary actions.
 * Eliminates 10-15 lines of button markup per form × 8 forms = 80-120 lines saved.
 *
 * **Features**:
 * - Primary submit button with loading state
 * - Optional secondary action (cancel, back, reset)
 * - Consistent styling across all forms
 * - Disabled state during loading
 * - Keyboard accessibility
 *
 * @module components/forms/FormActions
 */

import React from 'react';

/**
 * FormActions component props
 *
 * @interface FormActionsProps
 */
export interface FormActionsProps {
  /** Submit button text (e.g., 'Login', 'Register', 'Submit') */
  submitText: string;
  /** Submit button loading text (e.g., 'Logging in...', 'Submitting...') */
  submitLoadingText?: string;
  /** Whether form is currently submitting */
  submitLoading?: boolean;
  /** Whether submit button is disabled */
  submitDisabled?: boolean;
  /** Submit button type (default: 'submit') */
  submitType?: 'submit' | 'button';
  /** Secondary action button text (optional) */
  secondaryText?: string;
  /** Secondary action click handler */
  onSecondaryClick?: () => void;
  /** Secondary button type (default: 'button') */
  secondaryType?: 'button' | 'reset';
  /** Additional CSS classes */
  className?: string;
  /** Alignment of buttons (default: 'center') */
  align?: 'left' | 'center' | 'right' | 'space-between';
  /** Additional CSS styles */
  style?: React.CSSProperties;
}

/**
 * Form Actions Component
 *
 * Renders a consistent button group for forms with submit and optional secondary actions.
 * Automatically handles loading states and disabled states.
 *
 * **Benefits**:
 * - **DRY**: Single component replaces repetitive button markup
 * - **Consistency**: Same button styling across all forms
 * - **Loading State**: Automatic loading indicator
 * - **Accessibility**: Proper ARIA attributes and keyboard navigation
 *
 * @param {FormActionsProps} props - Component props
 * @returns {JSX.Element} Rendered form actions
 *
 * @example
 * ```typescript
 * import { FormActions } from '@/components/forms/FormActions';
 *
 * function LoginForm() {
 *   const { loading } = useFormState();
 *
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       {/* Form fields... *\/}
 *
 *       <FormActions
 *         submitText="Gioca >>"
 *         submitLoading={loading}
 *       />
 *     </form>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With secondary action (Cancel)
 * function CharacterCreationForm() {
 *   const router = useRouter();
 *   const { loading } = useFormState();
 *
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       {/* Form fields... *\/}
 *
 *       <FormActions
 *         submitText="Crea Personaggio"
 *         submitLoading={loading}
 *         secondaryText="Annulla"
 *         onSecondaryClick={() => router.back()}
 *       />
 *     </form>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom loading text and alignment
 * <FormActions
 *   submitText="Registrati"
 *   submitLoadingText="Creazione account..."
 *   submitLoading={loading}
 *   align="space-between"
 *   secondaryText="Indietro"
 *   onSecondaryClick={handleBack}
 * />
 * ```
 *
 * @example
 * ```typescript
 * // Disabled state (e.g., form validation failed)
 * <FormActions
 *   submitText="Submit"
 *   submitDisabled={!isValid}
 *   submitLoading={loading}
 * />
 * ```
 */
export const FormActions: React.FC<FormActionsProps> = ({
  submitText,
  submitLoadingText,
  submitLoading = false,
  submitDisabled = false,
  submitType = 'submit',
  secondaryText,
  onSecondaryClick,
  secondaryType = 'button',
  className = '',
  align = 'center',
  style = {},
}) => {
  // Determine if submit button should be disabled
  const isSubmitDisabled = submitLoading || submitDisabled;

  // Submit button text (loading or normal)
  const submitButtonText = submitLoading
    ? submitLoadingText || `${submitText}...`
    : submitText;

  return (
    <div className={`form-actions form-actions--${align} ${className}`}>
      {/* Secondary action button (optional) */}
      {secondaryText && (
        <button
          type={secondaryType}
          className="form-actions__secondary"
          onClick={onSecondaryClick}
          disabled={submitLoading}
        >
          {secondaryText}
        </button>
      )}

      {/* Primary submit button */}
      <button
        type={submitType}
        className={`form-actions__submit ${submitLoading ? 'form-actions__submit--loading' : ''}`}
        disabled={isSubmitDisabled}
        aria-busy={submitLoading}
        style={style}
      >
        {/* Loading spinner (optional) */}
        {submitLoading && (
          <span className="form-actions__spinner" aria-hidden="true">
            {/* Simple CSS spinner */}
            <svg
              className="form-actions__spinner-icon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="form-actions__spinner-circle"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="form-actions__spinner-path"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}

        {/* Button text */}
        <span className="form-actions__submit-text">{submitButtonText}</span>
      </button>
    </div>
  );
};
