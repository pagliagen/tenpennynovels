/**
 * Auth Store - Zustand store for authentication state
 *
 * CRITICAL: Questo store gestisce SOLO lo stato auth lato client.
 * Il token JWT è in HTTP-only cookie gestito dal backend.
 * Login/logout avvengono in apps/landing.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * User interface (subset from apps/game)
 */
export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  canAccessAdminPanel: boolean;
  userRoles: string[];
}

/**
 * Auth state interface
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Auth actions interface
 */
interface AuthActions {
  setUser: (user: User | null) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
}

/**
 * Auth store type
 */
type AuthStore = AuthState & AuthActions;

/**
 * Initial state
 */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true
};

/**
 * Create auth store with persistence
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      /**
       * Set user data
       */
      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
          isLoading: false
        }),

      /**
       * Logout - Clear user data
       * CRITICAL: Cookie cleared dal backend, non qui
       */
      logout: () => {
        set(initialState);
        // Redirect to landing login
        if (typeof window !== 'undefined') {
          window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
        }
      },

      /**
       * Set loading state
       */
      setLoading: (isLoading) =>
        set({ isLoading }),

      /**
       * Clear auth state completely
       */
      clearAuth: () =>
        set(initialState)
    }),
    {
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
        // isLoading non salvato in localStorage
      })
    }
  )
);

/**
 * Selectors per performance (evitare re-renders)
 */
export const selectUser = (state: AuthStore) => state.user;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectIsLoading = (state: AuthStore) => state.isLoading;
