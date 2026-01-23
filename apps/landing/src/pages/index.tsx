import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { LoginCredentials } from '@/types/index';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/lib/auth';
import { VictorianLayout } from '@/components/VictorianLayout';


// Error message mapping based on backend error codes
const getErrorMessage = (code?: string, fallbackError?: string): string => {
  switch (code) {
    case 'USER_NOT_FOUND':
      return 'Utente non trovato';
    case 'INVALID_PASSWORD':
      return 'Password non corretta';
    case 'EMAIL_NOT_VERIFIED':
      return 'Devi verificare la tua email prima di poter accedere';
    case 'ACCOUNT_BANNED':
      return 'Il tuo account è stato sospeso. Contatta il supporto se ritieni sia un errore.';
    case 'RATE_LIMITED':
      return 'Troppi tentativi di login. Riprova tra qualche minuto.';
    case 'ACCOUNT_LOCKED':
      return 'Account temporaneamente bloccato per sicurezza. Riprova più tardi.';
    case 'VALIDATION_ERROR':
      return 'Dati inseriti non validi. Controlla username e password.';
    case 'LOGIN_ERROR':
      return 'Errore durante il login. Riprova.';
    case 'AUTH_REQUIRED':
      return 'Autenticazione richiesta.';
    case 'INVALID_SESSION':
      return 'Sessione non valida. Effettua nuovamente il login.';
    case 'AUTH_ERROR':
      return 'Errore di autenticazione.';
    case 'INTERNAL_SERVER_ERROR':
      return 'Errore interno del server. Riprova più tardi.';
    default:
      return fallbackError || 'Errore durante il login';
  }
};

// Helper to determine error criticality for styling
const getCriticalErrorClass = (code?: string): string => {
  const criticalErrors = ['ACCOUNT_BANNED', 'RATE_LIMITED', 'ACCOUNT_LOCKED', 'INTERNAL_SERVER_ERROR'];
  return criticalErrors.includes(code || '') ? 'criticalError' : '';
};

interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [loginError, setLoginError] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [isResendingVerification, setIsResendingVerification] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
    watch
  } = useForm<LoginFormData>();

  // Watch fields for custom masks
  const passwordValue = watch('password', '');
  const usernameValue = watch('username', '');

  // Custom username mask effect
  useEffect(() => {
    const updateUsernameMask = () => {
      const maskElement = document.getElementById('username-mask');
      if (maskElement) {
        maskElement.textContent = usernameValue || '';
      }
    };

    updateUsernameMask();
  }, [usernameValue]);

  // Custom password mask effect
  useEffect(() => {
    const updatePasswordMask = () => {
      const maskElement = document.getElementById('pwd-mask');
      if (maskElement) {
        const starSymbol = '✦';
        maskElement.textContent = starSymbol.repeat(passwordValue?.length || 0);
      }
    };

    updatePasswordMask();
  }, [passwordValue]);

  const handleResendVerification = async () => {
    try {
      setIsResendingVerification(true);
      setResendSuccess('');
      setLoginError('');

      const formData = getValues();
      const result = await AuthService.resendVerification(formData.username);

      if (result.result) {
        setResendSuccess(result.message || 'Email di verifica inviata! Controlla la tua casella email.');
      } else {
        setLoginError(result.error || 'Errore durante l\'invio della verifica');
      }
    } catch (error) {
      setLoginError('Errore di connessione durante l\'invio della verifica');
      console.error('Errore resend verification:', error);
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handlePasswordReset = () => {
    // Redirect to dedicated forgot password page
    router.push('/forgot-password');
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoginError('');
      setErrorCode('');
      setResendSuccess('');

      const credentials: LoginCredentials = {
        username: data.username,
        password: data.password,
        rememberMe: data.rememberMe
      };

      // Login tramite API Gateway
      const result = await login(credentials);

      if (result.result && result.user) {
        // Frontend handles redirect logic based on user configuration
        if (result.user.multipleCharactersAllowed) {
          // Multiple character users stay on landing for character selection
          router.push('/character-select');
        } else {
          // Single character users go directly to game (character context already set by backend)
          window.location.href = process.env.NEXT_PUBLIC_GAME_URL || 'https://game.tenpennynovels.com';
        }

        // Note: Admin panel access is available from game interface, not as default redirect
      } else {
        // Handle specific error codes from backend
        // Use backend error message if available, otherwise use mapped message
        const errorMessage = result.error || getErrorMessage(result.code);
        setLoginError(errorMessage);
        setErrorCode(result.code || '');
      }

    } catch (error) {
      setLoginError('Si è verificato un errore imprevisto');
      console.error('Errore login:', error);
    }
  };

  const isLoading = loading || isSubmitting;

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana</title>
        <meta name="description" content="Entra nel mondo della Londra Vittoriana. Un'esperienza GDR Call of Cthulhu via chat." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout>
        {/* The main content area will now be positioned in the window */}
        <div className="loginContainer">
          {/* Login form styled for the new layout */}
          <form onSubmit={handleSubmit(onSubmit)} className="loginForm">
            <div className="loginFields">
              <div className="loginField usernameField">
                <input
                  type="text"
                  placeholder="Username"
                  autoComplete="username"
                  {...register('username', {
                    required: 'Nome utente obbligatorio',
                    minLength: {
                      value: 3,
                      message: 'Il nome utente deve avere almeno 3 caratteri'
                    }
                  })}
                  className="loginInput"
                />
                <span className="usernameMask" id="username-mask"></span>
              </div>
              {errors.username && (
                <div className="errorMessage">
                  {errors.username.message}
                </div>
              )}

              <div className="loginField passwordField">
                <input
                  type="password"
                  placeholder="Password"
                  id="pwd"
                  autoComplete="current-password"
                  {...register('password', {
                    required: 'Password obbligatoria',
                    minLength: {
                      value: 6,
                      message: 'La password deve avere almeno 6 caratteri'
                    }
                  })}
                  className="loginInput"
                />
                <span className="passwordMask" id="pwd-mask"></span>
              </div>
              {errors.password && (
                <div className="errorMessage">
                  {errors.password.message}
                </div>
              )}

              {loginError && (
                <div className={`errorMessage ${getCriticalErrorClass(errorCode)}`}>
                  {loginError}
                  {/* Show action buttons only for specific recoverable errors */}
                  {errorCode === 'EMAIL_NOT_VERIFIED' && (
                    <div className="resendVerificationContainer">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleResendVerification}
                        loading={isResendingVerification}
                        className="resendButton"
                      >
                        Reinvia Email di Verifica
                      </Button>
                    </div>
                  )}
                  {errorCode === 'INVALID_PASSWORD' && (
                    <div className="resendVerificationContainer">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handlePasswordReset}
                        className="resendButton"
                      >
                        CLICCA QUI PER RESET PASSWORD
                      </Button>
                    </div>
                  )}
                  {errorCode === 'USER_NOT_FOUND' && (
                    <div className="resendVerificationContainer">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push('/register')}
                        className="resendButton"
                      >
                        CLICCA QUI PER REGISTRARTI
                      </Button>
                    </div>
                  )}
                  {/* Note: No action buttons for RATE_LIMITED, ACCOUNT_LOCKED, ACCOUNT_BANNED as they are temporary/admin issues */}
                </div>
              )}

              {resendSuccess && (
                <div className="successMessage">
                  {resendSuccess}
                </div>
              )}
            </div>

            <div className="playButtonContainer">
              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                className="playButton"
              >
                Gioca &gt;&gt;
              </Button>
            </div>
          </form>
        </div>
      </VictorianLayout>
    </>
  );
}