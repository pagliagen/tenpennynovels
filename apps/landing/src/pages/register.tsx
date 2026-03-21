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
import { TermsContent } from '@/components/content/TermsContent';
import { PrivacyContent } from '@/components/content/PrivacyContent';
import { CreditsContent } from '@/components/content/CreditsContent';
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
  const [activeInfo, setActiveInfo] = useState<'terms' | 'privacy' | 'credits' | null>(null);

  const infoComponents = {
    terms: <TermsContent />,
    privacy: <PrivacyContent />,
    credits: <CreditsContent />,
  } as const;

  // No longer needed - VictorianLayout handles modal rendering
  // We just pass activeInfo and setActiveInfo as props

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
        if (result.success && !result.data?.available) {
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
        if (result.success && !result.data?.available) {
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

      const result = await authService.register(data);

      if (result.success) {
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
      title="Ten Penny Novels | Registrazione Gratuita"
      description="Registrati gratis a Ten Penny Novels! Crea il tuo personaggio per il gioco di ruolo Call of Cthulhu ambientato nella Londra Vittoriana. Inizia subito la tua avventura investigativa."
      canonical="https://tenpennynovels.com/register/"
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
      activeInfo={activeInfo}
      onSetActiveInfo={setActiveInfo}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="register-form"> 
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
                <button
                  type="button"
                  onClick={() => setActiveInfo(activeInfo === 'terms' ? null : 'terms')}
                  style={{ color: 'var(--color-primary)', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                >
                  termini e condizioni
                </button>{' '}
                e la{' '}
                <button
                  type="button"
                  onClick={() => setActiveInfo(activeInfo === 'privacy' ? null : 'privacy')}
                  style={{ color: 'var(--color-primary)', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                >
                  privacy policy
                </button> 
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
