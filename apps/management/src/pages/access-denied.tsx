import React from 'react';
import Head from 'next/head';
import styles from '@/styles/pages/AccessDenied.module.scss';

export default function AccessDenied() {
  const handleBackToGame = () => {
    window.location.href = process.env.GAME_URL || 'https://documenti.tenpennynovels.com';
  };

  const handleBackToLanding = () => {
    window.location.href = process.env.LANDING_URL || 'https://game.tenpennynovels.com';
  };

  return (
    <>
      <Head>
        <title>TenpennyNovels Management - Accesso Negato</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      
      <div className={styles.accessDeniedContainer}>
        <div className={styles.contentCard}>
          <div className={styles.iconContainer}>
            <span className={styles.deniedIcon}>🚫</span>
          </div>
          
          <div className={styles.textContent}>
            <h1 className={styles.title}>PERMESSO NEGATO</h1>
            
            <div className={styles.messageContainer}>
              <p className={styles.primaryMessage}>
                Non hai l'autorizzazione per accedere al pannello di amministrazione.
              </p>
              
              <div className={styles.detailsBox}>
                <h3>👑 Chi può accedere:</h3>
                <ul>
                  <li><strong>Gestore:</strong> Accesso completo a tutto il sistema</li>
                  <li><strong>Admin:</strong> Gestione utenti e contenuti</li>
                  <li><strong>Master:</strong> Gestione personaggi e gameplay</li>
                  <li><strong>Moderatore:</strong> Strumenti di moderazione</li>
                </ul>
              </div>
              
              <div className={styles.noteBox}>
                <p>
                  <strong>Nota:</strong> L'accesso è basato sui <em>ruoli utente</em>, 
                  non sui ruoli del personaggio. Se ritieni di dover avere accesso, 
                  contatta un amministratore del sistema.
                </p>
              </div>
            </div>
          </div>
          
          <div className={styles.actionButtons}>
            <button 
              onClick={handleBackToGame}
              className={`${styles.actionButton} ${styles.primary}`}
            >
              <span className={styles.buttonIcon}>🎭</span>
              Torna al Gioco
            </button>
            
            <button 
              onClick={handleBackToLanding}
              className={`${styles.actionButton} ${styles.secondary}`}
            >
              <span className={styles.buttonIcon}>🏠</span>
              Vai alla Homepage
            </button>
          </div>
          
          <div className={styles.footer}>
            <p>
              © 2025 TenpennyNovels - Sistema di Gestione della Londra Vittoriana
            </p>
          </div>
        </div>
      </div>
    </>
  );
}