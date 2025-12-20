import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/pages/RecentDiscussions.module.scss'; // Riuso gli stili
import { AuthContext, parseAuthTokens, buildAuthContext } from '@/lib/auth';

interface MyPostsPageProps {
  authContext: AuthContext;
}

export default function MyPostsPage({ authContext }: MyPostsPageProps) {
  // Redirect to login if not authenticated
  if (!authContext.isAuthenticated) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Forum - I Miei Post</title>
          <meta name="description" content="Visualizza i tuoi post nel forum" />
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        <div className={styles.recentContainer}>
          <div className={styles.header}>
            <h2 className={styles.title}>I Miei Post</h2>
            <p className={styles.subtitle}>
              Devi essere autenticato per visualizzare i tuoi post
            </p>
          </div>

          <div className={styles.emptyState}>
            <h3>Accesso Richiesto</h3>
            <p>Devi effettuare il login per visualizzare i tuoi post nel forum.</p>
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
        <title>TenpennyNovels Forum - I Miei Post</title>
        <meta name="description" content="Visualizza i tuoi post nel forum" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={styles.recentContainer}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>I Miei Post</h2>
          <p className={styles.subtitle}>
            Visualizza tutti i post che hai pubblicato nel forum
          </p>
        </div>

        {/* Coming Soon State */}
        <div className={styles.emptyState}>
          <h3>🚧 Funzionalità in Sviluppo</h3>
          <p>La visualizzazione dei tuoi post personali sarà presto disponibile.</p>
          <p>Nel frattempo, puoi navigare attraverso le discussioni recenti o i tuoi argomenti preferiti.</p>
          
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

