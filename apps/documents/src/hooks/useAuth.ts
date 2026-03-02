/**
 * useAuth Hook
 *
 * Manages authentication session verification and initialization.
 * Checks for existing session on mount.
 *
 * @module hooks/useAuth
 * @since 1.0.0
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

/**
 * Session Check Response from /auth/session
 *
 * @interface SessionResponse
 * @since 1.0.0
 */
interface SessionResponse {
  result: boolean;
  data?: {
    valid: boolean;
    user?: {
      id: string;
      username: string;
      email?: string;
      displayName?: string;
      canAccessAdminPanel?: boolean;
    };
  };
}

/**
 * Auth Hook Return Type
 *
 * @interface UseAuthReturn
 * @since 1.0.0
 */
export interface UseAuthReturn {
  /** Whether session check is in progress */
  isLoading: boolean;

  /** Whether session check is complete */
  isInitialized: boolean;

  /** Error message if session check failed */
  error: string | null;

  /** Error type for display */
  errorType: 'network' | 'session' | 'server' | null;

  /** Manually trigger session check */
  checkSession: () => Promise<void>;
}

/**
 * useAuth Hook
 *
 * Automatically verifies session on mount.
 * Shows error page if no valid session found.
 *
 * @function useAuth
 * @returns {UseAuthReturn} Auth hook state and actions
 * @since 1.0.0
 */
export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'session' | 'server' | null>(null);

  /**
   * Check session with backend
   *
   * @async
   * @function checkSession
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  const checkSession = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      setErrorType(null);

      // Call /auth/session - cookie sent automatically via withCredentials
      const response = await api.get<SessionResponse>('/auth/session');

      console.log('[useAuth] Session check response:', response);

      // Check if session is valid
      if (response.result && response.data?.valid && response.data.user) {
        console.log('[useAuth] ✅ Session valid - user authenticated:', response.data.user.username);
        setIsInitialized(true);
      } else {
        // No valid session - show error page
        console.warn('[useAuth] ❌ No valid session detected');
        setError('Sessione non valida o scaduta');
        setErrorType('session');
      }
    } catch (err: any) {
      console.error('[useAuth] Session check failed:', err);

      // Determine error type based on error details
      if (err?.message?.includes('Network') || err?.code === 'ECONNREFUSED' || err?.code === 'ERR_NETWORK') {
        setError('Impossibile connettersi al server di autenticazione');
        setErrorType('network');
      } else if (err?.response?.status >= 500) {
        setError('Il server sta riscontrando problemi tecnici');
        setErrorType('server');
      } else {
        setError('Errore durante la verifica della sessione');
        setErrorType('session');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Check session on mount
  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isLoading,
    isInitialized,
    error,
    errorType,
    checkSession,
  };
}
