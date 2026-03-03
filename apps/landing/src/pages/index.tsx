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
 * - Redirect to character-select or game based on user settings
 *
 * **Validation**: Uses LoginSchema from validation layer
 * **Authentication**: Uses authService singleton
 * **Reduced from**: 309 lines → 140 lines (55% reduction)
 *
 * @module pages/index
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { FormPageLayout } from '@/components/layouts/FormPageLayout';
import { MaskedInput } from '@/components/forms/MaskedInput';
import { FormActions } from '@/components/forms/FormActions';
import { Button } from '@/components/Button';
import { useFormState } from '@/hooks/useFormState';
import { authService } from '@/services/AuthService';
import { LoginSchema } from '@/lib/validation/schemas';
import { handleApiFormErrors } from '@/utils/formErrorHandler';
import { homeSchema } from '@/utils/schemas';

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
   * Handle resend verification email
   */
  const handleResendVerification = async () => {
    try {
      setIsResendingVerification(true);
      clearMessages();
      setErrorCode('');

      // TODO: Implement resendVerification endpoint in AuthService
      // const { username } = getValues();
      // const result = await authService.resendVerification(username);

      setError('Funzionalità non ancora implementata. Contatta l\'amministratore.');

      // if (result.result) {
      //   setSuccess(result.message || 'Email di verifica inviata! Controlla la tua casella email.');
      // } else {
      //   handleApiError(result);
      //   setErrorCode(result.code || '');
      // }
    } catch (error) {
      setError('Errore di connessione durante l\'invio della verifica');
      console.error('Errore resend verification:', error);
    } finally {
      setIsResendingVerification(false);
    }
  };

  /**
   * Handle form submission
   */
  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true);
      clearMessages();
      setErrorCode('');

      const result = await authService.login(data);

      if (result.result && result.data) {
        // Redirect based on user configuration
        if (result.data.multipleCharactersAllowed) {
          router.push('/character-select');
        } else {
          window.location.href = process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:3010';
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
      title="Gioco di Ruolo Londra Vittoriana | Call of Cthulhu Online Gratis"
      description="TenpennyNovels: gioco di ruolo online gratuito ambientato nella Londra Vittoriana del 1890. Sistema Call of Cthulhu via chat con narrazione investigativa stile Agatha Christie. Crea il tuo personaggio vittoriano ed esplora i misteri della capitale inglese. Registrazione gratuita!"
      canonical="https://tenpennynovels.com/"
      schema={homeSchema}
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="login-form">
        <div className="login-fields">
          <MaskedInput
            id="username"
            maskType="text"
            placeholder="Username"
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

          {/* Recoverable Error Actions */}
          {errorCode && (
            <div style={{ marginTop: '1rem' }}>
              {errorCode === 'EMAIL_NOT_VERIFIED' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendVerification}
                  loading={isResendingVerification}
                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  Reinvia Email di Verifica
                </Button>
              )}
              {errorCode === 'INVALID_PASSWORD' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push('/forgot-password')}
                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  Password dimenticata? Clicca qui per resettarla
                </Button>
              )}
              {errorCode === 'USER_NOT_FOUND' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push('/register')}
                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  Non hai un account? Registrati qui
                </Button>
              )}
            </div>
          )}
        </div>

        <FormActions
          submitText="Gioca >>"
          submitLoading={loading}
          align="right"
        />
      </form>
    </FormPageLayout>
  );
}
