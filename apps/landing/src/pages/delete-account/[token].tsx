import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { VictorianLayout } from '@/components/VictorianLayout';

export default function DeleteAccountPage() {
  const router = useRouter();
  const { token } = router.query;
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState(true);

  useEffect(() => {
    if (token && typeof token === 'string') {
      // Don't auto-delete, wait for user confirmation
      setLoading(false);
    }
  }, [token]);

  const confirmDeletion = async () => {
    if (!token || typeof token !== 'string') {
      setError('Token non valido');
      return;
    }

    try {
      setConfirming(true);
      setShowConfirmation(false);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/auth/delete-account/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setError('');

        // Redirect to homepage after 5 seconds
        setTimeout(() => {
          router.push('/');
        }, 5000);
      } else {
        setSuccess(false);
        setError(data.error || 'Errore durante l\'eliminazione dell\'account');
      }

    } catch (error) {
      setSuccess(false);
      setError('Errore di connessione durante l\'eliminazione');
      console.error('Errore eliminazione account:', error);
    } finally {
      setConfirming(false);
    }
  };

  const cancelDeletion = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>TenpennyNovels - Elimina Account</title>
          <meta name="description" content="Eliminazione account TenpennyNovels" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <VictorianLayout subtitle="Caricamento...">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'rgba(255, 149, 0, 0.8)' }}>Caricamento...</p>
          </div>
        </VictorianLayout>
      </>
    );
  }

  if (confirming) {
    return (
      <>
        <Head>
          <title>TenpennyNovels - Eliminazione in corso...</title>
          <meta name="description" content="Eliminazione account in corso" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <VictorianLayout subtitle="Eliminazione in corso...">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'rgba(255, 149, 0, 0.8)' }}>
              Stiamo eliminando il tuo account...
            </p>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', marginTop: '1rem' }}>
              Questa operazione potrebbe richiedere alcuni secondi.
            </p>
          </div>
        </VictorianLayout>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Head>
          <title>TenpennyNovels - Account Eliminato</title>
          <meta name="description" content="Account eliminato con successo" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <VictorianLayout subtitle="Account Eliminato">
          <div className="loginForm">
            <div className="formFields">
              <div className="successMessage">
                Il tuo account è stato eliminato con successo.
                <br />
                <br />
                Tutti i tuoi dati personali sono stati anonimizzati e i tuoi personaggi sono stati rimossi.
                <br />
                <br />
                <small>Verrai reindirizzato alla home page...</small>
              </div>
            </div>

            <div className="actionsRow">
              <Button
                type="button"
                variant="primary"
                onClick={() => router.push('/')}
                className="loginButton"
              >
                Vai alla Home
              </Button>
            </div>
          </div>
        </VictorianLayout>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>TenpennyNovels - Errore Eliminazione</title>
          <meta name="description" content="Errore durante l'eliminazione dell'account" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>

        <VictorianLayout subtitle="Errore Eliminazione">
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
                onClick={() => router.push('/')}
                className="loginButton"
              >
                Torna alla Home
              </Button>
            </div>
          </div>
        </VictorianLayout>
      </>
    );
  }

  // Show confirmation screen
  return (
    <>
      <Head>
        <title>TenpennyNovels - Conferma Eliminazione Account</title>
        <meta name="description" content="Conferma eliminazione account TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle="⚠️ Conferma Eliminazione Account">
        <div className="loginForm">
          <div className="formFields">
            <div style={{
              backgroundColor: 'rgba(139, 46, 46, 0.2)',
              border: '2px solid #8b2e2e',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              borderRadius: '4px'
            }}>
              <h3 style={{
                color: '#d43737',
                marginTop: 0,
                marginBottom: '1rem',
                fontSize: '1.2rem'
              }}>
                ⚠️ ATTENZIONE: Questa azione è irreversibile!
              </h3>
              <p style={{ marginBottom: '0.5rem', lineHeight: '1.6' }}>
                Eliminando il tuo account:
              </p>
              <ul style={{ marginLeft: '1.5rem', lineHeight: '1.8', marginBottom: '1rem' }}>
                <li>Tutti i tuoi dati personali saranno <strong>anonimizzati</strong></li>
                <li>I tuoi <strong>personaggi saranno eliminati</strong> definitivamente</li>
                <li><strong>Non potrai più accedere</strong> alla piattaforma</li>
                <li>Le tue azioni di gioco rimarranno nella storia (anonimizzate)</li>
              </ul>
              <p style={{
                marginTop: '1rem',
                marginBottom: 0,
                fontStyle: 'italic',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                Se hai dubbi o problemi, ti invitiamo a contattare il supporto prima di procedere.
              </p>
            </div>

            <p style={{
              textAlign: 'center',
              fontSize: '1.1rem',
              marginBottom: '1.5rem',
              color: 'rgba(255, 255, 255, 0.9)'
            }}>
              Sei sicuro di voler procedere con l'eliminazione del tuo account?
            </p>
          </div>

          <div className="actionsRow" style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            <Button
              type="button"
              variant="primary"
              onClick={confirmDeletion}
              className="loginButton"
              style={{ backgroundColor: '#8b2e2e' }}
            >
              ⚠️ Sì, Elimina Definitivamente il Mio Account
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={cancelDeletion}
              className="loginButton"
            >
              No, Torna alla Home
            </Button>
          </div>
        </div>
      </VictorianLayout>
    </>
  );
}
