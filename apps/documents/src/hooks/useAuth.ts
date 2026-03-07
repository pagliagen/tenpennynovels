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
  result: boolean;
  data?: {
    valid: boolean;
    user?: SessionUser;
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
  const { setUser, logout } = useAuthStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const response = await api.get<SessionResponse>('/auth/session');

        if (cancelled) return;

        if (response.result && response.data?.valid && response.data.user) {
          setUser(response.data.user);
        } else {
          logout();
        }
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [setUser, logout]);

  return { isLoading, isInitialized, isAuthenticated };
}
