/**
 * Debounce Hook
 *
 * Delays updating a value until after a specified delay has passed since the last change.
 * Useful for expensive operations like API calls, search queries, or validation checks.
 *
 * **Use Cases**:
 * - Username/email availability checks (wait for user to stop typing)
 * - Search input (avoid API spam on every keystroke)
 * - Form validation (wait before showing errors)
 * - Auto-save (wait for user to stop editing)
 *
 * **How it works**:
 * 1. User types "john" → value changes 4 times
 * 2. Each keystroke resets the timer
 * 3. After 500ms of no changes → debouncedValue updates once
 * 4. API call triggered only once instead of 4 times
 *
 * @module hooks/useDebounce
 */

import { useState, useEffect } from 'react';

/**
 * Debounce Hook
 *
 * Returns a debounced version of the input value that only updates after
 * the specified delay has passed since the last value change.
 *
 * **Benefits**:
 * - **Performance**: Reduces expensive operations (API calls, re-renders)
 * - **UX**: Avoids flickering or premature error messages
 * - **Resource Saving**: Prevents API spam
 *
 * @template T - Type of the value to debounce
 * @param {T} value - Value to debounce
 * @param {number} [delay=500] - Delay in milliseconds (default: 500ms)
 * @returns {T} Debounced value
 *
 * @example
 * ```typescript
 * import { useDebounce } from '@/hooks/useDebounce';
 *
 * function UsernameAvailability() {
 *   const [username, setUsername] = useState('');
 *   const debouncedUsername = useDebounce(username, 500);
 *
 *   // Check availability only when user stops typing for 500ms
 *   useEffect(() => {
 *     if (debouncedUsername.length >= 3) {
 *       checkUsernameAvailability(debouncedUsername);
 *     }
 *   }, [debouncedUsername]);
 *
 *   return (
 *     <input
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
 * // Search input with 300ms debounce
 * function SearchBox() {
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 300);
 *
 *   useEffect(() => {
 *     if (debouncedQuery) {
 *       fetchSearchResults(debouncedQuery);
 *     }
 *   }, [debouncedQuery]);
 *
 *   return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Email validation with 1 second debounce
 * function EmailField() {
 *   const [email, setEmail] = useState('');
 *   const debouncedEmail = useDebounce(email, 1000);
 *
 *   useEffect(() => {
 *     if (debouncedEmail) {
 *       validateEmailFormat(debouncedEmail);
 *     }
 *   }, [debouncedEmail]);
 *
 *   return <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />;
 * }
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: Clear timeout if value changes before delay expires
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}
