/**
 * useAuth Hook
 *
 * Manages authentication session verification and initialization.
 * Checks for existing session on mount and populates auth store.
 *
 * @module hooks/useAuth
 * @since 1.0.0
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api/client';

/**
 * Session Data from /auth/session
 * (Used as T in ApiResponse<T>)
 *
 * @interface SessionData
 * @since 1.0.0
 */
interface SessionData {
  valid: boolean;
  user?: {
    id: string;
    username: string;
    email?: string;
    displayName?: string;
    canAccessAdminPanel?: boolean;
    userRoles?: string[];
  };
  character?: {
    _id: string;
    name: string;
    surname: string;
    avatar: string | null;
    status: string;
  };
  session?: {
    expiresAt: string;
    timeRemaining: string;
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
 * Automatically verifies session on mount and populates auth store.
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

  const { setUser, setLoading } = useAuthStore();

  /**
   * Check session with backend
   *
   * Calls /auth/session endpoint to verify HTTP-only cookie.
   * If valid, populates auth store. If invalid, shows error page.
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
      const response = await api.get<SessionData>('/auth/session');

      // Check if session is valid
      if (response.success && response.data?.valid && response.data.user) {
        const user = response.data.user;

        // Transform to authStore User format
        setUser({
          _id: user.id,
          username: user.username,
          email: user.email || '',
          displayName: user.displayName || user.username,
          canAccessAdminPanel: user.canAccessAdminPanel || false,
          userRoles: user.userRoles || [],
        });

        setIsInitialized(true);
      } else {
        // No valid session - show error page
        setUser(null);
        setError('Sessione non valida o scaduta');
        setErrorType('session');
      }
    } catch (err: any) {
      console.error('[useAuth] Session check failed:', err);
      setUser(null);

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
      setLoading(false);
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
