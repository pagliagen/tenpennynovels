import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/pages/RecentDiscussions.module.scss'; // Riuso gli stili
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';

interface SubscriptionsPageProps {
  authContext: AuthContext;
}

export default function SubscriptionsPage({ authContext }: SubscriptionsPageProps) {
  // Redirect to login if not authenticated
  if (!authContext.isAuthenticated) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Forum - Discussioni Seguite</title>
          <meta name="description" content="Visualizza le discussioni che stai seguendo" />
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        <div className={styles.recentContainer}>
          <div className={styles.header}>
            <h2 className={styles.title}>Discussioni Seguite</h2>
            <p className={styles.subtitle}>
              Devi essere autenticato per visualizzare le discussioni che segui
            </p>
          </div>

          <div className={styles.emptyState}>
            <h3>Accesso Richiesto</h3>
            <p>Devi effettuare il login per visualizzare le discussioni che stai seguendo.</p>
            <a href={process.env.NEXT_PUBLIC_LANDING_URL || 'https://tenpennynovels.com'} className="btn btn-primary">
              Vai al Login
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Forum - Discussioni Seguite</title>
        <meta name="description" content="Visualizza le discussioni che stai seguendo nel forum" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={styles.recentContainer}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>🔔 Discussioni Seguite</h2>
          <p className={styles.subtitle}>
            Tieni traccia delle discussioni che ti interessano di più e ricevi notifiche sui nuovi aggiornamenti
          </p>
        </div>

        {/* Coming Soon State */}
        <div className={styles.emptyState}>
          <h3>🚧 Sistema di Notifiche in Sviluppo</h3>
          <p>La funzionalità per seguire le discussioni e ricevere notifiche sui nuovi post sarà presto disponibile.</p>
          <p>Questa funzione ti permetterà di:</p>
          
          <div style={{ 
            textAlign: 'left', 
            maxWidth: '500px', 
            margin: '1.5rem auto',
            padding: '1rem',
            background: 'rgba(212, 175, 55, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(212, 175, 55, 0.2)'
          }}>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#d4c4a0' }}>
              <li>Seguire discussioni specifiche</li>
              <li>Ricevere notifiche per nuovi post</li>
              <li>Gestire le tue preferenze di notifica</li>
              <li>Visualizzare un feed personalizzato</li>
            </ul>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <Link href="/recent" className="btn btn-primary">
              Discussioni Recenti
            </Link>
            <Link href="/favorites" className="btn btn-secondary">
              I Miei Preferiti
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

