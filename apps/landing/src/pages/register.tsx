import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { AuthService, RegisterData } from '@/lib/auth';
import { VictorianLayout } from '@/components/VictorianLayout';


interface RegisterFormData extends RegisterData {
  confirmPassword: string;
  agreeToTerms: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const [registerError, setRegisterError] = useState<string>('');
  const [registerSuccess, setRegisterSuccess] = useState<string>('');
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setError,
    clearErrors
  } = useForm<RegisterFormData>();

  // Watch all fields for custom masks
  const usernameValue = watch('username', '');
  const emailValue = watch('email', '');
  const passwordValue = watch('password', '');
  const confirmPasswordValue = watch('confirmPassword', '');

  // Custom masks effects
  useEffect(() => {
    const updateUsernameMask = () => {
      const maskElement = document.getElementById('reg-username-mask');
      if (maskElement) {
        maskElement.textContent = usernameValue || '';
      }
    };
    updateUsernameMask();
  }, [usernameValue]);

  useEffect(() => {
    const updateEmailMask = () => {
      const maskElement = document.getElementById('reg-email-mask');
      if (maskElement) {
        maskElement.textContent = emailValue || '';
      }
    };
    updateEmailMask();
  }, [emailValue]);

  useEffect(() => {
    const updatePasswordMask = () => {
      const maskElement = document.getElementById('reg-pwd-mask');
      if (maskElement) {
        const starSymbol = '✦';
        maskElement.textContent = starSymbol.repeat(passwordValue?.length || 0);
      }
    };
    updatePasswordMask();
  }, [passwordValue]);

  useEffect(() => {
    const updateConfirmPasswordMask = () => {
      const maskElement = document.getElementById('reg-confirm-pwd-mask');
      if (maskElement) {
        const starSymbol = '✦';
        maskElement.textContent = starSymbol.repeat(confirmPasswordValue?.length || 0);
      }
    };
    updateConfirmPasswordMask();
  }, [confirmPasswordValue]);

  const checkUsernameAvailability = async (username: string) => {
    if (username.length >= 3) {
      const available = await AuthService.checkAvailability('username', username);
      if (!available) {
        setError('username', {
          type: 'manual',
          message: 'Nome utente non disponibile'
        });
      } else {
        clearErrors('username');
      }
    }
  };

  const checkEmailAvailability = async (email: string) => {
    if (email.includes('@')) {
      const available = await AuthService.checkAvailability('email', email);
      if (!available) {
        setError('email', {
          type: 'manual',
          message: 'Email già registrata'
        });
      } else {
        clearErrors('email');
      }
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setRegisterError('');
      setRegisterSuccess('');
      
      const registerData: RegisterData = {
        username: data.username,
        email: data.email,
        password: data.password,
        agreeToTerms: data.agreeToTerms
      };
      
      // Registrazione tramite API Gateway
      const result = await AuthService.register(registerData);
      
      if (result.success) {
        setRegisterSuccess(result.message || 'Registrazione completata con successo!');
        // Redirect alla pagina login dopo 3 secondi
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setRegisterError(result.error || 'Errore durante la registrazione');
      }
      
    } catch (error) {
      setRegisterError('Si è verificato un errore imprevisto');
      console.error('Errore registrazione:', error);
    }
  };

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - Registrazione</title>
        <meta name="description" content="Unisciti al mondo della Londra Vittoriana. Registrati per iniziare la tua avventura." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle="Registrazione">
        {/* Register Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="loginForm">
                <div className="formFields">
                  <div className="loginField usernameField">
                    <input
                      type="text"
                      placeholder="Nome Utente"
                      {...register('username', {
                        required: 'Nome utente obbligatorio',
                        minLength: {
                          value: 3,
                          message: 'Il nome utente deve avere almeno 3 caratteri'
                        },
                        maxLength: {
                          value: 20,
                          message: 'Il nome utente non può superare i 20 caratteri'
                        },
                        pattern: {
                          value: /^[a-zA-Z0-9_-]+$/,
                          message: 'Solo lettere, numeri, underscore e trattino'
                        }
                      })}
                      className="loginInput"
                      onBlur={(e) => checkUsernameAvailability(e.target.value)}
                    />
                    <span className="usernameMask" id="reg-username-mask"></span>
                  </div>
                  {errors.username && (
                    <div className="errorMessage">
                      {errors.username.message}
                    </div>
                  )}

                  <div className="loginField emailField">
                    <input
                      type="email"
                      placeholder="Email"
                      {...register('email', {
                        required: 'Email obbligatoria',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Formato email non valido'
                        }
                      })}
                      className="loginInput"
                      onBlur={(e) => checkEmailAvailability(e.target.value)}
                    />
                    <span className="emailMask" id="reg-email-mask"></span>
                  </div>
                  {errors.email && (
                    <div className="errorMessage">
                      {errors.email.message}
                    </div>
                  )}

                  <div className="loginField passwordField">
                    <input
                      type="password"
                      placeholder="Password"
                      id="reg-pwd"
                      {...register('password', {
                        required: 'Password obbligatoria',
                        minLength: {
                          value: 8,
                          message: 'La password deve avere almeno 8 caratteri'
                        },
                        pattern: {
                          value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
                          message: 'Password deve contenere almeno: 1 minuscola, 1 maiuscola, 1 numero, 1 carattere speciale (@$!%*?&)'
                        }
                      })}
                      className="loginInput"
                    />
                    <span className="passwordMask" id="reg-pwd-mask"></span>
                  </div>
                  {errors.password && (
                    <div className="errorMessage">
                      {errors.password.message}
                    </div>
                  )}

                  <div className="loginField confirmPasswordField">
                    <input
                      type="password"
                      placeholder="Conferma Password"
                      id="reg-confirm-pwd"
                      {...register('confirmPassword', {
                        required: 'Conferma password obbligatoria',
                        validate: value =>
                          value === passwordValue || 'Le password non coincidono'
                      })}
                      className="loginInput"
                    />
                    <span className="confirmPasswordMask" id="reg-confirm-pwd-mask"></span>
                  </div>
                  {errors.confirmPassword && (
                    <div className="errorMessage">
                      {errors.confirmPassword.message}
                    </div>
                  )}

                  <div className="checkboxContainer">
                    <input
                      type="checkbox"
                      id="agreeToTerms"
                      {...register('agreeToTerms', {
                        required: 'Devi accettare i termini e condizioni'
                      })}
                      className="checkbox"
                    />
                    <label htmlFor="agreeToTerms" className="checkboxLabel">
                      Accetto i <a href="/terms" target="_blank">termini e condizioni</a> e la <a href="/privacy" target="_blank">privacy policy</a>
                    </label>
                  </div>
                  {errors.agreeToTerms && (
                    <div className="errorMessage">
                      {errors.agreeToTerms.message}
                    </div>
                  )}

                  {registerError && (
                    <div className="errorMessage">
                      {registerError}
                    </div>
                  )}

                  {registerSuccess && (
                    <div className="successMessage">
                      {registerSuccess}
                      <br />
                      <small>Reindirizzamento al login...</small>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="actionsRow">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    className="loginButton"
                    disabled={registerSuccess !== ''}
                  >
                    Registrati
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