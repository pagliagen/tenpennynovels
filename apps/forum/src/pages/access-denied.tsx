import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/pages/AccessDenied.module.scss';
import { AuthContext } from '@/lib/auth';

interface AccessDeniedProps {
  authContext: AuthContext;
}

export default function AccessDeniedPage({ authContext }: AccessDeniedProps) {
  const router = useRouter();
  const { reason } = router.query;

  const getReasonDetails = () => {
    switch (reason) {
      case 'character-required':
        return {
          title: 'Personaggio Richiesto',
          message: 'Per accedere a questa area del forum è necessario avere un personaggio approvato.',
          suggestion: 'Crea o completa il tuo personaggio per accedere alle discussioni private.',
          actionText: 'Vai al Gioco',
          actionUrl: process.env.NEXT_PUBLIC_GAME_URL || 'https://game.tenpennynovels.com'
        };
      case 'private-topic':
        return {
          title: 'Area Privata',
          message: 'Questo argomento è riservato agli utenti con personaggi approvati.',
          suggestion: 'Accedi con le tue credenziali e assicurati di avere un personaggio approvato.',
          actionText: 'Login',
          actionUrl: process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com'
        };
      case 'admin-required':
        return {
          title: 'Accesso Amministrativo',
          message: 'Questa funzionalità è riservata agli amministratori del forum.',
          suggestion: 'Se ritieni di dover avere accesso, contatta un amministratore.',
          actionText: 'Torna al Forum',
          actionUrl: '/'
        };
      default:
        return {
          title: 'Accesso Negato',
          message: 'Non hai i permessi necessari per accedere a questa risorsa.',
          suggestion: 'Verifica le tue credenziali o contatta un amministratore.',
          actionText: 'Torna al Forum',
          actionUrl: '/'
        };
    }
  };

  const reasonDetails = getReasonDetails();

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - Accesso Negato</title>
        <meta name="description" content="Accesso negato alla risorsa richiesta" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={styles.accessDeniedContainer}>
        <div className={styles.accessDeniedCard}>
          <div className={styles.iconContainer}>
            <span className={styles.lockIcon}>🔒</span>
          </div>
          
          <h1 className={styles.title}>{reasonDetails.title}</h1>
          
          <p className={styles.message}>
            {reasonDetails.message}
          </p>
          
          <p className={styles.suggestion}>
            {reasonDetails.suggestion}
          </p>
          
          {authContext.isAuthenticated ? (
            <div className={styles.userInfo}>
              <h3>Informazioni Account</h3>
              <div className={styles.accountDetails}>
                <p><strong>Utente:</strong> {authContext.user?.username}</p>
                {authContext.character ? (
                  <>
                    <p><strong>Personaggio:</strong> {authContext.character.characterName}</p>
                    <p><strong>Stato:</strong> {
                      authContext.character.isApproved ? 
                        <span className={styles.approved}>Approvato</span> : 
                        <span className={styles.pending}>In Attesa di Approvazione</span>
                    }</p>
                  </>
                ) : (
                  <p><strong>Personaggio:</strong> <span className={styles.none}>Nessun personaggio</span></p>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.loginPrompt}>
              <h3>Non sei autenticato</h3>
              <p>Effettua l'accesso per partecipare al forum.</p>
            </div>
          )}
          
          <div className={styles.actions}>
            <button 
              onClick={() => window.location.href = reasonDetails.actionUrl}
              className="btn btn-primary"
            >
              {reasonDetails.actionText}
            </button>
            
            <Link href="/" className="btn btn-secondary">
              Torna al Forum
            </Link>
          </div>
          
          <div className={styles.helpText}>
            <p>
              Hai bisogno di aiuto? Consulta la{' '}
              <Link href="/help" className={styles.helpLink}>
                documentazione del forum
              </Link>
              {' '}o contatta un amministratore.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}