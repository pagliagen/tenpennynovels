/**
 * useAuth Hook
 *
 * Non-blocking session check. Populates authStore on success,
 * silently sets isAuthenticated=false on 401.
 * The documents app is public: auth is optional.
 *
 * @module hooks/useAuth
 * @since 2.0.0
 */

import { useEffect, useState } from 'react';

import { api } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';

interface SessionUser {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  canAccessAdminPanel?: boolean;
}

interface SessionResponse {
  success: boolean;
  data?: {
    valid: boolean;
    user?: SessionUser;
    /**
     * Permessi del personaggio attivo. Il backend li restituisce solo se la
     * richiesta portava X-Session-Id (apiClient lo aggiunge da sessionStorage
     * quando l'utente è arrivato dal gioco).
     */
    gamePermissions?: string[];
  };
}

export interface UseAuthReturn {
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const { setUser, logout, setInitialized } = useAuthStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const response = await api.get<SessionResponse>('/auth/session');

        if (cancelled) return;

        if (response.success && response.data?.valid && response.data.user) {
          setUser(response.data.user, response.data.gamePermissions ?? []);
        } else {
          logout();
        }
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsInitialized(true);
          setInitialized();
        }
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [setUser, logout, setInitialized]);

  return { isLoading, isInitialized, isAuthenticated };
}
