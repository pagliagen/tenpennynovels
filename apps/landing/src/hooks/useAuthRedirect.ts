/**
 * Authentication Redirect Hook
 *
 * Checks if user is authenticated and redirects to login if not.
 * Used for protected pages that require authentication.
 *
 * **Eliminates**: 20-30 lines of auth check logic per protected page.
 *
 * **Use Cases**:
 * - Protected pages that require authentication
 * - Any page that requires logged-in user
 *
 * **How it works**:
 * 1. Fetches current user from API (`/auth/me` or similar)
 * 2. If not authenticated → redirect to login
 * 3. If authenticated → return user data
 * 4. Shows loading state during check
 *
 * @module hooks/useAuthRedirect
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAsync } from './useAsync';
import { apiGet } from '@/lib/api/client';
import type { User } from '@/types';

/**
 * Auth redirect hook return type
 *
 * @interface UseAuthRedirectReturn
 */
export interface UseAuthRedirectReturn {
  /** Current authenticated user (null if not authenticated or loading) */
  user: User | null;
  /** Whether auth check is in progress */
  isLoading: boolean;
  /** Whether auth check failed */
  isError: boolean;
}

/**
 * Authentication Redirect Hook
 *
 * Checks user authentication status and redirects to login if not authenticated.
 * Protected pages should use this hook to ensure user is logged in.
 *
 * **Flow**:
 * 1. Component mounts
 * 2. Hook fetches current user from API
 * 3. If authenticated → return user data, render page
 * 4. If not authenticated → redirect to login
 * 5. Show loading state during check
 *
 * **Benefits**:
 * - **DRY**: Single hook replaces repeated auth check logic
 * - **Automatic**: Handles redirect automatically
 * - **Loading State**: Built-in loading indicator
 * - **Type Safe**: Returns fully typed User object
 *
 * @param {string} [redirectTo='/'] - Where to redirect if not authenticated (default: login page)
 * @returns {UseAuthRedirectReturn} User data, loading, and error states
 *
 * @example
 * ```typescript
 * import { useAuthRedirect } from '@/hooks/useAuthRedirect';
 *
 * function CharacterCreationPage() {
 *   const { user, isLoading } = useAuthRedirect();
 *
 *   // Show loading while checking auth
 *   if (isLoading) {
 *     return <LoadingSkeleton />;
 *   }
 *
 *   // If not authenticated, hook redirects automatically
 *   // If this renders, user is authenticated
 *   return (
 *     <div>
 *       <h1>Create Character for {user?.username}</h1>
 *       <CharacterCreationForm userId={user!.id} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Character select page
 * function CharacterSelectPage() {
 *   const { user, isLoading } = useAuthRedirect();
 *   const [characters, setCharacters] = useState<Character[]>([]);
 *
 *   useEffect(() => {
 *     if (user) {
 *       // Fetch user's characters
 *       fetchCharacters(user.id).then(setCharacters);
 *     }
 *   }, [user]);
 *
 *   if (isLoading) return <div>Checking authentication...</div>;
 *
 *   return (
 *     <div>
 *       <h1>Select Character</h1>
 *       {characters.map(char => (
 *         <CharacterCard key={char.id} character={char} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Custom redirect URL
 * function AdminPage() {
 *   const { user, isLoading } = useAuthRedirect('/login?next=/admin');
 *
 *   if (isLoading) return <LoadingSkeleton />;
 *
 *   // Check if user is admin
 *   if (user?.role !== 'admin') {
 *     return <div>Access denied</div>;
 *   }
 *
 *   return <AdminDashboard />;
 * }
 * ```
 */
export function useAuthRedirect(redirectTo: string = '/'): UseAuthRedirectReturn {
  const router = useRouter();
  const { data: user, isLoading, isError, execute } = useAsync<User>();

  /**
   * Fetches current user on mount
   *
   * Calls `/auth/me` endpoint to get current authenticated user.
   * If 401 response → user not authenticated → redirect to login.
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiGet<User>('/auth/me');

        if (response.success && response.data) {
          // User is authenticated
          await execute(Promise.resolve(response.data));
        } else {
          // API returned success=false → not authenticated
          router.replace(redirectTo);
        }
      } catch (error) {
        // API call failed (likely 401 Unauthorized)
        // Response interceptor will handle redirect to login
        // But we also handle it here for redundancy
        if (typeof window !== 'undefined') {
          router.replace(redirectTo);
        }
      }
    };

    checkAuth();
  }, [execute, router, redirectTo]);

  return {
    user,
    isLoading,
    isError,
  };
}
