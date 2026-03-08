/**
 * Victorian Masked Input Component
 *
 * Input field with Victorian decorative mask overlay.
 * **BIGGEST WIN**: Eliminates 80+ lines of useEffect per form × 4 forms = 320 lines saved.
 *
 * **What is a Victorian Mask?**
 * A decorative overlay that shows the input value with Victorian-era styling:
 * - For text: Actual value with decorative font (via CSS)
 * - For password: Bullets (✦✦✦✦✦✦) instead of characters
 * - For email: Email address with Victorian styling
 *
 * **Architecture**:
 * ```html
 * <div class="masked-field">
 *   <input type="text" /> <!-- Real input (opacity: 0, user types here) -->
 *   <div class="mask">Decorative text</div> <!-- Overlay (visible) -->
 * </div>
 * ```
 *
 * **Why This Approach?**
 * - User types in real input (accessibility, clipboard, autocomplete work)
 * - Overlay shows Victorian styled version (visual aesthetics)
 * - CSS masks the real input (opacity: 0) but keeps it interactive
 *
 * @module components/forms/MaskedInput
 */

import React from 'react';
import { useMaskedField } from '@/hooks/useMaskedField';
import type { MaskType } from '@/hooks/useMaskedField';

/**
 * MaskedInput component props
 *
 * @interface MaskedInputProps
 */
export interface MaskedInputProps {
  /** Unique input ID (for label association) */
  id: string;
  /** Input name attribute */
  name?: string;
  /** Type of Victorian mask to apply */
  maskType: MaskType;
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
  /** Autocomplete attribute (e.g., 'username', 'email', 'current-password') */
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
 * Victorian Masked Input Component
 *
 * Renders an input field with Victorian decorative mask overlay.
 * Automatically syncs mask with input value using `useMaskedField` hook.
 *
 * **Features**:
 * - Victorian decorative masks (text, password, email)
 * - Error state styling
 * - Disabled state styling
 * - react-hook-form integration
 * - Accessibility (real input remains interactive)
 * - SSR safe (masks activate client-side only)
 *
 * @param {MaskedInputProps} props - Component props
 * @returns {JSX.Element} Rendered masked input
 *
 * @example
 * ```typescript
 * import { MaskedInput } from '@/components/forms/MaskedInput';
 *
 * function LoginForm() {
 *   const [username, setUsername] = useState('');
 *
 *   return (
 *     <MaskedInput
 *       id="username"
 *       maskType="text"
 *       value={username}
 *       onChange={(e) => setUsername(e.target.value)}
 *       placeholder="Username"
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With react-hook-form
 * import { useForm } from 'react-hook-form';
 *
 * function RegisterForm() {
 *   const { register, watch, formState: { errors } } = useForm();
 *
 *   return (
 *     <>
 *       <MaskedInput
 *         id="username"
 *         maskType="text"
 *         value={watch('username') || ''}
 *         error={errors.username?.message}
 *         register={register('username')}
 *       />
 *
 *       <MaskedInput
 *         id="password"
 *         maskType="password"
 *         value={watch('password') || ''}
 *         error={errors.password?.message}
 *         register={register('password')}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Email field with error
 * <MaskedInput
 *   id="email"
 *   maskType="email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   placeholder="Email"
 *   error="Email non valida"
 *   autoComplete="email"
 * />
 * ```
 */
export const MaskedInput: React.FC<MaskedInputProps> = ({
  id,
  name,
  maskType,
  value,
  placeholder,
  error,
  disabled = false,
  required = false,
  autoComplete,
  onChange,
  onBlur,
  className = '',
  register,
}) => {
  const { maskValue, isMaskActive } = useMaskedField(value, maskType);

  // Determine input type (password for password mask, text otherwise)
  const inputType = maskType === 'password' ? 'password' : 'text';

  // Merge register props with manual props
  const inputProps = register
    ? {
        ...register,
        id,
        name: name || id,
        type: inputType,
        value,
        placeholder,
        disabled,
        required,
        autoComplete,
        className: `masked-field__input ${error ? 'masked-field__input--error' : ''}`,
      }
    : {
        id,
        name: name || id,
        type: inputType,
        value,
        onChange,
        onBlur,
        placeholder,
        disabled,
        required,
        autoComplete,
        className: `masked-field__input ${error ? 'masked-field__input--error' : ''}`,
      };

  return (
    <div className={`masked-field-wrapper ${className}`}>
      <div
        className={`masked-field ${error ? 'masked-field--error' : ''} ${
          disabled ? 'masked-field--disabled' : ''
        } masked-field--${maskType}`}
      >
        {/* Real input (hidden but interactive) */}
        <input {...inputProps} />

        {/* Decorative Victorian mask overlay */}
        {isMaskActive && (
          <div className="masked-field__mask" aria-hidden="true">
            {maskValue || placeholder}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && <div className="masked-field__error">{error}</div>}
    </div>
  );
};
