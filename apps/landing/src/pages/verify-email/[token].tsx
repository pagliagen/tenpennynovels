import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { VictorianLayout } from '@/components/VictorianLayout';


export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = router.query;
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (token && typeof token === 'string') {
      verifyEmail(token);
    }
  }, [token]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/verify-email/${verificationToken}`, {
        method: 'GET',
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setError('');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/?verified=true');
        }, 3000);
      } else {
        setSuccess(false);
        setError(data.error || 'Errore durante la verifica email');
      }
      
    } catch (error) {
      setSuccess(false);
      setError('Errore di connessione durante la verifica');
      console.error('Errore verifica email:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Verifica Email</title>
          <meta name="description" content="Verifica del tuo indirizzo email per TenpennyNovels" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <VictorianLayout subtitle="Verifica Email in corso...">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'rgba(255, 149, 0, 0.8)' }}>Verifica email in corso...</p>
          </div>
        </VictorianLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - {success ? 'Email Verificata' : 'Errore Verifica'}</title>
        <meta name="description" content="Risultato della verifica email per TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle={success ? 'Email Verificata!' : 'Errore Verifica'}>
        <div className="loginForm">
              <div className="formFields">
                {success ? (
                  <div className="successMessage">
                    La tua email è stata verificata con successo!
                    <br />
                    <small>Verrai reindirizzato al login...</small>
                  </div>
                ) : (
                  <div className="errorMessage">
                    {error}
                  </div>
                )}
              </div>

              <div className="actionsRow">
                {success ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => router.push('/?verified=true')}
                    className="loginButton"
                  >
                    Vai al Login
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => router.push('/register')}
                      className="loginButton"
                    >
                      Torna alla Registrazione
                    </Button>
                    
                    <div className="secondaryActions">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push('/')} 
                      >
                        Torna al Login
                      </Button>
                    </div>
                  </>
                )}
              </div>
          </div>
      </VictorianLayout>
    </>
  );
}