/**
 * Login Page
 *
 * Main landing page with user authentication.
 *
 * **Features**:
 * - Victorian masked input fields (username, password)
 * - Remember me checkbox
 * - Recoverable error handling (resend verification, forgot password)
 * - SEO-optimized welcome section with keywords
 * - Character select modal popup for users with multiple characters
 *
 * **Validation**: Uses LoginSchema from validation layer
 * **Authentication**: Uses authService singleton
 * **Reduced from**: 309 lines → 140 lines (55% reduction)
 *
 * @module pages/index
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { FormPageLayout } from '@/components/layouts/FormPageLayout';
import { MaskedInput } from '@/components/forms/MaskedInput';
import { FormActions } from '@/components/forms/FormActions';
import { Button } from '@/components/Button';
import { CharacterSelectModal } from '@/components/modals/CharacterSelectModal';
import { useFormState } from '@/hooks/useFormState';
import { authService } from '@/services/AuthService';
import { LoginSchema } from '@/lib/validation/schemas';
import { handleApiFormErrors, getAllFormErrorsMessage } from '@/utils/formErrorHandler';
import { homeSchema } from '@/utils/schemas';
import { ApiError } from '@/lib/api/errors';
import type { Character } from '@/types';
import type { FieldErrors } from 'react-hook-form';

/**
 * Login form data type (inferred from Zod schema)
 */
type LoginFormData = z.infer<typeof LoginSchema>;

/**
 * Login Page Component
 *
 * Main entry point with authentication form.
 *
 * @returns {JSX.Element} Login page
 */
