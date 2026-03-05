/**
 * Email Verification Page
 *
 * Verifies user email address using token from verification link.
 *
 * **Features**:
 * - Automatic verification on page load
 * - Loading state with Victorian styling
 * - Success message with auto-redirect to login (5s)
 * - Error handling with resend option
 *
 * **Flow**:
 * 1. Extract token from URL path parameter
 * 2. Call backend verification endpoint
 * 3. Update user.isEmailVerified = true
 * 4. Show welcome message
 * 5. Redirect to login after 5 seconds
 *
 * @module pages/verify-email/[token]
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { FormPageLayout } from '@/components/layouts/FormPageLayout';
import { authService } from '@/services/AuthService';
import { ApiError } from '@/lib/api/errors';

/**
 * Email Verification Page Component
 *
 * Handles email verification via token from URL.
 *
 * @returns {JSX.Element} Verification page
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [canResend, setCanResend] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendUsername, setResendUsername] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // Only verify once token is available
    if (!token || typeof token !== 'string') {
      return;
    }

    const verifyEmail = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await authService.verifyEmail(token);

        if (result.result) {
          // Extract username from response if available
          const user = (result.data as any)?.user;
          if (user?.username) {
            setUsername(user.username);
          }

          setSuccess(
            result.message ||
            'Email verificata con successo! Benvenuto su TenpennyNovels. Verrai reindirizzato al login...'
          );

          // Redirect to login after 5 seconds
          setTimeout(() => {
            router.push('/');
          }, 50000);
        } else {
          setError(result.error || 'Verifica email fallita. Il link potrebbe essere scaduto o non valido.');

          // Check if user can resend verification email
          if (result.details?.canResend) {
            setCanResend(true);
          }
        }
      } catch (err) {
        console.error('Email verification error:', err);

        // Handle ApiError with specific message
        if (err instanceof ApiError) {
          setError(err.message);

          // Check if user can resend verification email
          if (err.details?.canResend) {
            setCanResend(true);
          }
        } else {
          setError('Si è verificato un errore durante la verifica. Riprova più tardi.');
        }
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token, router]);

  /**
   * Handle resend verification email
   */
  const handleResendVerification = async () => {
    if (!resendUsername.trim()) {
      setError('Inserisci il tuo username o email');
      return;
    }

    try {
      setResendLoading(true);
      setError(null);

      const result = await authService.resendVerification(resendUsername);

      if (result.result) {
        setSuccess('Email di verifica inviata con successo! Controlla la tua casella di posta.');
        setShowResendForm(false);
        setCanResend(false);
      } else {
        setError(result.error || 'Impossibile inviare l\'email di verifica. Riprova più tardi.');
      }
    } catch (err) {
      console.error('Resend verification error:', err);

      // Handle ApiError with specific message
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Si è verificato un errore. Riprova più tardi.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  // Show loading spinner while verifying
  if (loading) {
    return (
      <FormPageLayout
        title="Verifica Email in Corso..."
        description="Verifica della tua email in corso. Attendi un momento."
        canonical="https://tenpennynovels.com/verify-email/"
      >
        <div className="verify-email-page">
          <div className="verify-email-page__loading">
            <div className="verify-email-page__spinner" />
            <p className="verify-email-page__loading-text">Stiamo verificando la tua email...</p>
          </div>
        </div>
      </FormPageLayout>
    );
  }

  // Show success or error message
  return (
    <FormPageLayout
      title={success ? "Email Verificata!" : "Verifica Email Fallita"}
      description="Risultato della verifica email"
      canonical="https://tenpennynovels.com/verify-email/"
      globalError={error}
      globalSuccess={success}
      onDismissError={() => setError(null)}
      onDismissSuccess={() => setSuccess(null)}
    >
      <div className="verify-email-page">
        {success ? (
          <div className="verify-email-page__success">
            <div className="verify-email-page__success-icon">✓</div>
            <h2 className="verify-email-page__title">Benvenuto{username ? `, ${username}` : ''}!</h2>
            <p className="verify-email-page__message">
              La tua email è stata verificata con successo.
            </p>
            <p className="verify-email-page__redirect-notice">
              Verrai reindirizzato alla pagina di login tra pochi secondi...
            </p>
            <button
              onClick={() => router.push('/')}
              className="verify-email-page__button"
            >
              Vai al Login Ora
            </button>
          </div>
        ) : (
          <div className="verify-email-page__error">
            <div className="verify-email-page__error-icon">✕</div>
            <h2 className="verify-email-page__title">Verifica Fallita</h2>
            <p className="verify-email-page__message">{error}</p>

            {/* Show resend form if token is expired */}
            {canResend && !showResendForm && (
              <button
                onClick={() => setShowResendForm(true)}
                className="verify-email-page__button verify-email-page__button--secondary"
              >
                Reinvia Email di Verifica
              </button>
            )}

            {/* Resend form */}
            {showResendForm && (
              <div className="verify-email-page__resend-form">
                <p className="verify-email-page__resend-label">
                  Inserisci il tuo username o email per ricevere un nuovo link di verifica:
                </p>
                <input
                  type="text"
                  value={resendUsername}
                  onChange={(e) => setResendUsername(e.target.value)}
                  placeholder="Username o Email"
                  className="verify-email-page__resend-input"
                  disabled={resendLoading}
                />
                <div className="verify-email-page__resend-actions">
                  <button
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="verify-email-page__button"
                  >
                    {resendLoading ? 'Invio in corso...' : 'Invia'}
                  </button>
                  <button
                    onClick={() => setShowResendForm(false)}
                    disabled={resendLoading}
                    className="verify-email-page__button verify-email-page__button--secondary"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {!showResendForm && (
              <div className="verify-email-page__error-actions">
                <button
                  onClick={() => router.push('/')}
                  className="verify-email-page__button verify-email-page__button--secondary"
                >
                  Torna al Login
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </FormPageLayout>
  );
}
