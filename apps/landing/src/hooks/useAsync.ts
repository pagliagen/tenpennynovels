/**
 * Async State Management Hook
 *
 * Provides a state machine for managing asynchronous operations (API calls, data fetching).
 * Tracks loading, success, error, and data states automatically.
 *
 * **States**:
 * - `idle`: Initial state, no operation started
 * - `loading`: Operation in progress
 * - `success`: Operation completed successfully
 * - `error`: Operation failed
 *
 * **Use Cases**:
 * - Fetching data on component mount
 * - Loading occupations list for character creation
 * - Loading user profile
 * - Any async operation that needs loading/error handling
 *
 * @module hooks/useAsync
 */

import { useState, useCallback } from 'react';

/**
 * Async operation status
 *
 * @typedef {string} AsyncStatus
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Async state hook return type
 *
 * @interface UseAsyncReturn
 * @template T - Type of the data returned by async operation
 * @template E - Type of the error (defaults to Error)
 */
export interface UseAsyncReturn<T, E = Error> {
  /** Current status of the async operation */
  status: AsyncStatus;
  /** Data returned by successful operation (null if not success) */
  data: T | null;
  /** Error from failed operation (null if no error) */
  error: E | null;
  /** Whether operation is currently loading */
  isLoading: boolean;
  /** Whether operation completed successfully */
  isSuccess: boolean;
  /** Whether operation failed */
  isError: boolean;
  /** Whether operation is in initial idle state */
  isIdle: boolean;
  /**
   * Executes async operation and manages state
   * @param promise - Promise to execute
   * @returns Promise that resolves to the data
   */
  execute: (promise: Promise<T>) => Promise<T>;
  /**
   * Resets state back to idle
   */
  reset: () => void;
}

/**
 * Async State Hook
 *
 * Manages state for asynchronous operations with automatic loading/error handling.
 * Provides a clean state machine for async data fetching.
 *
 * **Benefits**:
 * - **State Machine**: Clean idle → loading → success/error flow
 * - **Type Safe**: Fully typed data and error states
 * - **Automatic**: Manages loading and error states automatically
 * - **Reusable**: One hook for all async operations
 *
 * @template T - Type of the data returned by async operation
 * @template E - Type of the error (defaults to Error)
 * @returns {UseAsyncReturn<T, E>} Async state and control functions
 *
 * @example
 * ```typescript
 * import { useAsync } from '@/hooks/useAsync';
 * import { apiGet } from '@/lib/api/client';
 * import type { Occupation } from '@/types';
 *
 * function CharacterCreationForm() {
 *   const { data: occupations, isLoading, isError, execute } = useAsync<Occupation[]>();
 *
 *   useEffect(() => {
 *     execute(apiGet<Occupation[]>('/occupations').then(res => res.list || []));
 *   }, []);
 *
 *   if (isLoading) return <LoadingSkeleton />;
 *   if (isError) return <div>Error loading occupations</div>;
 *
 *   return (
 *     <select>
 *       {occupations?.map(occ => (
 *         <option key={occ.id} value={occ.id}>{occ.name}</option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Fetch user profile on mount
 * function ProfilePage() {
 *   const { data: user, isLoading, execute } = useAsync<User>();
 *
 *   useEffect(() => {
 *     execute(
 *       apiGet<User>('/auth/profile').then(res => res.data!)
 *     );
 *   }, []);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return <div>Welcome, {user?.username}!</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Manual execution (e.g., button click)
 * function DataRefresher() {
 *   const { data, isLoading, execute, reset } = useAsync<Data>();
 *
 *   const handleRefresh = () => {
 *     execute(fetchData());
 *   };
 *
 *   const handleReset = () => {
 *     reset(); // Back to idle state
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleRefresh} disabled={isLoading}>
 *         {isLoading ? 'Refreshing...' : 'Refresh'}
 *       </button>
 *       <button onClick={handleReset}>Reset</button>
 *       {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAsync<T, E = Error>(): UseAsyncReturn<T, E> {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);

  /**
   * Executes async operation and manages state transitions
   *
   * State flow:
   * 1. idle → loading (when called)
   * 2. loading → success (if promise resolves)
   * 3. loading → error (if promise rejects)
   *
   * @param {Promise<T>} promise - Promise to execute
   * @returns {Promise<T>} Promise that resolves to the data
   * @throws {E} Error from failed operation
   */
  const execute = useCallback(async (promise: Promise<T>): Promise<T> => {
    setStatus('loading');
    setData(null);
    setError(null);

    try {
      const result = await promise;
      setData(result);
      setStatus('success');
      return result;
    } catch (err) {
      setError(err as E);
      setStatus('error');
      throw err;
    }
  }, []);

  /**
   * Resets state back to idle
   *
   * Clears data and error, sets status to idle.
   * Useful for resetting form or refetching data.
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  return {
    status,
    data,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isIdle: status === 'idle',
    execute,
    reset,
  };
}
