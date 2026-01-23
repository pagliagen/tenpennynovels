import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { VictorianLayout } from '@/components/VictorianLayout';


interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<ResetPasswordFormData>();

  const newPassword = watch('newPassword');

  // Parse token from URL and verify validity when component mounts
  useEffect(() => {
    // Parse token from URL pathname (workaround for Next.js static export)
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const tokenFromUrl = pathParts[pathParts.length - 1];
    const cleanToken = tokenFromUrl?.replace(/\/$/, '');

    if (cleanToken && cleanToken !== 'reset-password') {
      setToken(cleanToken);
      verifyToken(cleanToken);
    } else {
      setTokenValid(false);
      setError('Token mancante nell\'URL');
    }
  }, []);

  const verifyToken = async (resetToken: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/reset-password/${resetToken}`, {
        method: 'GET',
      });

      if (response.ok) {
        setTokenValid(true);
      } else {
        setTokenValid(false);
        const data = await response.json();
        setError(data.error || 'Token non valido o scaduto');
      }
    } catch (error) {
      setTokenValid(false);
      setError('Errore di connessione durante la verifica del token');
    }
  };

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token || typeof token !== 'string') {
      setError('Token mancante');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/reset-password/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword
        }),
      });

      const result = await response.json();
      
      if (result.result) {
        setSuccess(result.message || 'Password cambiata con successo!');
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/?password_reset=true');
        }, 3000);
      } else {
        setError(result.error || 'Errore durante il cambio password');
      }
      
    } catch (error) {
      setError('Errore di connessione durante il cambio password');
      console.error('Errore reset password:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while verifying token
  if (tokenValid === null) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Reset Password</title>
          <meta name="description" content="Reset della password per TenpennyNovels" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>
        <VictorianLayout subtitle="Verifica Token...">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'rgba(255, 149, 0, 0.8)' }}>Verifica del token in corso...</p>
          </div>
        </VictorianLayout>
      </>
    );
  }

  // Show error if token is invalid
  if (tokenValid === false) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Token Non Valido</title>
          <meta name="description" content="Il token di reset password non è valido o è scaduto" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <VictorianLayout subtitle="Token Non Valido">
          <div className="loginForm">
                <div className="formFields">
                  <div className="errorMessage">
                    {error}
                  </div>
                </div>

                <div className="actionsRow">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => router.push('/forgot-password')}
                    className="loginButton"
                  >
                    Richiedi Nuovo Reset
                  </Button>

                  <div style={{ marginTop: '1rem' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => router.push('/')} 
                    >
                      Torna al Login
                    </Button>
                  </div>
                </div>
          </div>
        </VictorianLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - Cambia Password</title>
        <meta name="description" content="Cambia la tua password per TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle="Cambia Password">
        {/* Reset Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="loginForm">
              <div className="formFields">
                <input
                  type="password"
                  placeholder="Nuova Password"
                  {...register('newPassword', {
                    required: 'Nuova password obbligatoria',
                    minLength: {
                      value: 8,
                      message: 'La password deve avere almeno 8 caratteri'
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                      message: 'La password deve contenere almeno: 1 minuscola, 1 maiuscola, 1 numero, 1 simbolo'
                    }
                  })}
                  className="loginInput"
                />
                {errors.newPassword && (
                  <div className="errorMessage">
                    {errors.newPassword.message}
                  </div>
                )}

                <input
                  type="password"
                  placeholder="Conferma Nuova Password"
                  {...register('confirmPassword', {
                    required: 'Conferma password obbligatoria',
                    validate: (value) => value === newPassword || 'Le password non corrispondono'
                  })}
                  className="loginInput"
                />
                {errors.confirmPassword && (
                  <div className="errorMessage">
                    {errors.confirmPassword.message}
                  </div>
                )}

                {error && (
                  <div className="errorMessage">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="successMessage">
                    {success}
                    <br />
                    <small>Verrai reindirizzato al login...</small>
                  </div>
                )}
              </div>

              {/* Actions Row */}
              <div className="actionsRow">
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={success !== ''}
                  className="loginButton"
                >
                  Cambia Password
                </Button>

                <div className="secondaryActions">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push('/')}
                    className="secondaryButton"
                  >
                    Annulla
                  </Button>
                </div>
            </div>
          </form>
      </VictorianLayout>
    </>
  );
}