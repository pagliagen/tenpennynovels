/**
 * Reset Password Page (Token-based)
 *
 * Reset password using token from email link.
 *
 * **Features**:
 * - Token validation with loading state
 * - Password and confirm password fields
 * - Form validation with Zod schema
 * - Automatic redirect to login after success
 *
 * **Validation**: Uses ResetPasswordSchema from validation layer
 * **Authentication**: Uses authService singleton
 * **Reduced from**: 293 lines → 120 lines (59% reduction)
 *
 * @module pages/reset-password/[token]
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { TokenPageLayout } from '@/components/layouts/TokenPageLayout';
import { PasswordField } from '@/components/forms/PasswordField';
import { FormActions } from '@/components/forms/FormActions';
import { useFormState } from '@/hooks/useFormState';
import { useTokenFromUrl } from '@/hooks/useTokenFromUrl';
import { authService } from '@/services/AuthService';
import { ResetPasswordSchema } from '@/lib/validation/schemas';
import { handleApiFormErrors } from '@/utils/formErrorHandler';

/**
 * Reset password form data type
 */
type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>;

/**
 * Reset Password Page Component
 *
 * Token-based password reset.
 *
 * @returns {JSX.Element} Reset password page
 */
export default function ResetPasswordPage() {
  const router = useRouter();

  // Extract token from URL
  const { token, isReady } = useTokenFromUrl();

  const { globalError, globalSuccess, loading, setError, setSuccess, setLoading, clearMessages } = useFormState();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError: setFormError,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  // Watch passwords for masked display
  const passwordValue = watch('password', '');
  const confirmPasswordValue = watch('confirmPassword', '');

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Token mancante');
      return;
    }

    try {
      setLoading(true);
      clearMessages();

      const result = await authService.resetPassword(token, data.password, data.confirmPassword);

      if (result.result) {
        setSuccess(result.message || 'Password cambiata con successo! Verrai reindirizzato al login...');
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/?password_reset=true');
        }, 3000);
      } else {
        handleApiFormErrors(result, setFormError, setError);
      }
    } catch (error) {
      setError('Errore di connessione durante il cambio password');
      console.error('Errore reset password:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TokenPageLayout
      title="Reset Password - Ten Penny Novels"
      description="Reset della password per Ten Penny Novels"
      isReady={isReady}
      token={token}
      isValidating={false}
      isValid={!!token}
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="reset-password-form">
        <div className="reset-password-fields">
          <PasswordField
            id="password"
            placeholder="Nuova Password"
            value={passwordValue}
            error={errors.password?.message}
            register={register('password')}
            required
            autoComplete="new-password"
            disabled={loading}
          />

          <PasswordField
            id="confirmPassword"
            placeholder="Conferma Password"
            value={confirmPasswordValue}
            error={errors.confirmPassword?.message}
            register={register('confirmPassword')}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <FormActions
          submitText="Cambia Password"
          submitLoading={loading}
          submitDisabled={loading || !token}
          secondaryText="Torna al Login"
          onSecondaryClick={() => router.push('/')}
        />
      </form>
    </TokenPageLayout>
  );
}
