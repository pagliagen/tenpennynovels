/**
 * useAuth Hook
 *
 * Manages authentication session verification and initialization.
 * Checks for existing session on mount and populates auth store.
 *
 * CRITICAL Flow:
 * 1. User logs in via apps/landing → HTTP-only cookie set
 * 2. User redirected to apps/game
 * 3. This hook calls /auth/session to verify cookie
 * 4. If valid, populate authStore → WebSocket connects
 * 5. If invalid, show error page instead of redirect
 *
 * @module hooks/useAuth
 * @since 2.0.0
 */

import { useEffect, useState } from 'react';

import { api } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import type { CharacterBanSessionPayload } from '@/types/authSession';
import type { Character } from '@/types/api/schemas';
import { logger } from '@/lib/logger';

/**
 * Session User Data (subset returned by /auth/session)
 *
 * Contains only the essential user fields needed for session validation.
 * Full User model has more fields but backend only returns these 3.
 *
 * @interface SessionUser
 * @since 2.0.0
 */
interface SessionUser {
  id: string;                    // User MongoDB _id as string
  username: string;              // User's username
  canAccessAdminPanel: boolean;  // Whether user/character can access admin panel
}

/**
 * Session Character Data (subset returned by /auth/session)
 *
 * Contains only selected character fields needed for game permissions.
 *
 * @interface SessionCharacter
 * @since 2.0.0
 */
interface SessionCharacter {
  _id: string;
  name: string;
  surname: string;
  avatar: string | null;
  playerStatus: string;
  isGestore: boolean;
}

/**
 * Session Check Response from /auth/session
 *
 * @interface SessionResponse
 * @since 2.0.0
 */
interface SessionResponse {
  success: boolean;
  data?: {
    valid: boolean;
    user?: SessionUser;
    character?: SessionCharacter | null;
    gamePermissions?: string[];
    ban?: CharacterBanSessionPayload | null;
    session?: {
      expiresAt: string;
      timeRemaining: string;
    };
  };
}

/**
 * Auth Hook Return Type
 *
 * @interface UseAuthReturn
 * @since 2.0.0
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
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isLoading, isInitialized, error, errorType } = useAuth();
 *
 *   if (isLoading) return <LoadingScreen />;
 *   if (error) return <ErrorScreen type={errorType} message={error} />;
 *   if (!isInitialized) return null;
 *
 *   return <GameLayout />;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'session' | 'server' | null>(null);

  const { setSelectedCharacter, setGamePermissions, setInitialized, logout, setAdminPanelAccessFromSession, setCharacterBan } =
    useAuthStore();

  /**
   * Check session with backend
   *
   * Calls /auth/session endpoint to verify HTTP-only cookie.
   * If valid, populates auth store. If invalid, shows error page.
   *
   * @async
   * @function checkSession
   * @returns {Promise<void>}
   * @since 2.0.0
   */
  const checkSession = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      setErrorType(null);

      // Call /auth/session - cookie sent automatically via withCredentials
      const response = await api.get<SessionResponse>('/auth/session');

      if (process.env.NODE_ENV === 'development') {
        logger.info('[useAuth] /auth/session ok:', { args: [response.success, 'valid:', response.data?.valid] });
      }

      // Check if session is valid
      // Backend returns: { success: true, data: { valid: true, user: {...}, character: {...}, gamePermissions: [...] } }
      if (response.success && response.data?.valid && response.data.user) {
        const { character, gamePermissions, ban } = response.data;

        setCharacterBan(ban ?? null);

        // Backend restituisce un sottoinsieme utente; non salviamo l'intero User nello store,
        // ma `canAccessAdminPanel` è derivato dal PG in sessione (Redis) ed è la fonte corretta per il link admin in TopBar.
        setAdminPanelAccessFromSession(!!response.data.user?.canAccessAdminPanel);
        useAuthStore.setState({ isAuthenticated: true });

        // Set selected character if available
        // NOTE: Backend returns only 6 fields (_id, name, surname, avatar, playerStatus, isGestore)
        // but Character type has many more required fields. This is safe because:
        // 1. UI only uses these 6 fields from session validation
        // 2. Full character data is loaded separately by game components when needed
        if (character) {
          setSelectedCharacter(character as unknown as Character);
        }

        // Set game permissions from backend
        if (gamePermissions) {
          setGamePermissions(gamePermissions);
        }

        if (process.env.NODE_ENV === 'development') {
          logger.info('[useAuth] Session valid:', { args: [response.data.user.username, 'permissions:', gamePermissions?.length ?? 0] });
        }
        setIsInitialized(true);
      } else {
        // No valid session - show error page instead of redirect
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[useAuth] No valid session');
        }
        logout();

        // Show session error page
        setError('Sessione non valida o scaduta');
        setErrorType('session');
      }
    } catch (err: any) {
      logger.error('[useAuth] Session check failed:', { err });
      logout();

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
      setInitialized();
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
