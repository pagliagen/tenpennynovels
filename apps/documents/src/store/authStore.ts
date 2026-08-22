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
  /**
   * Permessi di gioco del personaggio attivo, da GET /auth/session.
   *
   * Presenti solo se la richiesta portava l'header X-Session-Id, cioè se
   * l'utente è arrivato qui dal link nel gioco: il ruolo master vive sul
   * personaggio, non sull'utente. Servono unicamente a decidere cosa mostrare
   * — l'autorità resta il backend, che filtra liste, dettaglio e ricerca.
   */
  gamePermissions: string[];
  /**
   * True quando GET /auth/session ha risposto (in un senso o nell'altro).
   * Senza questo flag un gate mostrerebbe "non autorizzato" nel frame prima
   * che i permessi arrivino.
   */
  isInitialized: boolean;
}

interface AuthActions {
  setUser: (user: AuthUser, gamePermissions?: string[]) => void;
  logout: () => void;
  setInitialized: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isAuthenticated: false,
  gamePermissions: [],
  isInitialized: false,

  setUser: (user, gamePermissions = []) =>
    set({ user, isAuthenticated: true, gamePermissions }),

  logout: () => set({ user: null, isAuthenticated: false, gamePermissions: [] }),

  setInitialized: () => set({ isInitialized: true }),
}));

/** Permesso di lettura del manuale master (config/permissions/game.ts). */
export const MASTER_MANUAL_PERMISSION = 'game:documents:master-manual:read';

/**
 * Selettore: il richiedente può vedere i documenti riservati ai master?
 *
 * Solo per nascondere la tab e la voce di menu. Non è un controllo di
 * sicurezza: quello è nel backend.
 */
export const selectCanReadMasterManual = (state: AuthStore): boolean =>
  state.gamePermissions.includes(MASTER_MANUAL_PERMISSION);