export default function LoginPage() {
  const router = useRouter();
  const { globalError, globalSuccess, loading, setError, setSuccess, setLoading, clearMessages, handleApiError } = useFormState();
  const [errorCode, setErrorCode] = useState<string>('');
  const [isResendingVerification, setIsResendingVerification] = useState<boolean>(false);
  const hasHandledVerificationRef = useRef(false);

  // Character select modal state
  const [showCharacterModal, setShowCharacterModal] = useState<boolean>(false);
  const [userCharacters, setUserCharacters] = useState<Character[]>([]);
  const [loggedInUsername, setLoggedInUsername] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError: setFormError,
    getValues,
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  // Watch fields for Victorian masks
  const usernameValue = watch('username', '');
  const passwordValue = watch('password', '');

  /**
   * Email verification from link: ?token=xxx → read token, clean URL, call API.
   */
  useEffect(() => {
    const token = router.query.token;
    if (!token || typeof token !== 'string' || hasHandledVerificationRef.current) {
      return;
    }
    hasHandledVerificationRef.current = true;
    router.replace('/', undefined, { shallow: true });
    setLoading(true);
    clearMessages();
    setErrorCode('');

    authService
      .verifyEmail(token)
      .then((result) => {
        if (result.success) {
          setSuccess(
            result.message ||
              'Email verificata con successo! Benvenuto su Ten Penny Novels. Puoi accedere con le tue credenziali.'
          );
        } else {
          setError(result.error || 'Verifica email fallita. Il link potrebbe essere scaduto o non valido.');
          if ((result.details as { canResend?: boolean })?.canResend) {
            setErrorCode('EMAIL_NOT_VERIFIED');
          }
        }
      })
      .catch((err) => {
        console.error('Email verification error:', err);
        if (err instanceof ApiError) {
          setError(err.message);
          if ((err.details as { canResend?: boolean })?.canResend) {
            setErrorCode('EMAIL_NOT_VERIFIED');
          }
        } else {
          setError('Si è verificato un errore durante la verifica. Riprova più tardi.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router, router.query.token, setLoading, clearMessages, setSuccess, setError, setErrorCode]);

  /**
   * Handle resend verification email
   */
  const handleResendVerification = async () => {
    try {
      setIsResendingVerification(true);
      clearMessages();
      setErrorCode('');

      const { username } = getValues();
      const result = await authService.resendVerification(username);

      if (result.success && result.data) {
        setSuccess(result.message || 'Email di verifica inviata! Controlla la tua casella email.');
        // Keep errorCode cleared so button disappears
      } else {
        handleApiError(result);
        // Don't restore EMAIL_NOT_VERIFIED code
      }
    } catch (error) {
      setError('Errore di connessione durante l\'invio della verifica');
      console.error('Errore resend verification:', error);
    } finally {
      setIsResendingVerification(false);
    }
  };

  /**
   * Handle client-side validation failure: show all field errors in the top banner
   * instead of inline under each field.
   */
  const onInvalid = (formErrors: FieldErrors<LoginFormData>) => {
    const message = getAllFormErrorsMessage(formErrors);
    if (message) setError(message);
  };

  /**
   * Handle form submission
   */
  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true);
      clearMessages();
      setErrorCode('');

      // ✅ CRITICAL: Clear ALL session-related storage BEFORE login
      // Defense: Prevent session pollution from previous user (shared device scenario)
      try {
        sessionStorage.removeItem('character_session_id');
        if (process.env.NODE_ENV === 'development') {
          console.log('[Login] SessionStorage cleared');
        }
      } catch (storageError) {
        console.error('[Login] Failed to clear sessionStorage:', storageError);
        // Non-blocking: continue login even if cleanup fails
      }

      const result = await authService.login(data);

      if (process.env.NODE_ENV === 'development') {
        console.log('[Login] result.success:', result.success, 'hasData:', !!result.data);
      }

      if (result.success && result.data) {
        // Show character select modal or redirect based on number of characters
        // Backend returns { data: { user: { characters, username }, session: {...}, sessionId?: string } }
        const userData = result.data;

        // NEW: Save sessionId to sessionStorage HERE (guaranteed client-side)
        if (userData.sessionId) {
          try {
            sessionStorage.setItem('character_session_id', userData.sessionId);

            // ✅ CRITICAL: Verify write succeeded (defense against QuotaExceededError)
            const stored = sessionStorage.getItem('character_session_id');
            if (stored !== userData.sessionId) {
              throw new Error('sessionStorage write verification failed');
            }

            if (process.env.NODE_ENV === 'development') {
              console.log('[Login Page] sessionId saved and verified');
            }
          } catch (error) {
            // ✅ CRITICAL: ABORT login on storage failure (show error to user)
            console.error('[Login Page] ❌ sessionStorage write failed:', error);
            setError('Impossibile salvare la sessione. Svuota la cache del browser.');
            setLoading(false);
            return; // Stop redirect
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('[Login Page] No sessionId in response (auto-select may have been skipped).');
        }

        const userCharacters = userData.user?.characters;
        if (userCharacters && userCharacters.length > 1) {
          // Multiple characters (PG principale + PNG/Master assigned by staff) - show selection modal
          setUserCharacters(userCharacters);
          setLoggedInUsername(userData.user.username || userData.user.displayName || 'Utente');
          setShowCharacterModal(true);
        } else {
          // Single character or no characters - redirect to game
          // NOTE: sessionId passed as query param because sessionStorage is NOT shared between origins (landing vs game app)
          const gameUrl = process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:4001';
          const sessionId = userData.sessionId || sessionStorage.getItem('character_session_id');

          if (sessionId) {
            window.location.href = `${gameUrl}?sessionId=${sessionId}`;
          } else {
            window.location.href = gameUrl;
          }
        }
      } else {
        handleApiFormErrors(result, setFormError, setError);
        setErrorCode(result.code || '');
      }
    } catch (error) {
      setError('Si è verificato un errore imprevisto');
      console.error('Errore login:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPageLayout
      title="Ten Penny Novels | Gioco di Ruolo Londra Vittoriana"
      description="Ten Penny Novels: GDR gratuito nella Londra Vittoriana 1890. Call of Cthulhu via chat, narrazione investigativa. Crea il tuo personaggio e gioca."
      canonical="https://tenpennynovels.com/"
      schema={homeSchema}
      noindex={false}
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="login-form">
        <div className="login-fields">
          <MaskedInput
            id="username"
            maskType="text"
            placeholder="Nickname"
            value={usernameValue}
            error={errors.username?.message}
            register={register('username')}
            required
            autoComplete="username"
            disabled={loading}
          />

          <MaskedInput
            id="password"
            maskType="password"
            placeholder="Password"
            value={passwordValue}
            error={errors.password?.message}
            register={register('password')}
            required
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <div className={`login-actions ${errorCode ? 'login-actions--with-errors' : ''}`}>
          {/* Recoverable Error Actions */}
          {errorCode && (
            <div className="login-actions__error-actions">
              {errorCode === 'EMAIL_NOT_VERIFIED' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendVerification}
                  loading={isResendingVerification}
                >
                  Reinvia Email di Verifica
                </Button>
              )}
              {errorCode === 'INVALID_PASSWORD' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push('/forgot-password')}
                >
                  Password dimenticata? Clicca qui per resettarla
                </Button>
              )}
              {errorCode === 'USER_NOT_FOUND' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push('/register')}
                >
                  Non hai un account? Registrati qui
                </Button>
              )}
            </div>
          )}

          <FormActions
            submitText="Gioca >>"
            submitLoading={loading}
            align="right"
          />
        </div>
      </form>

      {/* Character Select Modal */}
      <CharacterSelectModal
        isOpen={showCharacterModal}
        characters={userCharacters}
        username={loggedInUsername}
        onClose={() => setShowCharacterModal(false)}
      />
    </FormPageLayout>
  );
}
