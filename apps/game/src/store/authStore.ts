/**
 * Authentication Store (Zustand)
 *
 * Manages client-side authentication state including:
 * - Current user and character
 * - Login/logout actions
 * - Token management
 * - Session persistence
 *
 * CRITICAL: This store handles ONLY client state.
 * Server state (user data fetching) is handled by TanStack Query.
 *
 * @module store/authStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Character } from '@/types/api/schemas';
import { AUTH_CONFIG } from '@/constants/config';
import { clearAuthToken } from '@/lib/api/client';

/**
 * Authentication Store State
 *
 * @interface AuthState
 * @since 2.0.0
 *
 * @property {User | null} user - Currently logged in user
 * @property {Character | null} selectedCharacter - Currently selected character for gameplay
 * @property {boolean} isAuthenticated - Whether user is authenticated
 * @property {boolean} isInitialized - Whether store has been hydrated from localStorage
 */
interface AuthState {
  user: User | null;
  selectedCharacter: Character | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

/**
 * Authentication Store Actions
 *
 * @interface AuthActions
 * @since 2.0.0
 */
interface AuthActions {
  /**
   * Set authenticated user
   *
   * NOTE: Token is stored in HTTP-only cookie by backend, not in localStorage.
   * This method only sets user object and isAuthenticated flag.
   *
   * @param {User} user - User object from login response
   * @returns {void}
   */
  setUser: (user: User) => void;

  /**
   * Set selected character for gameplay
   *
   * @param {Character} character - Character object
   * @returns {void}
   */
  setSelectedCharacter: (character: Character) => void;

  /**
   * Clear selected character
   *
   * @returns {void}
   */
  clearSelectedCharacter: () => void;

  /**
   * Logout user and clear all auth data
   *
   * @returns {void}
   */
  logout: () => void;

  /**
   * Mark store as initialized (called after hydration)
   *
   * @returns {void}
   */
  setInitialized: () => void;
}

/**
 * Combined Auth Store Type
 *
 * @typedef {AuthState & AuthActions} AuthStore
 * @since 2.0.0
 */
type AuthStore = AuthState & AuthActions;

/**
 * Authentication Store Hook
 *
 * Zustand store for managing authentication state.
 * Persisted to localStorage for session continuity.
 *
 * @constant
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<AuthStore>>}
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * // In a component
 * const { user, isAuthenticated, setUser, logout } = useAuthStore();
 *
 * // Login - Token stored in HTTP-only cookie by backend
 * const handleLogin = async (credentials) => {
 *   const response = await api.post<LoginResponse>('/auth/login', credentials);
 *   setUser(response.data.user);
 * };
 *
 * // Logout
 * const handleLogout = () => {
 *   logout();
 *   router.push(ROUTES.LOGIN);
 * };
 *
 * // Check auth status
 * if (!isAuthenticated) {
 *   return <Navigate to={ROUTES.LOGIN} />;
 * }
 * ```
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      selectedCharacter: null,
      isAuthenticated: false,
      isInitialized: false,

      /**
       * Set authenticated user
       *
       * Stores user data in state. Marks user as authenticated.
       *
       * NOTE: Token is stored in HTTP-only cookie by backend, not in localStorage.
       * The browser automatically sends the cookie with every request.
       *
       * @function setUser
       * @param {User} user - User object from login response
       * @returns {void}
       * @since 2.0.0
       */
      setUser: (user) => {
        set({
          user,
          isAuthenticated: true,
        });
      },

      /**
       * Set selected character for gameplay
       *
       * Stores the character user wants to play as.
       * Character selection is required before entering game.
       *
       * @function setSelectedCharacter
       * @param {Character} character - Character object
       * @returns {void}
       * @since 2.0.0
       */
      setSelectedCharacter: (character) => {
        set({ selectedCharacter: character });
      },

      /**
       * Clear selected character
       *
       * Removes currently selected character.
       * User will need to select character again.
       *
       * @function clearSelectedCharacter
       * @returns {void}
       * @since 2.0.0
       */
      clearSelectedCharacter: () => {
        set({ selectedCharacter: null });
      },

      /**
       * Logout user and clear all auth data
       *
       * Clears user, character, and tokens from state and localStorage.
       * Sets isAuthenticated to false.
       *
       * CRITICAL: This does NOT invalidate the token on the server.
       * The API should have a logout endpoint that blacklists the token.
       *
       * @function logout
       * @returns {void}
       * @since 2.0.0
       */
      logout: () => {
        clearAuthToken();
        set({
          user: null,
          selectedCharacter: null,
          isAuthenticated: false,
        });
      },

      /**
       * Mark store as initialized
       *
       * Called after store has been hydrated from localStorage.
       * Prevents flash of unauthenticated content on page load.
       *
       * @function setInitialized
       * @returns {void}
       * @since 2.0.0
       */
      setInitialized: () => {
        set({ isInitialized: true });
      },
    }),
    {
      name: AUTH_CONFIG.USER_KEY, // localStorage key
      partialize: (state) => ({
        // Only persist these fields (exclude isInitialized)
        user: state.user,
        selectedCharacter: state.selectedCharacter,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Called after store is hydrated from localStorage
        if (state) {
          state.setInitialized();
        }
      },
    }
  )
);

/**
 * Selector Hooks for Optimized Re-renders
 *
 * Use these instead of destructuring from useAuthStore()
 * to prevent unnecessary re-renders.
 *
 * @namespace authSelectors
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * // BAD: Component re-renders on ANY auth state change
 * const { user, selectedCharacter } = useAuthStore();
 *
 * // GOOD: Component re-renders ONLY when user changes
 * const user = useAuthStore(state => state.user);
 * ```
 */
export const authSelectors = {
  /**
   * Select user object
   *
   * @returns {User | null}
   */
  user: (state: AuthStore) => state.user,

  /**
   * Select selected character
   *
   * @returns {Character | null}
   */
  selectedCharacter: (state: AuthStore) => state.selectedCharacter,

  /**
   * Select authentication status
   *
   * @returns {boolean}
   */
  isAuthenticated: (state: AuthStore) => state.isAuthenticated,

  /**
   * Select initialization status
   *
   * @returns {boolean}
   */
  isInitialized: (state: AuthStore) => state.isInitialized,

  /**
   * Check if user has selected a character
   *
   * @returns {boolean}
   */
  hasSelectedCharacter: (state: AuthStore) => state.selectedCharacter !== null,
} as const;
