/**
 * Token Page Layout Component
 *
 * Layout wrapper for pages that require token validation (verify-email, reset-password, delete-account).
 * Handles loading state, token validation, and error display automatically.
 *
 * **Benefits**:
 * - **DRY**: Eliminates 30-40 lines of token validation UI per page
 * - **Consistency**: All token pages have same loading/error UX
 * - **Automatic**: Handles loading, missing token, invalid token states
 *
 * **Wrapped Components**:
 * - PageLayout (SEO + VictorianLayout)
 * - LoadingSkeleton (while validating token)
 * - Alert (for invalid/missing token errors)
 *
 * @module components/layouts/TokenPageLayout
 */

import React from 'react';
import { PageLayout, type PageLayoutProps } from './PageLayout';
import { Alert } from '../Alert';

/**
 * TokenPageLayout component props
 *
 * @interface TokenPageLayoutProps
 * @extends Omit<PageLayoutProps, 'children'>
 */
export interface TokenPageLayoutProps extends Omit<PageLayoutProps, 'children'> {
  /** Page content (rendered only if token is valid) */
  children: React.ReactNode;
  /** Whether router is ready (from useTokenFromUrl) */
  isReady?: boolean;
  /** Extracted token (null if missing) */
  token?: string | null;
  /** Whether token validation is in progress */
  isValidating?: boolean;
  /** Whether token is valid (after validation) */
  isValid?: boolean;
  /** Error message (if token is invalid) */
  errorMessage?: string;
  /** Token error (alias for errorMessage) */
  tokenError?: string;
  /** Global error message */
  globalError?: string | null;
  /** Global success message */
  globalSuccess?: string | null;
  /** Callback to dismiss error message */
  onDismissError?: () => void;
  /** Callback to dismiss success message */
  onDismissSuccess?: () => void;
  /** Optional custom loading message */
  loadingMessage?: string;
}

/**
 * Token Page Layout Component
 *
 * Renders a page layout that handles token validation states automatically.
 * Use this for all token-based pages.
 *
 * **State Machine**:
 * 1. **Router not ready** → Show loading
 * 2. **Token missing** → Show error ("Link non valido")
 * 3. **Validating token** → Show loading
 * 4. **Token invalid** → Show error (custom message)
 * 5. **Token valid** → Render children
 *
 * **Eliminated Boilerplate**:
 * - Loading state UI
 * - Token missing error UI
 * - Token validation loading UI
 * - Token invalid error UI
 * Total: ~30-40 lines per token page
 *
 * **Integration with useTokenFromUrl**:
 * ```typescript
 * const { token, isReady } = useTokenFromUrl();
 * const [isValid, setIsValid] = useState(false);
 * const [isValidating, setIsValidating] = useState(true);
 *
 * useEffect(() => {
 *   if (isReady && token) {
 *     validateToken(token).then(setIsValid).finally(() => setIsValidating(false));
 *   }
 * }, [isReady, token]);
 *
 * return (
 *   <TokenPageLayout
 *     title="..."
 *     description="..."
 *     isReady={isReady}
 *     token={token}
 *     isValidating={isValidating}
 *     isValid={isValid}
 *   >
 *     <TokenForm token={token!} />
 *   </TokenPageLayout>
 * );
 * ```
 *
 * @param {TokenPageLayoutProps} props - Component props
 * @returns {JSX.Element} Rendered token page layout
 *
 * @example
 * ```typescript
 * import { TokenPageLayout } from '@/components/layouts/TokenPageLayout';
 * import { useTokenFromUrl } from '@/hooks/useTokenFromUrl';
 *
 * function VerifyEmailPage() {
 *   const { token, isReady } = useTokenFromUrl();
 *   const [isValid, setIsValid] = useState(false);
 *   const [isValidating, setIsValidating] = useState(true);
 *
 *   useEffect(() => {
 *     if (isReady && token) {
 *       apiGet(`/auth/verify-email?token=${token}`)
 *         .then(res => setIsValid(res.result))
 *         .finally(() => setIsValidating(false));
 *     } else if (isReady && !token) {
 *       setIsValidating(false);
 *     }
 *   }, [isReady, token]);
 *
 *   return (
 *     <TokenPageLayout
 *       title="Verifica Email"
 *       description="Verifica il tuo indirizzo email"
 *       isReady={isReady}
 *       token={token}
 *       isValidating={isValidating}
 *       isValid={isValid}
 *       errorMessage="Link di verifica non valido o scaduto"
 *     >
 *       <VerifiedMessage />
 *     </TokenPageLayout>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Reset password page
 * <TokenPageLayout
 *   title="Reset Password"
 *   description="Reimposta la tua password"
 *   isReady={isReady}
 *   token={token}
 *   isValidating={isValidating}
 *   isValid={isValid}
 *   errorMessage="Link di reset password non valido o scaduto"
 *   loadingMessage="Validazione link in corso..."
 * >
 *   <ResetPasswordForm token={token!} />
 * </TokenPageLayout>
 * ```
 */
export const TokenPageLayout: React.FC<TokenPageLayoutProps> = ({
  title,
  description,
  canonical,
  ogType,
  ogImage,
  noindex = true, // Token pages are typically noindex
  nofollow,
  schema,
  subtitle,
  isReady,
  token,
  isValidating = false,
  isValid = false,
  errorMessage = 'Link non valido o scaduto',
  loadingMessage = 'Caricamento...',
  children,
}) => {
  return (
    <PageLayout
      title={title}
      description={description}
      canonical={canonical}
      ogType={ogType}
      ogImage={ogImage}
      noindex={noindex}
      nofollow={nofollow}
      schema={schema}
      subtitle={subtitle}
    >
      <div className="token-page">
        {/* State 1: Router not ready → Loading */}
        {!isReady && (
          <div className="token-page__loading">
            <div className="token-page__spinner" />
            <p>{loadingMessage}</p>
          </div>
        )}

        {/* State 2: Router ready, no token → Error */}
        {isReady && !token && (
          <Alert
            type="error"
            message="Link non valido. Token mancante."
            dismissible={false}
          />
        )}

        {/* State 3: Token present, validating → Loading */}
        {isReady && token && isValidating && (
          <div className="token-page__loading">
            <div className="token-page__spinner" />
            <p>{loadingMessage}</p>
          </div>
        )}

        {/* State 4: Token present, validation complete, invalid → Error */}
        {isReady && token && !isValidating && !isValid && (
          <Alert
            type="error"
            message={errorMessage}
            dismissible={false}
          />
        )}

        {/* State 5: Token present, validation complete, valid → Render children */}
        {isReady && token && !isValidating && isValid && children}
      </div>
    </PageLayout>
  );
};
