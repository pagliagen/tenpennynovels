/**
 * Forgot Password Page
 *
 * Request password reset email.
 *
 * **Features**:
 * - Victorian masked input for username/email
 * - Send reset password email
 * - Form validation with Zod schema
 *
 * **Validation**: Uses ForgotPasswordSchema from validation layer
 * **Authentication**: Uses authService singleton
 * **Reduced from**: 154 lines → 90 lines (42% reduction)
 *
 * @module pages/forgot-password
 */

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { FormPageLayout } from '@/components/layouts/FormPageLayout';
import { MaskedInput } from '@/components/forms/MaskedInput';
import { FormActions } from '@/components/forms/FormActions';
import { useFormState } from '@/hooks/useFormState';
import { authService } from '@/services/AuthService';
import { ForgotPasswordSchema } from '@/lib/validation/schemas';
import { getAllFormErrorsMessage } from '@/utils/formErrorHandler';
import { logger } from '@/lib/logger';

/**
 * Forgot password form data type
 */
type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>;

/**
 * Forgot Password Page Component
 *
 * Request password reset link via email.
 *
 * @returns {JSX.Element} Forgot password page
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { globalError, globalSuccess, loading, setError, setSuccess, setLoading, clearMessages } = useFormState();
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  // Watch field for Victorian mask
  const identifierValue = watch('identifier', '');

  /**
   * Handle client-side validation failure: show all field errors in the top banner
   * instead of inline under each field.
   */
  const onInvalid = (formErrors: FieldErrors<ForgotPasswordFormData>) => {
    const message = getAllFormErrorsMessage(formErrors);
    if (message) setError(message);
  };

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setLoading(true);
      clearMessages();

      const result = await authService.forgotPassword(data.identifier);

      if (result.success && result.data) {
        // Extract DEV header
        if (result.__devHeaders?.['x-dev-reset-password-url']) {
          setDevResetUrl(result.__devHeaders['x-dev-reset-password-url']);
        }

        setSuccess(result.message || 'Email di reset inviata con successo! Controlla la tua casella email.');
      } else {
        setError(result.error || 'Errore durante l\'invio della richiesta di reset');
      }
    } catch (error) {
      setError('Errore di connessione durante l\'invio della richiesta');
      logger.error('Errore forgot password', { error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPageLayout
      title="Ten Penny Novels | Recupera Password"
      description="Recupera la password del tuo account Ten Penny Novels."
      canonical="https://tenpennynovels.com/forgot-password/"
      noindex
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="forgot-password-form">
        <div className="forgot-password-fields">
          <MaskedInput
            id="identifier"
            maskType="text"
            placeholder="Username o Email"
            value={identifierValue}
            error={errors.identifier?.message}
            register={register('identifier')}
            required
            disabled={loading}
          />
        </div>

        <FormActions
          submitText="Invia Email di Reset"
          submitLoading={loading}
          secondaryText="Torna al Login"
          onSecondaryClick={() => router.push('/')}
        />
      </form> 
    </FormPageLayout>
  );
}
