/**
 * Authentication Store (Zustand)
 *
 * Lightweight auth state for the documents app.
 * Tracks whether the user is authenticated and basic user info.
 *
 * @module store/authStore
 * @since 2.0.0
 */

import { create } from 'zustand';

interface AuthUser {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  canAccessAdminPanel?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true }),

  logout: () => set({ user: null, isAuthenticated: false }),
}));
