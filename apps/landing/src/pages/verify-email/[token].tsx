/**
 * Verify Email Page (Token-based)
 *
 * Verify user email using token from email link.
 *
 * **Features**:
 * - Token validation with loading state
 * - Automatic email verification on page load
 * - Automatic redirect to login after success
 * - No form required (automatic process)
 *
 * **Authentication**: Uses authService singleton
 * **Reduced from**: 140 lines → 80 lines (43% reduction)
 *
 * @module pages/verify-email/[token]
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';

import { TokenPageLayout } from '@/components/layouts/TokenPageLayout';
import { Button } from '@/components/Button';
import { useFormState } from '@/hooks/useFormState';
import { useTokenFromUrl } from '@/hooks/useTokenFromUrl';
import { authService } from '@/services/AuthService';

/**
 * Verify Email Page Component
 *
 * Automatic email verification via token.
 *
 * @returns {JSX.Element} Verify email page
 */
export default function VerifyEmailPage() {
  const router = useRouter();

  // Extract token from URL
  const { token } = useTokenFromUrl();

  const { globalError, globalSuccess, setError, setSuccess, clearMessages } = useFormState();

  /**
   * Verify email automatically when token is available
   */
  useEffect(() => {
    if (!token) {
      setError('Token di verifica mancante nell\'URL');
      return;
    }

    const verifyEmail = async () => {
      try {
        const result = await authService.verifyEmail(token);

        if (result.result) {
          setSuccess(result.message || 'La tua email è stata verificata con successo! Verrai reindirizzato al login...');
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/?verified=true');
          }, 3000);
        } else {
          setError(result.error || 'Errore durante la verifica email');
        }
      } catch (error) {
        setError('Errore di connessione durante la verifica');
        console.error('Errore verifica email:', error);
      }
    };

    verifyEmail();
  }, [token, setError, setSuccess, router]);

  return (
    <TokenPageLayout
      title="Verifica Email - TenpennyNovels"
      description="Verifica del tuo indirizzo email per TenpennyNovels"
      isValidating={!globalError && !globalSuccess}
      isValid={!!globalSuccess}
      tokenError={globalError || undefined}
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      {globalSuccess && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Button
            type="button"
            variant="primary"
            onClick={() => router.push('/')}
          >
            Vai al Login
          </Button>
        </div>
      )}

      {globalError && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/')}
          >
            Torna alla Home
          </Button>
        </div>
      )}
    </TokenPageLayout>
  );
}
