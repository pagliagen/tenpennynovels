/**
 * TextArea Field Component
 *
 * Multi-line text input with Victorian styling and character counter.
 * Used for character descriptions, backgrounds, and other long-form text.
 *
 * **Features**:
 * - Victorian decorative styling
 * - Character counter (current/max)
 * - Auto-resize support (optional)
 * - Error state display
 * - Disabled state support
 * - react-hook-form integration
 *
 * @module components/forms/TextAreaField
 */

import React, { useEffect, useRef } from 'react';

/**
 * TextAreaField component props
 *
 * @interface TextAreaFieldProps
 */
export interface TextAreaFieldProps {
  /** Unique textarea ID (for label association) */
  id: string;
  /** Textarea name attribute */
  name?: string;
  /** Current textarea value */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Label text (displayed above textarea) */
  label?: string;
  /** Hint text (displayed below label) */
  hint?: string;
  /** Error message (displayed below textarea) */
  error?: string;
  /** Whether textarea is disabled */
  disabled?: boolean;
  /** Whether textarea is required */
  required?: boolean;
  /** Number of visible rows (default: 4) */
  rows?: number;
  /** Maximum character count (for counter display) */
  maxLength?: number;
  /** Whether to auto-resize textarea as user types */
  autoResize?: boolean;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Blur handler */
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  /** Additional CSS classes */
  className?: string;
  /** react-hook-form register return (alternative to onChange/onBlur) */
  register?: any;
}

/**
 * TextArea Field Component
 *
 * Renders a multi-line text input with Victorian styling and optional character counter.
 * Supports auto-resize to fit content as user types.
 *
 * **Benefits**:
 * - **Consistent Styling**: Victorian aesthetic across all textareas
 * - **Character Counter**: Shows current/max characters
 * - **Auto-Resize**: Grows with content (optional)
 * - **Error Handling**: Automatic error state styling
 * - **react-hook-form**: Easy integration with form validation
 *
 * @param {TextAreaFieldProps} props - Component props
 * @returns {JSX.Element} Rendered textarea field
 *
 * @example
 * ```typescript
 * import { TextAreaField } from '@/components/forms/TextAreaField';
 *
 * function CharacterCreationForm() {
 *   const [background, setBackground] = useState('');
 *
 *   return (
 *     <TextAreaField
 *       id="background"
 *       label="Background"
 *       value={background}
 *       onChange={(e) => setBackground(e.target.value)}
 *       placeholder="Descrivi la storia del tuo personaggio..."
 *       maxLength={1000}
 *       rows={6}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With react-hook-form and auto-resize
 * function CharacterForm() {
 *   const { register, watch, formState: { errors } } = useForm();
 *
 *   return (
 *     <TextAreaField
 *       id="description"
 *       label="Descrizione"
 *       value={watch('description') || ''}
 *       error={errors.description?.message}
 *       register={register('description')}
 *       placeholder="Aspetto fisico e personalità..."
 *       maxLength={500}
 *       autoResize={true}
 *       required
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Disabled textarea
 * <TextAreaField
 *   id="notes"
 *   label="Note Master"
 *   value={masterNotes}
 *   disabled={true}
 *   rows={3}
 * />
 * ```
 */
export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  id,
  name,
  value,
  placeholder,
  label,
  hint,
  error,
  disabled = false,
  required = false,
  rows = 4,
  maxLength,
  autoResize = false,
  onChange,
  onBlur,
  className = '',
  register,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Auto-resize textarea to fit content
   *
   * Adjusts textarea height to match content height.
   * Triggered on value change when autoResize is enabled.
   */
  useEffect(() => {
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;

      // Reset height to recalculate
      textarea.style.height = 'auto';

      // Set height to scrollHeight (content height)
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value, autoResize]);

  // Character count (if maxLength is set)
  const characterCount = maxLength && value ? value.length : null;

  // Merge register props with manual props
  const textareaProps = register
    ? {
        ...register,
        id,
        name: name || id,
        value,
        placeholder,
        disabled,
        required,
        rows,
        maxLength,
        ref: (e: HTMLTextAreaElement) => {
          // Handle both react-hook-form ref and our ref
          register.ref(e);
          (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = e;
        },
        className: `textarea-field__textarea ${error ? 'textarea-field__textarea--error' : ''}`,
      }
    : {
        id,
        name: name || id,
        value,
        placeholder,
        onChange,
        onBlur,
        disabled,
        required,
        rows,
        maxLength,
        ref: textareaRef,
        className: `textarea-field__textarea ${error ? 'textarea-field__textarea--error' : ''}`,
      };

  return (
    <div className={`textarea-field ${className}`}>
      {/* Label (optional) */}
      {label && (
        <label htmlFor={id} className="textarea-field__label">
          {label}
          {required && <span className="textarea-field__required" aria-label="required"> *</span>}
        </label>
      )}

      {/* Hint text (optional) */}
      {hint && <div className="textarea-field__hint">{hint}</div>}

      {/* Textarea wrapper */}
      <div
        className={`textarea-field__wrapper ${error ? 'textarea-field__wrapper--error' : ''} ${
          disabled ? 'textarea-field__wrapper--disabled' : ''
        }`}
      >
        <textarea {...textareaProps} aria-invalid={error ? 'true' : 'false'} />
      </div>

      {/* Footer: Character counter + Error message */}
      <div className="textarea-field__footer">
        {/* Character counter */}
        {maxLength && characterCount !== null && (
          <div
            className={`textarea-field__counter ${
              characterCount > maxLength ? 'textarea-field__counter--exceeded' : ''
            }`}
          >
            {characterCount} / {maxLength}
          </div>
        )}

        {/* Error message */}
        {error && <div className="textarea-field__error">{error}</div>}
      </div>
    </div>
  );
};
