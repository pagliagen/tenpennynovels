import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { AuthService } from '@/lib/auth';
import { VictorianLayout } from '@/components/VictorianLayout';


interface ForgotPasswordFormData {
  identifier: string; // username or email
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    watch
  } = useForm<ForgotPasswordFormData>();

  // Watch field for custom mask
  const identifierValue = watch('identifier', '');

  // Custom identifier mask effect
  useEffect(() => {
    const updateIdentifierMask = () => {
      const maskElement = document.getElementById('forgot-identifier-mask');
      if (maskElement) {
        maskElement.textContent = identifierValue || '';
      }
    };
    updateIdentifierMask();
  }, [identifierValue]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');
      
      const result = await AuthService.forgotPassword(data.identifier);
      
      if (result.success) {
        setSuccessMessage(result.message || 'Email di reset inviata con successo!');
      } else {
        setError(result.error || 'Errore durante l\'invio della richiesta di reset');
      }
      
    } catch (error) {
      setError('Errore di connessione durante l\'invio della richiesta');
      console.error('Errore forgot password:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - Recupera Password</title>
        <meta name="description" content="Recupera la tua password per accedere a TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle="Recupera Password">
        {/* Forgot Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="loginForm forgotPasswordForm">
              <div className="formFields">
                <div className="loginField usernameField">
                  <input
                    type="text"
                    placeholder="Username o Email"
                    {...register('identifier', {
                      required: 'Username o Email obbligatorio',
                      minLength: {
                        value: 3,
                        message: 'Deve avere almeno 3 caratteri'
                      }
                    })}
                    className="loginInput"
                  />
                  <span className="usernameMask" id="forgot-identifier-mask"></span>
                </div>
                {errors.identifier && (
                  <div className="errorMessage">
                    {errors.identifier.message}
                  </div>
                )}

                {error && (
                  <div className="errorMessage">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="successMessage">
                    {successMessage}
                  </div>
                )}
              </div>

              {/* Actions Row */}
              <div className="actionsRow">
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  className="loginButton"
                >
                  Invia Email
                </Button>

                <div className="secondaryActions">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push('/')}
                    className="secondaryButton"
                  >
                    Torna al Login
                  </Button> 
                </div>
            </div>
          </form>
      </VictorianLayout>
    </>
  );
}