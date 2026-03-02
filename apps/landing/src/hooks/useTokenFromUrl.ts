/**
 * Token Extraction Hook
 *
 * Extracts authentication token from URL parameters (query string or route params).
 * Used for token-based pages: verify-email, reset-password, delete-account.
 *
 * **Eliminates**: 15-20 lines of router/query parsing per token page × 3 pages = 45-60 lines saved.
 *
 * **Use Cases**:
 * - Email verification: `/verify-email?token=abc123`
 * - Password reset: `/reset-password/[token]`
 * - Account deletion: `/delete-account/[token]`
 *
 * **How it works**:
 * 1. Tries to extract token from Next.js router query params
 * 2. Handles both query string (`?token=...`) and route params (`/[token]`)
 * 3. Returns token string or null if not found/invalid
 *
 * @module hooks/useTokenFromUrl
 */

import { useRouter } from 'next/router';
import { useMemo } from 'react';

/**
 * Token extraction hook return type
 *
 * @interface UseTokenFromUrlReturn
 */
export interface UseTokenFromUrlReturn {
  /** Extracted token string (null if not found or invalid) */
  token: string | null;
  /** Whether router is ready (false during SSR or initial load) */
  isReady: boolean;
}

/**
 * Token Extraction Hook
 *
 * Extracts authentication token from URL parameters.
 * Handles both query string and route params automatically.
 *
 * **Supported URL Formats**:
 * - Query string: `/verify-email?token=abc123`
 * - Route param: `/reset-password/abc123` (with `[token]` dynamic route)
 * - Combined: `/reset-password/[token]?redirect=/dashboard`
 *
 * **SSR Safety**:
 * - Returns `isReady: false` during SSR
 * - Returns `isReady: true` after client-side router initialization
 * - Wait for `isReady` before validating token
 *
 * @returns {UseTokenFromUrlReturn} Token and router ready state
 *
 * @example
 * ```typescript
 * import { useTokenFromUrl } from '@/hooks/useTokenFromUrl';
 *
 * function VerifyEmailPage() {
 *   const { token, isReady } = useTokenFromUrl();
 *
 *   useEffect(() => {
 *     if (isReady && token) {
 *       verifyEmail(token);
 *     }
 *   }, [isReady, token]);
 *
 *   if (!isReady) return <div>Loading...</div>;
 *   if (!token) return <div>Token mancante</div>;
 *
 *   return <div>Verifying token...</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Reset password page with [token] route param
 * // File: pages/reset-password/[token].tsx
 * function ResetPasswordPage() {
 *   const { token, isReady } = useTokenFromUrl();
 *   const [isValid, setIsValid] = useState(false);
 *
 *   useEffect(() => {
 *     if (isReady && token) {
 *       validateToken(token).then(setIsValid);
 *     }
 *   }, [isReady, token]);
 *
 *   if (!isReady) return <LoadingSkeleton />;
 *   if (!token || !isValid) return <TokenExpiredMessage />;
 *
 *   return <ResetPasswordForm token={token} />;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Delete account confirmation
 * // URL: /delete-account/abc123def456
 * function DeleteAccountPage() {
 *   const { token, isReady } = useTokenFromUrl();
 *
 *   if (!isReady) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   if (!token) {
 *     return <div>Link non valido</div>;
 *   }
 *
 *   return <DeleteAccountForm token={token} />;
 * }
 * ```
 */
export function useTokenFromUrl(): UseTokenFromUrlReturn {
  const router = useRouter();

  /**
   * Extracts token from router query params
   *
   * Checks both:
   * 1. Direct query string: `?token=abc123`
   * 2. Route param: `/[token]` → `router.query.token`
   *
   * Memoized to avoid recalculation on every render.
   */
  const token = useMemo(() => {
    if (!router.isReady) {
      return null;
    }

    // Extract token from query params
    const { token: tokenParam } = router.query;

    // Handle both string and string[] (Next.js can return array for repeated params)
    if (Array.isArray(tokenParam)) {
      return tokenParam[0] || null;
    }

    return tokenParam || null;
  }, [router.isReady, router.query]);

  return {
    token,
    isReady: router.isReady,
  };
}
