/**
 * Register Page
 *
 * User registration with form validation and availability checks.
 *
 * **Features**:
 * - Victorian masked input fields (username, email, password, confirm password)
 * - Debounced username/email availability checks
 * - Terms and conditions checkbox
 * - Automatic redirect to login after successful registration
 *
 * **Validation**: Uses RegisterSchema from validation layer
 * **Authentication**: Uses authService singleton
 * **Reduced from**: 371 lines → 150 lines (60% reduction)
 *
 * @module pages/register
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { FormPageLayout } from '@/components/layouts/FormPageLayout';
import { MaskedInput } from '@/components/forms/MaskedInput';
import { FormActions } from '@/components/forms/FormActions';
import { Button } from '@/components/Button';
import { useFormState } from '@/hooks/useFormState';
import { useDebounce } from '@/hooks/useDebounce';
import { authService } from '@/services/AuthService';
import { RegisterSchema } from '@/lib/validation/schemas';
import { handleApiFormErrors } from '@/utils/formErrorHandler';

/**
 * Register form data type (inferred from Zod schema)
 */
type RegisterFormData = z.infer<typeof RegisterSchema>;

/**
 * Register Page Component
 *
 * User registration form with validation and availability checks.
 *
 * @returns {JSX.Element} Register page
 */
export default function RegisterPage() {
  const router = useRouter();
  const { globalError, globalSuccess, loading, setError, setSuccess, setLoading, clearMessages, handleApiError } = useFormState();
  const [devVerificationUrl, setDevVerificationUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError: setFormError,
    clearErrors,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      agreeToTerms: false,
    },
  });

  // Watch fields for Victorian masks and availability checks
  const usernameValue = watch('username', '');
  const emailValue = watch('email', '');
  const passwordValue = watch('password', '');
  const confirmPasswordValue = watch('confirmPassword', '');

  // Debounced values for availability checks
  const debouncedUsername = useDebounce(usernameValue, 500);
  const debouncedEmail = useDebounce(emailValue, 500);

  /**
   * Check username availability (debounced)
   */
  useEffect(() => {
    if (debouncedUsername.length >= 3) {
      authService.checkUsernameAvailability(debouncedUsername).then((result) => {
        if (result.result && !result.data?.available) {
          setFormError('username', {
            type: 'manual',
            message: 'Nome utente non disponibile',
          });
        } else {
          clearErrors('username');
        }
      }).catch(() => {
        // Silently ignore availability check errors
      });
    }
  }, [debouncedUsername, setFormError, clearErrors]);

  /**
   * Check email availability (debounced)
   */
  useEffect(() => {
    if (debouncedEmail.includes('@')) {
      authService.checkEmailAvailability(debouncedEmail).then((result) => {
        if (result.result && !result.data?.available) {
          setFormError('email', {
            type: 'manual',
            message: 'Email già registrata',
          });
        } else {
          clearErrors('email');
        }
      }).catch(() => {
        // Silently ignore availability check errors
      });
    }
  }, [debouncedEmail, setFormError, clearErrors]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      clearMessages();
      setDevVerificationUrl(null); // Clear previous URL

      const result = await authService.register(data);

      if (result.result) {
        // Extract dev verification URL if present
        if (result.__devHeaders?.['X-Dev-Verification-Url']) {
          setDevVerificationUrl(result.__devHeaders['X-Dev-Verification-Url']);
        }

        setSuccess(result.message || 'Registrazione completata con successo! Verrai reindirizzato al login...');
        // Redirect to login after 5 seconds (increased from 3s to allow viewing dev URL)
        setTimeout(() => {
          router.push('/');
        }, 5000);
      } else {
        handleApiFormErrors(result, setFormError, setError);
      }
    } catch (error) {
      setError('Si è verificato un errore imprevisto');
      console.error('Errore registrazione:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPageLayout
      title="Registrazione Gratuita | Crea il Tuo Personaggio Vittoriano"
      description="Registrati gratis a TenpennyNovels! Crea il tuo personaggio per il gioco di ruolo Call of Cthulhu ambientato nella Londra Vittoriana. Inizia subito la tua avventura investigativa."
      canonical="https://tenpennynovels.com/register/"
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="register-form">
        {/* DEV ONLY: Display verification URL */}
        {devVerificationUrl && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#856404', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔧</span>
              DEV MODE: Email Verification Link
            </div>

            <div style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#333', lineHeight: '1.5' }}>
              Per velocizzare il testing, puoi verificare l'email direttamente cliccando qui sotto:
            </div>

            <a
              href={devVerificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '0.75rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                textAlign: 'center',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                marginBottom: '0.75rem',
                cursor: 'pointer'
              }}
            >
              ✓ Verifica Email Ora
            </a>

            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem', fontWeight: '500' }}>
              Oppure copia il link:
            </div>

            <input
              type="text"
              readOnly
              value={devVerificationUrl}
              onClick={(e) => {
                e.currentTarget.select();
                navigator.clipboard.writeText(devVerificationUrl).then(() => {
                  e.currentTarget.style.backgroundColor = '#d4edda';
                  setTimeout(() => e.currentTarget.style.backgroundColor = '#f8f9fa', 500);
                });
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontFamily: 'Monaco, Consolas, monospace',
                fontSize: '0.75rem',
                backgroundColor: '#f8f9fa',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                cursor: 'pointer',
                wordBreak: 'break-all'
              }}
              title="Click per selezionare e copiare"
            />

            <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.5rem', fontStyle: 'italic' }}>
              💡 Questo box appare SOLO in ambiente di sviluppo
            </div>
          </div>
        )}

        <div className="register-fields">
          <MaskedInput
            id="username"
            maskType="text"
            placeholder="Nome Utente"
            value={usernameValue}
            error={errors.username?.message}
            register={register('username')}
            required
            autoComplete="username"
            disabled={loading}
          />

          <MaskedInput
            id="email"
            maskType="text"
            placeholder="Email"
            value={emailValue}
            error={errors.email?.message}
            register={register('email')}
            required
            autoComplete="email"
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
            autoComplete="new-password"
            disabled={loading}
          />

          <MaskedInput
            id="confirmPassword"
            maskType="password"
            placeholder="Conferma Password"
            value={confirmPasswordValue}
            error={errors.confirmPassword?.message}
            register={register('confirmPassword')}
            required
            autoComplete="new-password"
            disabled={loading}
          />

          {/* Terms and Conditions Checkbox */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="agreeToTerms"
                {...register('agreeToTerms')}
                disabled={loading}
                style={{ marginTop: '0.25rem', cursor: 'pointer' }}
              />
              <label htmlFor="agreeToTerms" style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                Accetto i{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                  termini e condizioni
                </a>{' '}
                e la{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                  privacy policy
                </a>
              </label>
            </div>
            {errors.agreeToTerms && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-error)', marginTop: '0.25rem' }}>
                {errors.agreeToTerms.message}
              </div>
            )}
          </div>
        </div>

        <FormActions
          submitText="Registrati"
          submitLoading={loading}
          submitDisabled={globalSuccess !== null}
          secondaryText="Torna al Login"
          onSecondaryClick={() => router.push('/')}
        />
      </form>
    </FormPageLayout>
  );
}
