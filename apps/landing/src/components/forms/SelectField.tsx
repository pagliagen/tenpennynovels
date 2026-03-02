/**
 * Select Field Component
 *
 * Dropdown select input with Victorian styling.
 * Used for occupation selection, age selection, and other predefined choices.
 *
 * **Features**:
 * - Victorian decorative styling
 * - Error state display
 * - Disabled state support
 * - react-hook-form integration
 * - Keyboard accessible
 *
 * @module components/forms/SelectField
 */

import React from 'react';

/**
 * Select option data structure
 *
 * @interface SelectOption
 */
export interface SelectOption {
  /** Option value (what is submitted) */
  value: string;
  /** Option label (what user sees) */
  label: string;
  /** Whether option is disabled */
  disabled?: boolean;
}

/**
 * SelectField component props
 *
 * @interface SelectFieldProps
 */
export interface SelectFieldProps {
  /** Unique select ID (for label association) */
  id: string;
  /** Select name attribute */
  name?: string;
  /** Current selected value */
  value?: string;
  /** Array of options to display (use either this or children) */
  options?: SelectOption[];
  /** Children option elements (use either this or options array) */
  children?: React.ReactNode;
  /** Placeholder text (shown as first disabled option) */
  placeholder?: string;
  /** Label text (displayed above select) */
  label?: string;
  /** Hint text (displayed below label) */
  hint?: string;
  /** Error message (displayed below select) */
  error?: string;
  /** Whether select is disabled */
  disabled?: boolean;
  /** Whether select is required */
  required?: boolean;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Blur handler */
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  /** Additional CSS classes */
  className?: string;
  /** react-hook-form register return (alternative to onChange/onBlur) */
  register?: any;
}

/**
 * Select Field Component
 *
 * Renders a dropdown select with Victorian styling and error handling.
 *
 * **Benefits**:
 * - **Consistent Styling**: Victorian aesthetic across all selects
 * - **Error Handling**: Automatic error state styling
 * - **Accessibility**: Proper label association and ARIA attributes
 * - **react-hook-form**: Easy integration with form validation
 *
 * @param {SelectFieldProps} props - Component props
 * @returns {JSX.Element} Rendered select field
 *
 * @example
 * ```typescript
 * import { SelectField } from '@/components/forms/SelectField';
 *
 * function CharacterCreationForm() {
 *   const [occupation, setOccupation] = useState('');
 *
 *   const occupations: SelectOption[] = [
 *     { value: '1', label: 'Medico' },
 *     { value: '2', label: 'Commerciante' },
 *     { value: '3', label: 'Artista' },
 *   ];
 *
 *   return (
 *     <SelectField
 *       id="occupation"
 *       label="Occupazione"
 *       value={occupation}
 *       options={occupations}
 *       placeholder="Seleziona occupazione..."
 *       onChange={(e) => setOccupation(e.target.value)}
 *       required
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With react-hook-form
 * function CharacterForm() {
 *   const { register, watch, formState: { errors } } = useForm();
 *
 *   return (
 *     <SelectField
 *       id="age"
 *       label="Età"
 *       value={watch('age') || ''}
 *       options={ageOptions}
 *       error={errors.age?.message}
 *       register={register('age')}
 *       required
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Disabled select
 * <SelectField
 *   id="socialClass"
 *   label="Classe Sociale"
 *   value={socialClass}
 *   options={socialClasses}
 *   disabled={true}
 *   placeholder="Determinata automaticamente"
 * />
 * ```
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  name,
  value,
  options,
  children,
  placeholder,
  label,
  hint,
  error,
  disabled = false,
  required = false,
  onChange,
  onBlur,
  className = '',
  register,
}) => {
  // Merge register props with manual props
  const selectProps = register
    ? {
        ...register,
        id,
        name: name || id,
        value,
        disabled,
        required,
        className: `select-field__select ${error ? 'select-field__select--error' : ''}`,
      }
    : {
        id,
        name: name || id,
        value,
        onChange,
        onBlur,
        disabled,
        required,
        className: `select-field__select ${error ? 'select-field__select--error' : ''}`,
      };

  return (
    <div className={`select-field ${className}`}>
      {/* Label (optional) */}
      {label && (
        <label htmlFor={id} className="select-field__label">
          {label}
          {required && <span className="select-field__required" aria-label="required"> *</span>}
        </label>
      )}

      {/* Hint text (optional) */}
      {hint && <div className="select-field__hint">{hint}</div>}

      {/* Select wrapper (for custom arrow styling) */}
      <div
        className={`select-field__wrapper ${error ? 'select-field__wrapper--error' : ''} ${
          disabled ? 'select-field__wrapper--disabled' : ''
        }`}
      >
        <select {...selectProps} aria-invalid={error ? 'true' : 'false'}>
          {/* Placeholder (shown as first disabled option) */}
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {/* Options */}
          {children ? children : options?.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Custom arrow icon */}
        <div className="select-field__arrow" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Error message */}
      {error && <div className="select-field__error">{error}</div>}
    </div>
  );
};
