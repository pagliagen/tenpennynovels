/**
 * Victorian Masked Field Hook
 *
 * Manages Victorian decorative mask overlay for input fields.
 * Eliminates 80+ lines of duplicated useEffect logic × 4 pages = 320 lines saved.
 *
 * **What is a Victorian Mask?**
 * A decorative overlay that shows the input value with Victorian-era styling:
 * - For text: Shows actual value with decorative font
 * - For password: Shows bullets (✦✦✦✦) instead of actual characters
 * - For email: Shows email with Victorian styling
 *
 * **Why Client-Side Only?**
 * Victorian masks use DOM manipulation and must only run in the browser.
 * This hook ensures SSR safety by only activating masks after mount.
 *
 * **Architecture**:
 * ```
 * <div className="masked-field">
 *   <input value={value} /> <!-- Real input (opacity: 0) -->
 *   <div className="mask">{maskValue}</div> <!-- Decorative overlay -->
 * </div>
 * ```
 *
 * @module hooks/useMaskedField
 */

import { useState, useEffect } from 'react';

/**
 * Mask type options
 *
 * @typedef {string} MaskType
 */
export type MaskType = 'text' | 'password' | 'email';

/**
 * Masked field hook return type
 *
 * @interface UseMaskedFieldReturn
 */
export interface UseMaskedFieldReturn {
  /** Decorative mask value to display in overlay */
  maskValue: string;
  /** Whether masks are active (false during SSR) */
  isMaskActive: boolean;
}

/**
 * Generates mask value based on input type
 *
 * Transforms actual input value into decorative Victorian mask representation.
 *
 * **Transformation Rules**:
 * - `text`: Shows actual value (Victorian font applied via CSS)
 * - `password`: Shows bullets (✦ for each character)
 * - `email`: Shows actual email (Victorian font applied via CSS)
 *
 * @param {string} value - Actual input value
 * @param {MaskType} type - Type of mask to apply
 * @returns {string} Transformed mask value
 *
 * @example
 * ```typescript
 * generateMaskValue('hello', 'text');
 * // Returns: 'hello'
 *
 * generateMaskValue('password123', 'password');
 * // Returns: '✦✦✦✦✦✦✦✦✦✦✦'
 *
 * generateMaskValue('user@example.com', 'email');
 * // Returns: 'user@example.com'
 * ```
 */
function generateMaskValue(value: string, type: MaskType): string {
  if (!value) {
    return '';
  }

  switch (type) {
    case 'password':
      // Replace each character with bullet
      return '✦'.repeat(value.length);
    case 'text':
    case 'email':
    default:
      // Show actual value (Victorian styling applied via CSS)
      return value;
  }
}

/**
 * Victorian Masked Field Hook
 *
 * Provides Victorian decorative mask overlay for input fields.
 * Automatically updates mask when value changes.
 * SSR-safe (masks only activate after client-side mount).
 *
 * **Benefits**:
 * - **DRY**: Eliminates 80+ lines of useEffect per form
 * - **SSR Safe**: Masks activate only in browser
 * - **Type Safe**: Fully typed with TypeScript
 * - **Automatic**: Syncs mask with input value automatically
 *
 * @param {string} value - Current input field value
 * @param {MaskType} type - Type of mask ('text', 'password', 'email')
 * @returns {UseMaskedFieldReturn} Mask value and active state
 *
 * @example
 * ```typescript
 * import { useMaskedField } from '@/hooks/useMaskedField';
 *
 * function MaskedInput({ value, type }) {
 *   const { maskValue, isMaskActive } = useMaskedField(value, type);
 *
 *   return (
 *     <div className="masked-field">
 *       {/* Real input (hidden) *\/}
 *       <input
 *         type={type === 'password' ? 'password' : 'text'}
 *         value={value}
 *         onChange={onChange}
 *         className="masked-field__input"
 *       />
 *
 *       {/* Decorative mask overlay *\/}
 *       {isMaskActive && (
 *         <div className="masked-field__mask">
 *           {maskValue}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Password field
 * const { maskValue } = useMaskedField('myPassword123', 'password');
 * // maskValue: '✦✦✦✦✦✦✦✦✦✦✦✦'
 *
 * // Text field
 * const { maskValue } = useMaskedField('John Doe', 'text');
 * // maskValue: 'John Doe' (with Victorian CSS styling)
 * ```
 *
 * @example
 * ```typescript
 * // SSR-safe usage
 * function LoginForm() {
 *   const [password, setPassword] = useState('');
 *   const { maskValue, isMaskActive } = useMaskedField(password, 'password');
 *
 *   // During SSR: isMaskActive = false, maskValue = ''
 *   // After mount: isMaskActive = true, maskValue = '✦✦✦✦✦✦'
 *
 *   return (
 *     <div className="masked-field">
 *       <input
 *         type="password"
 *         value={password}
 *         onChange={(e) => setPassword(e.target.value)}
 *       />
 *       {isMaskActive && <div className="mask">{maskValue}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMaskedField(value: string, type: MaskType): UseMaskedFieldReturn {
  const [maskValue, setMaskValue] = useState<string>('');
  const [isMaskActive, setIsMaskActive] = useState<boolean>(false);

  // Activate masks only after client-side mount (SSR safety)
  useEffect(() => {
    setIsMaskActive(true);
  }, []);

  // Update mask value when input value changes
  useEffect(() => {
    if (isMaskActive) {
      const newMaskValue = generateMaskValue(value, type);
      setMaskValue(newMaskValue);
    }
  }, [value, type, isMaskActive]);

  return {
    maskValue,
    isMaskActive,
  };
}
