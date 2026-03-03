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
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api/client';
import type { Character } from '@/types/api/schemas';

/**
 * Session Check Response from /auth/session
 *
 * @interface SessionResponse
 * @since 2.0.0
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
      userRoles?: string[];
      characterRoles?: string[];
      characterPermissions?: string[];
      isEmailVerified?: boolean;
      multipleCharactersAllowed?: boolean;
      characters?: Character[];
    };
    character?: Character | null;
    gamePermissions?: string[]; // NEW: Game permissions from backend
    session?: {
      expiresAt: string;
      timeRemaining?: string;
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

  const { setUser, setSelectedCharacter, setGamePermissions, setInitialized, logout, selectedCharacter: currentSelectedCharacter } = useAuthStore();

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

      console.log('[useAuth] Session check RAW response:', response);
      console.log('[useAuth] Response structure check:', {
        hasResult: 'result' in response,
        resultValue: response.result,
        hasData: 'data' in response,
        dataValid: response.data?.valid,
        hasUser: !!response.data?.user,
        userUsername: response.data?.user?.username,
      });

      // Check if session is valid
      // Backend returns: { result: true, data: { valid: true, user: {...}, character: {...}, gamePermissions: [...] } }
      if (response.result && response.data?.valid && response.data.user) {
        const { user, character, gamePermissions } = response.data;

        // Populate auth store with user data
        // TODO: Fix type mismatch between session response and User schema
        setUser(user as any);

        // Set selected character if available
        // CRITICAL: Preserve local currentLocation if already set (prevents overwrite from backend)
        if (character) {
          const preservedLocation = currentSelectedCharacter?.currentLocation;
          setSelectedCharacter({
            ...character,
            // Preserve local currentLocation if it exists (chat page may have updated it)
            currentLocation: preservedLocation || character.currentLocation
          });

          if (preservedLocation && preservedLocation !== character.currentLocation) {
            console.log('[useAuth] 🔒 Preserved local currentLocation:', preservedLocation, '(backend had:', character.currentLocation, ')');
          }
        }

        // Set game permissions from backend
        if (gamePermissions) {
          setGamePermissions(gamePermissions);
        }

        console.log('[useAuth] ✅ Session valid - user authenticated:', user.username);
        console.log('[useAuth] Game permissions loaded:', gamePermissions?.length || 0, 'permissions');
        setIsInitialized(true);
      } else {
        // No valid session - show error page instead of redirect
        console.warn('[useAuth] ❌ No valid session detected');
        console.warn('[useAuth] Response was:', JSON.stringify(response, null, 2));
        logout();

        // Show session error page
        setError('Sessione non valida o scaduta');
        setErrorType('session');
      }
    } catch (err: any) {
      console.error('[useAuth] Session check failed:', err);
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
